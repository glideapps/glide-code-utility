import { $ } from "bun";
import fs from "fs";
import path from "path";
import { assert } from "@glideapps/ts-necessities";
import Parser, { type SyntaxNode } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

export interface ImportName {
    readonly isType: boolean;
    // `true` means a wildcard import
    readonly name: string | true;
    readonly as: string | undefined;
}

export interface Import {
    readonly kind: "import" | "export";
    readonly names: readonly ImportName[];
    readonly path: string;
}

export function getWildcardImport(p: Import): ImportName | undefined {
    const n = p.names.find((n) => n.name === true);
    if (n === undefined) return undefined;
    assert(p.names.length === 1);
    return n;
}

export function isTypeImport(p: Import): boolean {
    const isType = p.names.some((n) => n.isType);
    assert(p.names.every((n) => n.isType === isType));
    return isType;
}

export type Part = string | Import;
type Parts = readonly Part[];

function nodeText(code: string, node: SyntaxNode) {
    return code.slice(node.startIndex, node.endIndex);
}

// Recursively gather all import/export nodes in a DFS
function gatherImportExportNodes(node: SyntaxNode, results: SyntaxNode[]) {
    if (
        node.type === "import_statement" ||
        node.type === "export_statement" ||
        node.type === "export_clause"
    ) {
        results.push(node);
    }
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child === null) continue;
        gatherImportExportNodes(child, results);
    }
}

function parseImportOrExport(code: string, node: SyntaxNode): Import | null {
    const kind =
        node.type === "import_statement"
            ? "import"
            : node.type.startsWith("export")
            ? "export"
            : null;
    if (!kind) return null;

    // Try to find the "import_clause" or "export_clause" node to get names,
    // plus the string literal (path).
    const clauseNode =
        node.childForFieldName("import_clause") || // for imports
        node.childForFieldName("export_clause"); // for exports

    // Some exports (e.g. `export * from "foo"`) have no "export_clause", so we
    // look for the star node or named exports in them. This is a simplified approach.
    const fromNode = node.childForFieldName("source"); // usually a string literal
    if (!fromNode) return null;

    const path = nodeText(code, fromNode).replace(/^["']|["']$/g, "");
    const names: ImportName[] = [];

    // Attempt to detect "type" prefix inside the clause.
    // For more sophisticated handling, you'd walk children carefully.
    let typePrefix = false;
    if (clauseNode && clauseNode.text.startsWith("type")) {
        typePrefix = true;
    }

    // Collect each import/export name
    if (clauseNode) {
        // Clause might contain named imports, wildcard, or default.
        // We walk the children to see what they are.
        for (let i = 0; i < clauseNode.childCount; i++) {
            const child = clauseNode.child(i);
            if (!child) continue;

            // Identify wildcard import: import * as foo from 'x'
            if (child.type === "namespace_import") {
                const asNode = child.childForFieldName("name");
                names.push({
                    isType: typePrefix,
                    name: true, // wildcard
                    as: asNode ? nodeText(code, asNode) : undefined,
                });
            }
            // Identify named imports: import { foo as bar, baz } from 'x'
            else if (
                child.type === "named_imports" ||
                child.type === "named_exports"
            ) {
                for (let j = 0; j < child.namedChildCount; j++) {
                    const specifier = child.namedChild(j);
                    if (!specifier) continue;
                    // foo as bar
                    const nameNode = specifier.childForFieldName("name");
                    const aliasNode = specifier.childForFieldName("alias");
                    names.push({
                        isType: typePrefix,
                        name: nameNode ? nodeText(code, nameNode) : "",
                        as: aliasNode ? nodeText(code, aliasNode) : undefined,
                    });
                }
            }
            // Default import or export default
            // e.g. import Foo from 'x'
            else if (
                child.type === "import_specifier" ||
                child.type === "identifier"
            ) {
                names.push({
                    isType: typePrefix,
                    name: nodeText(code, child),
                    as: undefined,
                });
            }
        }
    } else {
        // Possibly `export * from "x"`
        // If the node has a '*' child, treat it as wildcard
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child && child.type === "*") {
                names.push({
                    isType: false, // "export *" doesn't specify type
                    name: true,
                    as: undefined,
                });
            }
        }
    }

    // If no names found, fallback to a wildcard guess or skip
    if (names.length === 0) {
        // Maybe `import "some-side-effect"`
        // We'll skip these or handle them as empty
        return {
            kind,
            names: [],
            path,
        };
    }

    return {
        kind,
        names,
        path,
    };
}

// A basic approach for creating a Part[]: we take the entire code and slice
// around import/export nodes. Everything in-between is just a string Part,
// and each import/export node yields an Import Part.
export function parseImports(code: string): Part[] {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    const tree = parser.parse(code);
    const imexNodes: SyntaxNode[] = [];
    gatherImportExportNodes(tree.rootNode, imexNodes);

    // Sort them by their location in the file
    imexNodes.sort((a, b) => a.startIndex - b.startIndex);

    const parts: Part[] = [];
    let currentIndex = 0;

    for (const node of imexNodes) {
        // Everything between currentIndex and node.startIndex is non-import code
        if (node.startIndex > currentIndex) {
            parts.push(code.slice(currentIndex, node.startIndex));
        }

        const imex = parseImportOrExport(code, node);
        if (imex) {
            parts.push(imex);
        } else {
            // If for some reason we couldn't parse, just keep the raw code
            parts.push(code.slice(node.startIndex, node.endIndex));
        }

        currentIndex = node.endIndex;
    }

    // Trailing code after the last import/export
    if (currentIndex < code.length) {
        parts.push(code.slice(currentIndex));
    }

    return parts;
}

export function readFileAndParseImports(filePath: string): Parts {
    const content = fs.readFileSync(filePath, "utf8");
    return parseImports(content);
}

export function unparseImports(parts: Parts): string {
    return parts
        .map((p) => {
            if (typeof p === "string") {
                return p;
            } else {
                assert(p.names.length > 0);
                const isType = p.names.some((n) => n.isType);
                assert(p.names.every((n) => n.isType === isType));

                const isWildcard = p.names.some((n) => n.name === true);
                if (isWildcard) {
                    assert(p.names.length === 1);
                }

                const type = isType ? "type " : "";
                if (isWildcard) {
                    return `${p.kind} ${type}* from "${p.path}";`;
                } else {
                    const names = p.names
                        .map((n) => {
                            if (n.as !== undefined) {
                                return `${n.name} as ${n.as}`;
                            } else {
                                return n.name;
                            }
                        })
                        .join(", ");
                    return `${p.kind} ${type}{ ${names} } from "${p.path}";`;
                }
            }
        })
        .join("");
}

export async function unparseImportsAndWriteFile(
    parts: Parts,
    filePath: string,
    prettier: boolean
): Promise<void> {
    const content = unparseImports(parts);
    fs.writeFileSync(filePath, content, "utf8");
    if (prettier) {
        const { dir, base } = path.parse(filePath);
        await $`npx prettier --write ${base}`.cwd(dir);
    }
}
