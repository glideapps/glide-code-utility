import { DefaultMap, assert } from "@glideapps/ts-necessities";
import fs from "fs";
import path from "path";
import { escapeStringAsRegexp, isTSFile, walkDirectory } from "./support";

interface Entries {
    readonly full: Set<string>;
    readonly types: Set<string>;
}

function addType(entries: Entries, name: string) {
    if (entries.full.has(name)) return;
    entries.types.add(name);
}

function addFull(entries: Entries, name: string) {
    entries.types.delete(name);
    entries.full.add(name);
}

export function barrelExport(
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
    const packageNameRegex = escapeStringAsRegexp(packageName);

    const exportStatements = new DefaultMap<string, Entries>(() => ({
        full: new Set(),
        types: new Set(),
    }));

    for (const path of directoryPaths) {
        walkDirectory(path, (filePath) => {
            if (!isTSFile(filePath)) return;

            const content = fs.readFileSync(filePath, "utf8");
            const importRegex = new RegExp(
                `import(\\s+type)?\\s+({([^}]*?)}|[a-zA-Z_$][a-zA-Z\\d_$]*)\\s+from "${packageNameRegex}\\/dist\\/js\\/([^";]+)";`,
                "g"
            );

            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const maybeType = match[1] ?? "";
                const symbolsString = match[2].replace(/[\n\r]+/g, " ").trim();
                const path = match[4];

                let symbols: string[];
                if (symbolsString.startsWith("{")) {
                    assert(symbolsString.endsWith("}"));
                    symbols = symbolsString
                        .substring(1, symbolsString.length - 1)
                        .split(",")
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                } else {
                    symbols = [`default as ${symbolsString}`];
                }

                const entries = exportStatements.get(path);
                if (maybeType.length > 0) {
                    symbols.forEach((s) => addType(entries, s));
                } else {
                    symbols.forEach((s) => addFull(entries, s));
                }
            }
        });
    }

    const lines: string[] = [];
    for (const [path, entry] of exportStatements.entries()) {
        if (entry.full.size > 0) {
            lines.push(
                `export { ${Array.from(entry.full).join(
                    ", "
                )} } from "./${path}";`
            );
        }
        if (entry.types.size > 0) {
            lines.push(
                `export type { ${Array.from(entry.types).join(
                    ", "
                )} } from "./${path}";`
            );
        }
    }

    const outputFilePath = path.join(packageDir, "src", "index.ts");
    if (fs.existsSync(outputFilePath)) {
        fs.appendFileSync(outputFilePath, "\n\n" + lines.join("\n"));
    } else {
        fs.writeFileSync(outputFilePath, lines.join("\n"));
    }

    console.log(`Exports written to ${outputFilePath}`);
}
