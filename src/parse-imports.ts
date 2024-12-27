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

// Recursively gather import/export nodes
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

// Find a direct child of the given node with one of the specified `types`
function findChildByType(
    node: SyntaxNode,
    acceptedTypes: string[]
): SyntaxNode | undefined {
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && acceptedTypes.includes(child.type)) {
            return child;
        }
    }
    return undefined;
}

// Parse an import_statement or export_statement
function parseImportOrExport(code: string, node: SyntaxNode): Import | null {
    const kind =
        node.type === "import_statement"
            ? "import"
            : node.type === "export_statement"
            ? "export"
            : null;
    if (!kind) return null;

    // Find the string literal with the module path
    const sourceNode = findChildByType(node, ["string"]);
    if (!sourceNode) {
        // e.g. "export {foo}" without "from"
        return null;
    }
    const path = nodeText(code, sourceNode).replace(/^["']|["']$/g, "");

    // Tree-sitter generally puts the import/export details in a child called "import_clause" or "export_clause",
    // but `childForFieldName` might not work if the grammar doesn't define them as named fields.
    // So we search for them by type. Typically it's "import_clause" or "export_clause".
    const clauseNode = findChildByType(node, [
        "import_clause",
        "export_clause",
    ]);

    // We'll collect the names from the clause
    const names: ImportName[] = [];

    if (!clauseNode) {
        // Maybe `export * from "foo"` or `import "foo"` (side-effect only)
        let foundStar = false;
        for (let i = 0; i < node.childCount; i++) {
            const c = node.child(i);
            if (c && c.type === "*") {
                foundStar = true;
                break;
            }
        }
        if (foundStar) {
            names.push({ isType: false, name: true, as: undefined });
        }
    } else {
        // clauseNode might contain multiple children (default import, named imports, namespace imports, etc.)
        for (let i = 0; i < clauseNode.childCount; i++) {
            const child = clauseNode.child(i);
            if (!child) continue;

            switch (child.type) {
                // Default import => `import Foo from "foo"`
                // or `export default Foo` (though that's slightly different in TS)
                case "identifier": {
                    names.push({
                        isType: false,
                        name: nodeText(code, child),
                        as: undefined,
                    });
                    break;
                }
                // e.g. `import { Foo, Bar as Baz } from "something"`
                //      `export { X, Y as Z } from "whatever"`
                case "named_imports":
                case "named_exports": {
                    for (let j = 0; j < child.namedChildCount; j++) {
                        const spec = child.namedChild(j);
                        // Typically "import_specifier" or "export_specifier"
                        if (
                            spec &&
                            (spec.type === "import_specifier" ||
                                spec.type === "export_specifier")
                        ) {
                            const nameNode = findChildByType(spec, [
                                "identifier",
                            ]);
                            const aliasNode = findChildByType(spec, [
                                "identifier",
                            ]); // or see if there's a field for alias
                            // In many grammars, the name is the first child, the alias is the second (if there's an `as`)
                            // But let's do a more direct approach:
                            const realName = spec.childForFieldName("name"); // often doesn't work if no named field
                            const realAlias = spec.childForFieldName("alias"); // often doesn't work either
                            // fallback to manual child scanning:
                            // spec might look like: (import_specifier name: (identifier) alias: (identifier))
                            // We'll map them carefully:
                            let importName: string | undefined;
                            let aliasName: string | undefined;

                            // We'll check children in order:
                            if (spec.childCount === 1) {
                                // just { Foo }
                                importName = nodeText(code, spec.child(0)!);
                            } else if (spec.childCount === 3) {
                                // something like { Foo as Bar }
                                // typically child(1) is "as"
                                importName = nodeText(code, spec.child(0)!);
                                aliasName = nodeText(code, spec.child(2)!);
                            } else {
                                // fallback
                                importName = nameNode
                                    ? nodeText(code, nameNode)
                                    : "";
                                aliasName =
                                    aliasNode && aliasNode !== nameNode
                                        ? nodeText(code, aliasNode)
                                        : undefined;
                            }

                            if (importName) {
                                names.push({
                                    isType: false,
                                    name: importName,
                                    as: aliasName,
                                });
                            }
                        }
                    }
                    break;
                }
                // e.g. `import * as Foo from "bar"`
                case "namespace_import": {
                    // might have a child named "Foo"
                    const asNode = findChildByType(child, ["identifier"]);
                    names.push({
                        isType: false,
                        name: true,
                        as: asNode ? nodeText(code, asNode) : undefined,
                    });
                    break;
                }
                default:
                    // For other child types, we skip or parse as needed
                    break;
            }
        }
    }

    return { kind, names, path };
}

// We'll produce Part[] by slicing the source code around each import/export node
export function parseImports(code: string): Part[] {
    const parser = new Parser();
    parser.setLanguage(TypeScript.typescript);

    const tree = parser.parse(code);

    // Gather import/export statements
    const imexNodes: SyntaxNode[] = [];
    gatherImportExportNodes(tree.rootNode, imexNodes);
    imexNodes.sort((a, b) => a.startIndex - b.startIndex);

    const parts: Part[] = [];
    let currentIndex = 0;

    for (const node of imexNodes) {
        // Grab the code before this statement
        if (node.startIndex > currentIndex) {
            parts.push(code.slice(currentIndex, node.startIndex));
        }
        // Parse
        const parsed = parseImportOrExport(code, node);
        if (parsed) {
            parts.push(parsed);
        } else {
            // fallback
            parts.push(code.slice(node.startIndex, node.endIndex));
        }
        currentIndex = node.endIndex;
    }

    // The remainder after the last import/export
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
