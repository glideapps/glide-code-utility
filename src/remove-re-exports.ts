import path from "path";
import {
    readFileAndParseImports,
    unparseImportsAndWriteFile,
} from "./parse-imports";
import { walkDirectory, isTSFile } from "./support";

export async function removeReExports(
    sourcePaths: readonly string[]
): Promise<void> {
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const { dir, base } = path.parse(filePath);
            if (base === "index.ts") return;

            const parts = readFileAndParseImports(filePath);
            const resultParts = parts.filter((p) => {
                if (typeof p === "string") return true;
                return p.kind !== "export";
            });
            if (resultParts.length === parts.length) return;

            console.log("writing", filePath);
            await unparseImportsAndWriteFile(resultParts, filePath, false);
        });
    }
}
