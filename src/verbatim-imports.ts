import {
    readFileAndParseImports,
    unparseImportsAndWriteFile,
} from "./parse-imports";
import { isTSFile, walkDirectory } from "./support";

export async function verbatimImports(
    sourcePaths: readonly string[]
): Promise<void> {
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            let parts = readFileAndParseImports(filePath);

            parts = parts.map((p) => {
                if (typeof p === "string") return p;
                if (!p.path.startsWith(".")) return p;
                if (p.path.endsWith(".js")) return p;
                return { ...p, path: `${p.path}.js` };
            });

            console.log("writing", filePath);
            await unparseImportsAndWriteFile(parts, filePath, false);
        });
    }
}
