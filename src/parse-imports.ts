import fs from "fs";
import { assert, panic } from "@glideapps/ts-necessities";
import Parser, { type SyntaxNode, type Tree } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import { prettier } from "./prettier";

export interface ImportName {
    readonly isType: boolean;
    // `true` means a wildcard `*` import, `undefined` means a default import
    // without a `*`
    readonly name: string | true | undefined;
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

export function hasFullImports(p: Import): boolean {
    return p.names.some((n) => typeof n.name !== "string");
}

export function isTypeImport(p: Import): boolean {
    const isType = p.names.some((n) => n.isType);
    assert(p.names.every((n) => n.isType === isType));
    return isType;
}

export type Part = string | Import;
export type Parts = readonly Part[];

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
    } else {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);
            if (child === null) continue;
            gatherImportExportNodes(child, results);
        }
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
function parseImportOrExport(
    code: string,
    node: SyntaxNode,
    filePath: string,
    directExports: Set<string>
): Import | undefined {
    const kind =
        node.type === "import_statement"
            ? "import"
            : node.type === "export_statement"
            ? "export"
            : undefined;
    if (kind === undefined) return undefined;

    if (kind === "import" && node.childCount === 3) {
        // This is just `import "foo"`, which is a side-effect only import.
        // We don't treat those as imports.
        assert(node.child(1)?.type === "string", filePath);
        return undefined;
    }

    // Find the string literal with the module path.  If `path` is
    // `undefined`, we only gather direct exports.
    let path: string | undefined;
    const sourceNode = findChildByType(node, ["string"]);
    if (sourceNode !== undefined) {
        const sourceFragmentNode = sourceNode.child(1);
        assert(sourceFragmentNode?.type === "string_fragment", filePath);
        path = sourceFragmentNode.text;
    }
    const gatherDirectExports = kind === "export" && path === undefined;

    const typeNode = findChildByType(node, ["type"]);
    const globalIsType = typeNode !== undefined;

    // Tree-sitter generally puts the import/export details in a child called "import_clause" or "export_clause",
    // but `childForFieldName` might not work if the grammar doesn't define them as named fields.
    // So we search for them by type. Typically it's "import_clause" or "export_clause".
    const clauseNode =
        findChildByType(node, ["import_clause", "export_clause"]) ?? node;

    // We'll collect the names from the clause
    const names: ImportName[] = [];

    function processSpecifier(spec: SyntaxNode) {
        let i = 0;
        const isType = spec.child(i)?.type === "type";
        if (isType) i++;
        const nameNode = spec.child(i) ?? undefined;
        let aliasNode: SyntaxNode | undefined;
        assert(nameNode !== undefined, filePath);
        i++;
        if (spec.child(i)?.type === "as") {
            i++;
            aliasNode = spec.child(i) ?? undefined;
            assert(aliasNode !== undefined, filePath);
            i++;
        }
        assert(i === spec.childCount, filePath);

        const importName = nameNode.text;
        const aliasName = aliasNode?.text;

        names.push({
            isType: isType || globalIsType,
            name: importName,
            as: importName === aliasName ? undefined : aliasName,
        });

        if (gatherDirectExports) {
            directExports.add(aliasName ?? importName);
        }
    }

    function addExportsFromPattern(pattern: SyntaxNode) {
        assert(gatherDirectExports);
        if (pattern.type === "identifier") {
            directExports.add(pattern.text);
        } else if (pattern.type === "object_pattern") {
            for (const child of pattern.children) {
                if (child.type === "shorthand_property_identifier_pattern") {
                    directExports.add(child.text);
                }
            }
        } else {
            return panic(`Unexpected export ${pattern.text} in ${filePath}`);
        }
    }

    if (kind === "export") {
        debugger;
    }

    // clauseNode might contain multiple children (default import, named imports, namespace imports, etc.)
    for (let i = 0; i < clauseNode.childCount; i++) {
        const child = clauseNode.child(i);
        if (!child) continue;

        switch (child.type) {
            // Default import => `import Foo from "foo"`
            // or `export default Foo` (though that's slightly different in TS)
            case "identifier": {
                names.push({
                    isType: globalIsType,
                    name: undefined,
                    as: nodeText(code, child),
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
                        processSpecifier(spec);
                    } else {
                        return panic(
                            `Unexpected import specifier ${spec?.text} in ${filePath}`
                        );
                    }
                }
                break;
            }
            case "export_specifier": {
                processSpecifier(child);
                break;
            }
            // e.g. `import * as Foo from "bar"`
            case "*":
            case "namespace_import":
            case "namespace_export": {
                // might have a child named "Foo"
                const asNode = findChildByType(child, ["identifier"]);
                names.push({
                    isType: globalIsType,
                    name: true,
                    as: asNode ? nodeText(code, asNode) : undefined,
                });
                break;
            }
            case "function_declaration":
            case "generator_function_declaration":
            case "type_alias_declaration":
            case "interface_declaration":
            case "class_declaration":
            case "abstract_class_declaration":
            case "enum_declaration": {
                if (gatherDirectExports) {
                    const name = child.childForFieldName("name");
                    assert(name !== null, filePath);
                    directExports.add(name.text);
                }
                break;
            }
            case "lexical_declaration":
            case "variable_declaration": {
                if (gatherDirectExports) {
                    const nameNode =
                        child.namedChild(0)?.childForFieldName("name") ??
                        undefined;
                    assert(nameNode !== undefined, filePath);
                    addExportsFromPattern(nameNode);
                }
                break;
            }
            default:
                // For other child types, we skip or parse as needed
                break;
        }
    }

    if (path === undefined) return undefined;
    return { kind, names, path };
}

