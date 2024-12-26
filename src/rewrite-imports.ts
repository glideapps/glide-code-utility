import fs from "fs";
import { isTSFile, walkDirectory } from "./support";
import {
    type Import,
    unparseImports,
    readFileAndParseImports,
} from "./parse-imports";

export async function rewriteImports(
    name: string,
    fromPath: string,
    toPath: string,
    sourcePaths: readonly string[]
) {
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parts = readFileAndParseImports(filePath);

            let didRewrite = false;
            const resultParts: (string | Import)[] = [];
            for (const part of parts) {
                if (
                    typeof part === "string" ||
                    part.kind !== "import" ||
                    part.path !== fromPath ||
                    part.names === true ||
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
                    kind: part.kind,
                    isType: part.isType,
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
