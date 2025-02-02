import { isTSFile, walkDirectory } from "./support";
import {
    readFileAndParseImports,
    type Part,
    unparseImportsAndWriteFile,
    getWildcardImport,
    isTypeImport,
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
            const resultParts: Part[] = [];
            for (const part of parts) {
                if (
                    typeof part === "string" ||
                    part.kind !== "import" ||
                    part.path !== fromPath ||
                    getWildcardImport(part) !== undefined ||
                    !part.names.some((n) => n.name === name)
                ) {
                    resultParts.push(part);
                    continue;
                }

                const rest = part.names.filter((n) => n.name !== name);
                if (rest.length > 0) {
                    resultParts.push({ ...part, names: rest });
                    resultParts.push("\n");
                }
                resultParts.push({
                    kind: part.kind,
                    names: [
                        { isType: isTypeImport(part), name, as: undefined },
                    ],
                    path: toPath,
                });
                didRewrite = true;
            }

            if (didRewrite) {
                await unparseImportsAndWriteFile(resultParts, filePath, false);
                console.log("Rewrote imports in", filePath);
            }
        });
    }
}
