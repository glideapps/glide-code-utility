import {
    getWildcardImport,
    isTypeImport,
    readFileAndParseImports,
    unparseImportsAndWriteFile,
    type Import,
} from "./parse-imports";
import { isTSFile, walkDirectory } from "./support";
import { DefaultMap } from "@glideapps/ts-necessities";

export async function dedupImports(
    sourcePaths: readonly string[]
): Promise<void> {
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parts = readFileAndParseImports(filePath);

            // import path -> [names]
            const nonTypeNames = new DefaultMap<string, string[]>(() => []);
            const typeNames = new DefaultMap<string, string[]>(() => []);

            let haveChanges = false;

            for (const p of parts) {
                if (typeof p === "string") continue;
                if (p.kind !== "import") continue;

                for (const name of p.names) {
                    if (name.name === true) continue;

                    const map = name.isType ? typeNames : nonTypeNames;
                    const existing = map.get(p.path);
                    if (existing.length > 0) {
                        haveChanges = true;
                    }
                    existing.push(name.name);
                }
            }

            if (!haveChanges) {
                // console.log("no changes", filePath);
                return;
            }

            // import paths already imported from
            const nonTypesDone = new Set<string>();
            const typesDone = new Set<string>();

            function shouldDrop(i: Import) {
                if (i.kind !== "import") return false;
                if (getWildcardImport(i) !== undefined) return false;
                const isType = isTypeImport(i);
                const set = isType ? typesDone : nonTypesDone;
                return set.has(i.path);
            }

            const left = Array.from(parts);
            const finished: typeof left = [];
            for (;;) {
                const first = left.shift();
                if (first === undefined) break;

                if (typeof first !== "string") {
                    if (shouldDrop(first)) continue;
                    if (first.kind !== "import") {
                        finished.push(first);
                        continue;
                    }

                    const isType = isTypeImport(first);
                    const allForPath = (isType ? typeNames : nonTypeNames).get(
                        first.path
                    );
                    finished.push({
                        ...first,
                        names: allForPath.map((n) => ({
                            isType,
                            name: n,
                            as: undefined,
                        })),
                    });
                    (isType ? typesDone : nonTypesDone).add(first.path);
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
            await unparseImportsAndWriteFile(finished, filePath, true);
        });
    }
}
