import { DefaultMap } from "@glideapps/ts-necessities";
import { parseGlideImportPath } from "./glide";
import { readFileAndParseImports } from "./parse-imports";
import { walkDirectory, isTSFile } from "./support";

export async function countImports(
    sourcePaths: readonly string[]
): Promise<void> {
    // source path -> package -> symbol -> count
    const counts = new DefaultMap<
        string,
        DefaultMap<string, DefaultMap<string, number>>
    >(
        () =>
            new DefaultMap<string, DefaultMap<string, number>>(
                () => new DefaultMap(() => 0)
            )
    );

    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parts = readFileAndParseImports(filePath);
            for (const part of parts) {
                if (typeof part === "string" || part.kind !== "import") {
                    continue;
                }

                const glideImport = parseGlideImportPath(part.path);
                if (glideImport === undefined) continue;

                for (const name of part.names) {
                    if (name.name === true) continue;
                    counts
                        .get(sourcePath)
                        .get(glideImport.packageName)
                        .update(name.name, (n) => n + 1);
                }
            }
        });
    }

    console.log("path,package,symbol,count");
    for (const [sourcePath, ps] of counts.entries()) {
        for (const [packageName, cs] of ps.entries()) {
            for (const [symbol, count] of cs.entries()) {
                console.log(`${sourcePath},${packageName},${symbol},${count}`);
            }
        }
    }
}
