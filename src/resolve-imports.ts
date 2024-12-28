import fs from "fs";
import path from "path";
import { assert } from "@glideapps/ts-necessities";
import { isTSFile, walkDirectory } from "./support";
import {
    getWildcardImport,
    readFileAndParseImports,
    unparseImportsAndWriteFile,
    type Import,
    type ImportName,
    type Part,
} from "./parse-imports";
import { parseGlideImportPath } from "./glide";

// from -> to
const dontRewrite: Record<string, Record<string, true>> = {
    "@glide/plugins": {
        "@glide/plugins-codecs": true,
    },
};

// Returns `undefined` if the file shouldn't be followed
function findTSFile(filePath: string) {
    if (filePath.endsWith(".js")) return undefined;

    const tsFilename = filePath + ".ts";
    if (fs.existsSync(tsFilename)) {
        return tsFilename;
    }

    const tsxFilename = filePath + ".tsx";
    if (fs.existsSync(tsxFilename)) {
        return tsxFilename;
    }

    const indexTSFilename = path.join(filePath, "index.ts");
    if (fs.existsSync(indexTSFilename)) {
        return indexTSFilename;
    }

    const indexTSXFilename = path.join(filePath, "index.tsx");
    if (fs.existsSync(indexTSXFilename)) {
        return indexTSXFilename;
    }

    const jsFilename = filePath + ".js";
    if (fs.existsSync(jsFilename)) return undefined;

    const indexDTSFilename = path.join(filePath, "index.d.ts");
    if (fs.existsSync(indexDTSFilename)) return undefined;

    console.error("Not found:", filePath);
    process.exit(1);
}

interface ResolvedImport {
    readonly path: string;
    readonly name: string;
}

class ImportResolver {
    constructor(private readonly packageDir: string) {}

    private findImportedFile(
        packageName: string,
        subpath: string | undefined
    ): string | undefined {
        let filePath = path.join(this.packageDir, packageName, "src");
        if (subpath !== undefined) {
            filePath = path.join(filePath, subpath);
        } else {
            filePath = path.join(filePath, "index");
        }

        return findTSFile(filePath);
    }

    public resolveImport(
        sourceFilePath: string,
        name: string,
        importedFromPath: string
    ): ResolvedImport | undefined {
        let currentFilePath = sourceFilePath;
        // If this is set, it's either a path to an NPM package, or the
        // absolute path to a TypeScript file.
        let lastSuccessfulPath: string | undefined;
        let lastSuccessfulName: string | undefined;

        function resolveLastSucessfulPath(): ResolvedImport | undefined {
            const stripSuffixes = [/(^|\/)index\.tsx?$/, /\.tsx?$/];

            if (lastSuccessfulPath === undefined) {
                assert(lastSuccessfulName === undefined);
                return undefined;
            }
            assert(lastSuccessfulName !== undefined);

            if (!lastSuccessfulPath.startsWith("/")) {
                return { path: lastSuccessfulPath, name: lastSuccessfulName };
            }

            let relative = path.relative(
                path.parse(sourceFilePath).dir,
                lastSuccessfulPath
            );

            for (const suffix of stripSuffixes) {
                const match = relative.match(suffix);
                if (match !== null) {
                    relative = relative.substring(0, match.index);
                    break;
                }
            }

            if (relative.startsWith(".")) {
                return { path: relative, name: lastSuccessfulName };
            } else if (relative === "") {
                return { path: ".", name: lastSuccessfulName };
            } else {
                return { path: "./" + relative, name: lastSuccessfulName };
            }
        }

        again: for (;;) {
            let nextFilePath: string | undefined;

            if (importedFromPath.startsWith(".")) {
                const { dir } = path.parse(currentFilePath);
                nextFilePath = findTSFile(path.join(dir, importedFromPath));

                if (
                    lastSuccessfulPath === undefined ||
                    lastSuccessfulPath.startsWith("/")
                ) {
                    lastSuccessfulPath = nextFilePath;
                    if (lastSuccessfulPath !== undefined) {
                        lastSuccessfulName = name;
                    }
                }
            } else {
                const glideImportPath = parseGlideImportPath(importedFromPath);
                if (glideImportPath === undefined) {
                    return resolveLastSucessfulPath();
                }
                const { packageName, subpath } = glideImportPath;

                nextFilePath = this.findImportedFile(packageName, subpath);

                lastSuccessfulPath = importedFromPath;
                lastSuccessfulName = name;
            }
            if (nextFilePath === undefined) return resolveLastSucessfulPath();

            const parts = readFileAndParseImports(nextFilePath);
            for (const part of parts) {
                if (typeof part === "string") continue;
                // FIXME: handle wildcard imports by recursing
                if (getWildcardImport(part) !== undefined) continue;

                const n = part.names.find(
                    (n) =>
                        typeof n.name === "string" && (n.as ?? n.name) === name
                );
                if (n !== undefined) {
                    assert(typeof n.name === "string");
                    importedFromPath = part.path;
                    currentFilePath = nextFilePath;
                    name = n.name;
                    continue again;
                }
            }

            return resolveLastSucessfulPath();
        }
    }
}

