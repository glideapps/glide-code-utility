import path from "path";
import {
    readFileAndParseImports,
    unparseImportsAndWriteFile,
} from "./parse-imports";
import { walkDirectory, isTSFile } from "./support";
import { parseGlideImportPath } from "./glide";

// Returns the set of files that were modified
export async function removeReExports(
    sourcePaths: readonly string[]
): Promise<Set<string>> {
    const modifiedFiles = new Set<string>();
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            if (
                path.normalize(filePath) === path.join(sourcePath, "index.ts")
            ) {
                // console.log("ignoring", filePath);
                return;
            }

            const isIndexTS = path.parse(filePath).base === "index.ts";

            const parts = readFileAndParseImports(filePath);
            const resultParts = parts.filter((p) => {
                if (typeof p === "string") return true;
                // We only remove exports
                if (p.kind !== "export") return true;
                // We remove re-exports from glide-internal packages
                if (parseGlideImportPath(p.path) !== undefined) return false;
                // And we remove re-exports from files within the package,
                // unless they're in an `index.ts`.
                if (!isIndexTS && p.path.startsWith(".")) return false;
                return true;
            });
            if (resultParts.length === parts.length) return;

            console.log("writing", filePath);
            await unparseImportsAndWriteFile(resultParts, filePath, false);
            modifiedFiles.add(filePath);
        });
    }
    return modifiedFiles;
}
