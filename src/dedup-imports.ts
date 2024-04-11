import { $ } from "bun";
import * as fs from "fs";
import path from "path";
import { parseImports, unparseImports, type Import } from "./parse-imports";
import { isTSFile, walkDirectory } from "./support";
import { DefaultMap } from "@glideapps/ts-necessities";

export async function dedupImports(
    sourcePaths: readonly string[]
): Promise<void> {
    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parts = parseImports(fs.readFileSync(filePath, "utf-8"));

            const nonTypeNames = new DefaultMap<string, string[]>(() => []);
            const typeNames = new DefaultMap<string, string[]>(() => []);

            let haveChanges = false;

            for (const p of parts) {
                if (typeof p === "string") continue;
                if (p.kind !== "import") continue;
                if (p.names === true) continue;

                const map = p.isType ? typeNames : nonTypeNames;

                const existing = map.get(p.path);
                if (existing.length > 0) {
                    haveChanges = true;
                }
                existing.push(...p.names);
            }

            if (!haveChanges) {
                // console.log("no changes", filePath);
                return;
            }

            const nonTypesDone = new Set<string>();
            const typesDone = new Set<string>();

            function shouldDrop(i: Import) {
                if (i.kind !== "import") return false;
                if (i.names === true) return false;
                const set = i.isType ? typesDone : nonTypesDone;
                return set.has(i.path);
            }

            const left = Array.from(parts);
            const finished: typeof left = [];
            for (;;) {
                const first = left.shift();
                if (first === undefined) break;

                if (typeof first !== "string") {
                    if (shouldDrop(first)) continue;

                    const allForPath = (
                        first.isType ? typeNames : nonTypeNames
                    ).get(first.path);
                    finished.push({ ...first, names: allForPath });
                    (first.isType ? typesDone : nonTypesDone).add(first.path);
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
            fs.writeFileSync(filePath, unparseImports(finished), "utf-8");
            const { dir, base } = path.parse(filePath);
            await $`npx prettier --write ${base}`.cwd(dir);
        });
    }
}