async function resolveImports(resolver: ImportResolver, filePath: string) {
    function needsRewrite(
        originalName: string,
        originalPath: string,
        resolved: ResolvedImport | undefined
    ): boolean {
        if (resolved === undefined) return false;
        if (resolved.path === originalPath) {
            assert(
                resolved.name === originalName,
                `in ${filePath}: ${originalName} -> ${resolved.name}`
            );
            return false;
        }
        if (dontRewrite[originalPath]?.[resolved.path] === true) {
            assert(
                resolved.name === originalName,
                `in ${filePath}: ${originalName} -> ${resolved.name}`
            );
            return false;
        }
        return true;
    }

    assert(isTSFile(filePath));

    const parts = readFileAndParseImports(filePath);

    let didRewrite = false;
    const resultParts: Part[] = [];

    for (const part of parts) {
        if (typeof part === "string") {
            resultParts.push(part);
            continue;
        }

        const namesToKeep: ImportName[] = [];
        const newImports: (Import & { names: ImportName[] })[] = [];
        for (const name of part.names) {
            if (name.name === true || name.name === undefined) {
                namesToKeep.push(name);
                continue;
            }

            const resolved = resolver.resolveImport(
                filePath,
                name.name,
                part.path
            );
            if (!needsRewrite(name.name, part.path, resolved)) {
                namesToKeep.push(name);
                continue;
            }
            assert(resolved !== undefined);

            // console.log(`${name}: ${part.path} -> ${resolved}`);
            let newImport: (Import & { names: ImportName[] }) | undefined;
            for (const i of newImports) {
                if (i.path === resolved.path) {
                    newImport = i;
                    break;
                }
            }
            if (newImport === undefined) {
                newImport = {
                    kind: part.kind,
                    names: [],
                    path: resolved.path,
                };
                newImports.push(newImport);
            }

            const as = name.as ?? name.name;
            newImport.names.push({
                ...name,
                name: resolved.name,
                as: resolved.name === as ? undefined : as,
            });

            didRewrite = true;
        }
        resultParts.push(...newImports);
        if (namesToKeep.length > 0) {
            resultParts.push({ ...part, names: namesToKeep });
        }
    }

    if (didRewrite) {
        console.log("Resolved imports in", filePath);
        await unparseImportsAndWriteFile(resultParts, filePath, false);
    }
}

export async function resolveImportsInDirectories(
    packageDir: string,
    sourcePaths: readonly string[]
): Promise<void> {
    const resolver = new ImportResolver(packageDir);

    for (const sourcePath of sourcePaths) {
        await walkDirectory(sourcePath, async (filePath) => {
            if (!isTSFile(filePath)) return;
            await resolveImports(resolver, filePath);
        });
    }
}
