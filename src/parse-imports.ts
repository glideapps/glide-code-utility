import { separateStringByMatches } from "./support";

export interface Import {
    readonly type: boolean;
    readonly names: readonly string[];
    readonly path: string;
}

const importRegexp =
    /import(\s+type)?\s+({([^}]*?)}|[a-zA-Z_$][a-zA-Z\d_$]*)\s+from "([^";]+)";/g;

export function parseImports(code: string): readonly (string | Import)[] {
    const parsedParts = separateStringByMatches(importRegexp, code);
    const parts: (string | Import)[] = [];

    for (const p of parsedParts) {
        if (typeof p === "string") {
            parts.push(p);
        } else {
            if (p[3]) {
                const type = p[1] !== undefined;
                const names = p[3].split(",").map((n) => n.trim());
                parts.push({ type, names, path: p[4] });
            } else {
                parts.push(p[0]);
            }
        }
    }

    return parts;
}

export function unparseImports(parts: readonly (string | Import)[]): string {
    return parts
        .map((p) => {
            if (typeof p === "string") {
                return p;
            } else {
                const type = p.type ? "type " : "";
                const names = p.names.join(", ");
                return `import ${type}{ ${names} } from "${p.path}";`;
            }
        })
        .join("");
}