// We'll produce Part[] by slicing the source code around each import/export node
function parseImports(
    code: string,
    filePath: string
): { parts: Parts; tree: Tree; directExports: Set<string> } {
    const parser = new Parser();
    parser.setLanguage(
        filePath.endsWith("x") ? TypeScript.tsx : TypeScript.typescript
    );

    const tree = parser.parse(code);

    // console.log(filePath, tree.rootNode.toString());

    // Gather import/export statements
    const imexNodes: SyntaxNode[] = [];
    gatherImportExportNodes(tree.rootNode, imexNodes);
    imexNodes.sort((a, b) => a.startIndex - b.startIndex);

    const parts: Part[] = [];
    let currentIndex = 0;

    const directExports = new Set<string>();

    for (const node of imexNodes) {
        // Grab the code before this statement
        if (node.startIndex > currentIndex) {
            parts.push(code.slice(currentIndex, node.startIndex));
        }
        // Parse
        const parsed = parseImportOrExport(code, node, filePath, directExports);
        if (parsed !== undefined) {
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

    return { parts, tree, directExports };
}

export function readFileAndParseImports(filePath: string): Parts {
    const content = fs.readFileSync(filePath, "utf8");
    const { parts } = parseImports(content, filePath);
    return parts;
}

function gatherDynamicImports(
    node: SyntaxNode,
    importPaths: Set<string>,
    filePath: string
) {
    if (node.type === "call_expression") {
        const fn = node.child(0);
        assert(fn !== null, filePath);
        if (fn?.type === "import") {
            const args = node.child(1);
            assert(args?.type === "arguments", filePath);
            assert(args.childCount === 3, filePath);
            const arg = args.child(1);
            // If it's not a string, it's a variable, which we can't resolve.
            if (arg?.type === "string") {
                const path = arg?.child(1)?.text;
                assert(typeof path === "string", filePath);
                importPaths.add(path);
                return;
            }
        }
    }
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child === null) continue;
        gatherDynamicImports(child, importPaths, filePath);
    }
}

export interface AllImports {
    readonly parts: Parts;
    readonly dynamicImportPaths: readonly string[];
    readonly directExports: readonly string[];
    readonly content: string;
}

export function readFileAndParseAllImports(filePath: string): AllImports {
    const content = fs.readFileSync(filePath, "utf8");
    const { parts, tree, directExports } = parseImports(content, filePath);
    // console.log(filePath, tree.rootNode.toString());
    const importPaths = new Set<string>();
    gatherDynamicImports(tree.rootNode, importPaths, filePath);
    return {
        parts,
        dynamicImportPaths: Array.from(importPaths),
        directExports: Array.from(directExports),
        content,
    };
}

export function unparseImports(parts: Parts): string {
    return parts
        .map((p) => {
            if (typeof p === "string") {
                return p;
            } else {
                let notBraced: string[] = [];
                let bracedIsType =
                    !hasFullImports(p) &&
                    p.names.every(
                        (n) => n.isType || typeof n.name !== "string"
                    );
                let braced: string[] = [];

                for (const n of p.names) {
                    const isBraced = typeof n.name === "string";

                    let s: string;
                    if (n.name === undefined) {
                        assert(n.as !== undefined);
                        s = n.as;
                    } else {
                        s = n.name === true ? "*" : n.name;
                        if (n.as !== undefined) {
                            s += " as " + n.as;
                        }
                    }
                    if (n.isType && (!isBraced || !bracedIsType)) {
                        s = "type " + s;
                    }

                    if (isBraced) {
                        braced.push(s);
                    } else {
                        notBraced.push(s);
                    }
                }
                assert(notBraced.length > 0 || braced.length > 0);

                let s = p.kind;
                if (notBraced.length > 0) {
                    s += " " + notBraced.join(", ");
                }
                if (braced.length > 0) {
                    if (notBraced.length > 0) {
                        s += ",";
                    }
                    if (bracedIsType) {
                        s += " type";
                    }
                    s += " { " + braced.join(", ") + " }";
                }

                s += ' from "' + p.path + '";';

                return s;
            }
        })
        .join("");
}

export async function unparseImportsAndWriteFile(
    parts: Parts,
    filePath: string,
    runPrettier: boolean
): Promise<void> {
    const content = unparseImports(parts);
    if (content.trim() === "") {
        console.log("deleting empty file", filePath);
        fs.unlinkSync(filePath);
    } else {
        fs.writeFileSync(filePath, content, "utf8");
        if (runPrettier) {
            await prettier(filePath);
        }
    }
}
