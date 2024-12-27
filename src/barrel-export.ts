import { $ } from "bun";
import { assert, DefaultMap } from "@glideapps/ts-necessities";
import fs from "fs";
import path from "path";
import { isTSFile, walkDirectory } from "./support";
import {
    readFileAndParseImports,
    type Part,
    unparseImportsAndWriteFile,
    getWildcardImport,
} from "./parse-imports";

interface Entries {
    full: Set<string> | true;
    types: Set<string> | true;
}

function addType(entries: Entries, name: string) {
    if (
        entries.full === true ||
        entries.full.has(name) ||
        entries.types === true
    )
        return;
    entries.types.add(name);
}

function addFull(entries: Entries, name: string) {
    if (entries.types !== true) {
        entries.types.delete(name);
    }
    if (entries.full !== true) {
        entries.full.add(name);
    }
}

export async function barrelExport(
    packageDir: string,
    directoryPaths: readonly string[]
) {
    if (directoryPaths.length === 0) {
        throw new Error("Directory path is required");
    }

    const packageJSON = JSON.parse(
        fs.readFileSync(path.join(packageDir, "package.json"), "utf8")
    );
    const packageName = packageJSON.name;
    const importPrefix = `${packageName}/dist/js/`;

    const exportStatements = new DefaultMap<string, Entries>(() => ({
        full: new Set(),
        types: new Set(),
    }));

    for (const directoryPath of directoryPaths) {
        await walkDirectory(directoryPath, async (filePath) => {
            if (!isTSFile(filePath)) return;

            const parsedParts = readFileAndParseImports(filePath);

            let didChange = false;
            let newParts: Part[] = [];
            for (const part of parsedParts) {
                if (
                    typeof part === "string" ||
                    part.kind !== "import" ||
                    !part.path.startsWith(importPrefix)
                ) {
                    newParts.push(part);
                    continue;
                }

                const wildcard = getWildcardImport(part);
                if (wildcard !== undefined) {
                    console.error(
                        "Wildcard imports are not supported",
                        filePath
                    );
                    continue;
                }

                const partPath = part.path.substring(importPrefix.length);

                const entries = exportStatements.get(partPath);
                for (const name of part.names) {
                    assert(name.name !== true);
                    if (name.isType) {
                        addType(entries, name.name);
                    } else {
                        addFull(entries, name.name);
                    }
                }

                newParts.push({ ...part, path: packageName });
                didChange = true;
            }

            if (didChange) {
                console.log(`Writing imports to ${filePath}`);
                await unparseImportsAndWriteFile(newParts, filePath, true);
            }
        });
    }

    const outputFilePath = path.join(packageDir, "src", "index.ts");
    // path -> exports
    // `true` means a wildcard export
    const existingExports = new Map<string, Entries>();

    if (fs.existsSync(outputFilePath)) {
        const parts = readFileAndParseImports(outputFilePath);

        for (const part of parts) {
            if (typeof part === "string" || part.kind !== "export") continue;
            if (!part.path.startsWith("./")) continue;

            const path = part.path.substring(2);

            const entries = existingExports.get(part.path) ?? {
                full: new Set(),
                types: new Set(),
            };

            const wildcard = getWildcardImport(part);
            if (wildcard !== undefined) {
                if (wildcard.isType) {
                    entries.types = true;
                } else {
                    entries.full = true;
                }
            } else {
                for (const name of part.names) {
                    assert(name.name !== true);
                    if (name.isType) {
                        if (entries.types !== true) {
                            entries.types.add(name.name);
                        }
                    } else {
                        if (entries.full !== true) {
                            entries.full.add(name.name);
                        }
                    }
                }
            }
            existingExports.set(path, entries);
        }
    }

    const lines: string[] = [];
    for (const [path, entry] of exportStatements.entries()) {
        const existing = existingExports.get(path) ?? {
            full: new Set(),
            types: new Set(),
        };

        if (entry.full === true) {
            if (existing.full !== true) {
                lines.push(`export * from "./${path}";`);
            }
        } else {
            const full = Array.from(entry.full).filter(
                (n) => existing.full !== true && !existing.full.has(n)
            );
            if (full.length > 0) {
                lines.push(`export { ${full.join(", ")} } from "./${path}";`);
            }
        }

        if (entry.types === true) {
            if (existing.types !== true) {
                lines.push(`export type * from "./${path}";`);
            }
        } else {
            const types = Array.from(entry.types).filter(
                (n) => existing.types !== true && !existing.types.has(n)
            );
            if (types.length > 0) {
                lines.push(
                    `export type { ${types.join(", ")} } from "./${path}";`
                );
            }
        }
    }

    if (fs.existsSync(outputFilePath)) {
        fs.appendFileSync(outputFilePath, "\n\n" + lines.join("\n"));
    } else {
        fs.writeFileSync(outputFilePath, lines.join("\n"));
    }

    console.log(`Exports written to ${outputFilePath}`);
}
