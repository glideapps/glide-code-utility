import {
    hasFullImports,
    readFileAndParseImports,
    unparseImportsAndWriteFile,
    type Import,
    type ImportName,
} from "./parse-imports";
import { isTSFile, walkDirectory } from "./support";
import { DefaultMap } from "@glideapps/ts-necessities";

// Returns the set of files that were modified
export async function dedupImports(
    sourcePaths: readonly string[],
    withPrettier: boolean
): Promise<Set<string>> {
    const modifiedFiles = new Set<string>();
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parts = readFileAndParseImports(filePath);

            // import path -> names
            const namesForPath = new DefaultMap<string, ImportName[]>(() => []);

            let haveChanges = false;

            for (const p of parts) {
                if (typeof p === "string") continue;
                if (p.kind !== "import") continue;
                if (hasFullImports(p)) continue;

                const existing = namesForPath.get(p.path);
                if (existing.length > 0) {
                    haveChanges = true;
                }
                existing.push(...p.names);
            }

            if (!haveChanges) {
                // console.log("no changes", filePath);
                return;
            }

            // import paths already imported from
            const pathsDone = new Set<string>();

            function shouldDrop(i: Import) {
                if (i.kind !== "import") return false;
                if (hasFullImports(i)) return false;
                return pathsDone.has(i.path);
            }

            const left = Array.from(parts);
            const finished: typeof left = [];
            for (;;) {
                const first = left.shift();
                if (first === undefined) break;

                if (typeof first !== "string") {
                    if (shouldDrop(first)) continue;
                    if (first.kind !== "import" || hasFullImports(first)) {
                        finished.push(first);
                        continue;
                    }

                    finished.push({
                        kind: "import",
                        path: first.path,
                        names: namesForPath.get(first.path),
                    });
                    pathsDone.add(first.path);
                } else {
                    const second = left[0];
                    if (
                        second !== undefined &&
                        typeof second !== "string" &&
                        shouldDrop(second)
                    ) {
                        if (first.startsWith("\n")) {
                            finished.push(first.substring(1));
                        } else if (first.endsWith("\n")) {
                            finished.push(first.substring(0, first.length - 1));
                        } else {
                            finished.push(first);
                        }
                    } else {
                        finished.push(first);
                    }
                }
            }

            console.log("writing", filePath);
            await unparseImportsAndWriteFile(finished, filePath, withPrettier);
            modifiedFiles.add(filePath);
        });
    }
    return modifiedFiles;
}
