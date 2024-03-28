import { $ } from "bun";
import * as process from "process";
import * as path from "path";
import * as fs from "fs";

function usage(status: number): never {
    console.log(`Usage: ${process.argv[0]} ${process.argv[1]} FILE TARGET-DIR`);
    process.exit(status);
}

function findClosestPackageJSON(startPath: string): string | undefined {
    let currentPath = path.resolve(startPath);

    while (true) {
        const packageJSONPath = path.join(currentPath, "package.json");

        if (fs.existsSync(packageJSONPath)) {
            return packageJSONPath;
        }

        const parentPath = path.dirname(currentPath);

        if (parentPath === currentPath) {
            // Reached the root directory without finding package.json
            return undefined;
        }

        currentPath = parentPath;
    }
}

interface Package {
    readonly json: any;
    readonly name: string;
}

function parsePackage(packageJSONPath: string): Package {
    const json = JSON.parse(fs.readFileSync(packageJSONPath, "utf-8"));
    return { json, name: json.name };
}

function findClosestCommonAncestor(path1: string, path2: string): string {
    const absolutePath1 = path.resolve(path1);
    const absolutePath2 = path.resolve(path2);

    const parts1 = absolutePath1.split(path.sep);
    const parts2 = absolutePath2.split(path.sep);

    let closestCommonAncestor: string = path.sep;

    for (let i = 0; i < parts1.length && i < parts2.length; i++) {
        if (parts1[i] === parts2[i]) {
            closestCommonAncestor = path.join(closestCommonAncestor, parts1[i]);
        } else {
            break;
        }
    }

    return closestCommonAncestor;
}

function parseExports(sourceCode: string): [Set<string>, Set<string>] {
    const lines = sourceCode.split("\n");
    const typeExports = new Set<string>();
    const objectExports = new Set<string>();

    const typeKeywords = ["type", "interface"];
    const objectKeywords = ["class", "function", "const", "let", "var", "enum"];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("export")) {
            const parts = trimmedLine.split(/\s+/);
            if (parts.length >= 3) {
                const keyword = parts[1];
                const name = parts[2].split(/[=:;{(]/)[0].trim();

                if (typeKeywords.includes(keyword)) {
                    typeExports.add(name);
                } else if (objectKeywords.includes(keyword)) {
                    objectExports.add(name);
                }
            }
        }
    }

    return [typeExports, objectExports];
}

export async function moveFilePackage(
    sourceFilePath: string,
    targetDirPath: string
) {
    const wd = process.cwd();

    const args = process.argv.slice(2);
    if (args.length !== 2) {
        return usage(1);
    }

    sourceFilePath = path.resolve(wd, args[0]);
    targetDirPath = path.resolve(wd, args[1]);

    const sourcePackagePath = findClosestPackageJSON(sourceFilePath);
    const targetPackagePath = findClosestPackageJSON(targetDirPath);
    if (sourcePackagePath === undefined || targetPackagePath === undefined) {
        return usage(1);
    }

    const commonPath = findClosestCommonAncestor(
        sourcePackagePath,
        targetPackagePath
    );
    console.log(commonPath);

    const sourcePackage = parsePackage(sourcePackagePath);
    const targetPackage = parsePackage(targetPackagePath);

    console.log(sourcePackage.name);
    console.log(targetPackage.name);

    const [typeExports, objectExports] = parseExports(
        fs.readFileSync(sourceFilePath, "utf-8")
    );
    if (typeExports.size === 0 && objectExports.size === 0) {
        console.error("File has no exports");
        return process.exit(1);
    }

    console.log(typeExports, objectExports);

    $.cwd(commonPath);
    console.log(`git mv ${sourceFilePath} ${targetDirPath}`);
    await $`git mv ${sourceFilePath} ${targetDirPath}`;

    const lines: string[] = [];
    if (typeExports.size > 0) {
        lines.push(
            `export type { ${Array.from(typeExports).join(", ")} } from "${
                targetPackage.name
            }";`
        );
    }
    if (objectExports.size > 0) {
        lines.push(
            `export { ${Array.from(objectExports).join(", ")} } from "${
                targetPackage.name
            }";`
        );
    }
    fs.writeFileSync(sourceFilePath, lines.join("\n"), "utf-8");

    if (sourcePackage.json.dependencies?.[targetPackage.name] === undefined) {
        const newPackage = {
            ...sourcePackage.json,
            dependencies: {
                ...sourcePackage.json.dependencies,
                [targetPackage.name]: "workspace:*",
            },
        };
        fs.writeFileSync(
            sourcePackagePath,
            JSON.stringify(newPackage, undefined, 4),
            "utf-8"
        );
    }
}
