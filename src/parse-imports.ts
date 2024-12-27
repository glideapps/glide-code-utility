import { $ } from "bun";
import fs from "fs";
import path from "path";
import { separateStringByMatches } from "./support";
import { assert } from "@glideapps/ts-necessities";

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

const commentRegexp = /\/\*(\*(?!\/)|[^*])*\*\//g;
const importRegexp =
    /(import|export)(\s+type)?\s+(\*|{([^}]*?)}|[a-zA-Z_$][a-zA-Z\d_$]*)\s+from "([^";]+)";/g;

export function parseImports(code: string): Parts {
    const parts: Part[] = [];

    // First we find all the block comments
    const commentParts = separateStringByMatches(commentRegexp, code);
    for (const c of commentParts) {
        if (typeof c !== "string") {
            // It's a comment, so we just push it
            parts.push(c[0]);
            continue;
        }

        // It's non-comment code, so we parse it
        const parsedParts = separateStringByMatches(importRegexp, c);

        for (const p of parsedParts) {
            if (typeof p === "string") {
                parts.push(p);
            } else {
                const kind = p[1] as "import" | "export";
                const type = p[2] !== undefined;
                const path = p[5];
                if (p[3] === "*") {
                    parts.push({
                        kind,
                        names: [{ isType: type, name: true, as: undefined }],
                        path,
                    });
                } else if (p[4]) {
                    const names = p[4]
                        .split(",")
                        .map((n) => n.trim())
                        .filter((n) => n.length > 0);
                    parts.push({
                        kind,
                        names: names.map((n) => ({
                            isType: type,
                            name: n,
                            as: undefined,
                        })),
                        path,
                    });
                } else {
                    parts.push(p[0]);
                }
            }
        }
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
