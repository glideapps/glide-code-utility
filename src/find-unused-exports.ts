import fs from "fs";
import path from "path";
import { getGlideSourcePaths } from "./glide";
import { isTSFile, walkDirectory } from "./support";
import { readFileAndParseAllImports } from "./parse-imports";
import { DefaultMap } from "@glideapps/ts-necessities";
import { removeExport } from "./unexport";

function isStoryFile(filePath: string) {
    return (
        filePath.endsWith("-stories.tsx") ||
        filePath.endsWith(".stories.tsx") ||
        filePath.endsWith(".stories-skip.tsx")
    );
}

function isTestFile(filePath: string) {
    return (
        filePath.endsWith(".test.ts") ||
        filePath.endsWith(".test.tsx") ||
        filePath.includes("/__tests__/")
    );
}

function hasMultipleOccurrences(
    mainString: string,
    searchString: string
): boolean {
    return mainString.split(searchString).length > 2;
}

export async function findUnusedExports(repoPath: string) {
    repoPath = path.resolve(repoPath);

    const { allSourcePaths } = getGlideSourcePaths(repoPath);

    const allExportedNames = new DefaultMap<string, string[]>(() => []);
    const allImportedNamesInProduction = new Set<string>();
    const allImportedNamesInTests = new Set<string>();
    const exportsUsedInternally = new Set<string>();

    for (const sourcPath of allSourcePaths) {
        await walkDirectory(sourcPath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const imports = readFileAndParseAllImports(filePath);

            const isTest = isStoryFile(filePath) || isTestFile(filePath);

            for (const part of imports.parts) {
                if (typeof part === "string") continue;
                if (part.kind !== "import") continue;

                for (const name of part.names) {
                    if (typeof name.name !== "string") continue;

                    const set = isTest
                        ? allImportedNamesInTests
                        : allImportedNamesInProduction;
                    set.add(name.name);
                }
            }

            for (const e of imports.directExports) {
                allExportedNames.get(e).push(filePath);
                if (hasMultipleOccurrences(imports.content, e)) {
                    exportsUsedInternally.add(e);
                }
            }
        });
    }

    for (const [name, filePaths] of allExportedNames) {
        if (allImportedNamesInProduction.has(name)) continue;
        if (
            allImportedNamesInTests.has(name) &&
            exportsUsedInternally.has(name)
        ) {
            continue;
        }
        // Special case for the CLI routines, which are imported via an `await
        // import`, which we can't parse.
        if (name.endsWith("Routine")) continue;
        if (name === "preloadingDispatched" || name === "f") continue;

        console.log("Unused export", name, filePaths);

        for (const filePath of filePaths) {
            // Storybook files just export stuff that then becomes a story
            // automatically.
            if (isStoryFile(filePath)) continue;
            // These are lazily imported.
            if (
                filePath.includes("/cli/parsed-cli/") ||
                filePath.includes("/cli/routines/")
            ) {
                continue;
            }

            let source = fs.readFileSync(filePath, "utf-8");
            source = removeExport(name, source);
            fs.writeFileSync(filePath, source, "utf-8");
        }
    }
}
