import { DefaultMap } from "@glideapps/ts-necessities";
import { readFileAndParseImports, readFileAndParseAllImports } from "./parse-imports";
import { walkDirectory, isTSFile } from "./support";
import { getGlideSourcePaths } from "./glide";
import path from "path";

export async function countSymbolUses(
    repoPath: string
): Promise<void> {
    const resolvedRepoPath = path.resolve(repoPath);
    const { allSourcePaths } = getGlideSourcePaths(repoPath);

    // First pass: collect all exported symbols with their file paths
    // symbol -> file path where it's exported
    const exportedSymbols = new Map<string, string>();

    for (const sourcePath of allSourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const allImports = readFileAndParseAllImports(filePath);
            const relativePath = path.relative(resolvedRepoPath, filePath);
            for (const exportedSymbol of allImports.directExports) {
                exportedSymbols.set(exportedSymbol, relativePath);
            }

            // Also collect from export statements
            for (const part of allImports.parts) {
                if (typeof part === "string" || part.kind !== "export") {
                    continue;
                }

                for (const name of part.names) {
                    if (name.name === true) {
                        // Wildcard exports - count as the alias if present
                        if (name.as !== undefined) {
                            exportedSymbols.set(name.as, relativePath);
                        }
                    } else if (name.name === undefined) {
                        // Default exports - count as the alias
                        if (name.as !== undefined) {
                            exportedSymbols.set(name.as, relativePath);
                        }
                    } else {
                        // Named exports - use the exported name (not alias)
                        exportedSymbols.set(name.name, relativePath);
                    }
                }
            }
        });
    }

    // Second pass: count imports of only exported symbols
    // symbol -> count
    const counts = new DefaultMap<string, number>(() => 0);

    for (const sourcePath of allSourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parts = readFileAndParseImports(filePath);
            for (const part of parts) {
                if (typeof part === "string" || part.kind !== "import") {
                    continue;
                }

                for (const name of part.names) {
                    let symbolName: string | undefined;

                    if (name.name === true) {
                        // Wildcard imports - count as the alias if present
                        symbolName = name.as;
                    } else if (name.name === undefined) {
                        // Default imports - count as the alias
                        symbolName = name.as;
                    } else {
                        // Named imports - count the actual imported name (not alias)
                        symbolName = name.name;
                    }

                    // Only count if this symbol is exported somewhere in our codebase
                    if (symbolName && exportedSymbols.has(symbolName)) {
                        counts.update(symbolName, (n) => n + 1);
                    }
                }
            }
        });
    }

    // Sort by count (descending) then by symbol name (ascending) for consistent output
    const sortedEntries = Array.from(counts.entries()).sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) return countDiff;
        return a[0].localeCompare(b[0]);
    });

    console.log("symbol,count,exported_in");
    for (const [symbol, count] of sortedEntries) {
        const exportPath = exportedSymbols.get(symbol) || "";
        console.log(`${symbol},${count},${exportPath}`);
    }
}