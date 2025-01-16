import fs from "fs";
import path from "path";
import { getGlideSourcePaths } from "./glide";
import { isTSFile, walkDirectory } from "./support";
import { readFileAndParseAllImports } from "./parse-imports";
import { DefaultMap } from "@glideapps/ts-necessities";
import { removeExport } from "./unexport";

export async function findUnusedExports(repoPath: string) {
    repoPath = path.resolve(repoPath);

    const { packageNames, allSourcePaths } = getGlideSourcePaths(repoPath);

    const allExportedNames = new DefaultMap<string, string[]>(() => []);
    const allImportedNames = new Set<string>();

    for (const sourcPath of allSourcePaths) {
        await walkDirectory(sourcPath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const imports = readFileAndParseAllImports(filePath);

            for (const part of imports.parts) {
                if (typeof part === "string") continue;
                if (part.kind !== "import") continue;

                for (const name of part.names) {
                    if (typeof name.name !== "string") continue;

                    allImportedNames.add(name.name);
                }
            }

            for (const e of imports.directExports) {
                allExportedNames.get(e).push(filePath);
            }
        });
    }

    for (const [name, filePaths] of allExportedNames) {
        if (allImportedNames.has(name)) continue;
        // Special case for the CLI routines, which are imported via an `await
        // import`, which we can't parse.
        if (name.endsWith("Routine")) continue;
        if (name === "preloadingDispatched" || name === "f") continue;

        console.log("Unused export", name, filePaths);

        for (const filePath of filePaths) {
            // Storybook files just export stuff that then becomes a story
            // automatically.
            if (
                filePath.endsWith("-stories.tsx") ||
                filePath.endsWith(".stories-skip.tsx")
            ) {
                continue;
            }
            let source = fs.readFileSync(filePath, "utf-8");
            source = removeExport(name, source);
            fs.writeFileSync(filePath, source, "utf-8");
        }
    }
}
