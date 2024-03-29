import fs from "fs";
import { isTSFile, walkDirectory } from "./support";
import { parseImports, type Import, unparseImports } from "./parse-imports";

export function rewriteImports(
    name: string,
    fromPath: string,
    toPath: string,
    sourcePaths: readonly string[]
) {
    for (const sourcePath of sourcePaths) {
        walkDirectory(sourcePath, (filePath) => {
            if (!isTSFile(filePath)) return;

            const content = fs.readFileSync(filePath, "utf8");
            const parts = parseImports(content);

            let didRewrite = false;
            const resultParts: (string | Import)[] = [];
            for (const part of parts) {
                if (
                    typeof part === "string" ||
                    part.path !== fromPath ||
                    !part.names.includes(name)
                ) {
                    resultParts.push(part);
                    continue;
                }

                const rest = part.names.filter((n) => n !== name);
                if (rest.length > 0) {
                    resultParts.push({ ...part, names: rest });
                    resultParts.push("\n");
                }
                resultParts.push({
                    type: part.type,
                    names: [name],
                    path: toPath,
                });
                didRewrite = true;
            }

            if (didRewrite) {
                fs.writeFileSync(filePath, unparseImports(resultParts), "utf8");
                console.log("Rewrote imports in", filePath);
            }
        });
    }
}
