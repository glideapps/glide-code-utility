import fs from "fs";
import path from "path";
import { walkDirectory } from "./support";
import { readFileAndParseAllImports } from "./parse-imports";
import { makeGlidePackageName, parseGlideImportPath } from "./glide";
import { mapFilterUndefined } from "@glideapps/ts-necessities";

export async function fixPackageUse(dir: string, doFix: boolean) {
    const packageJSONPath = path.join(dir, "package.json");

    if (!fs.existsSync(packageJSONPath)) {
        console.error("package.json not found in the current directory.");
        process.exit(1);
    }

    const usedPackages = new Set<string>();

    await walkDirectory(path.join(dir, "src"), async (filePath) => {
        const { parts, dynamicImportPaths } =
            readFileAndParseAllImports(filePath);

        const allPaths = [
            ...mapFilterUndefined(parts, (p) =>
                typeof p === "string" ? undefined : p.path
            ),
            ...dynamicImportPaths,
        ];

        for (const path of allPaths) {
            const parsed = parseGlideImportPath(path);
            if (parsed === undefined) continue;
            const { packageName } = parsed;

            usedPackages.add(packageName);
        }
    });

    const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, "utf8"));
    const dependencies = {
        ...(packageJSON.dependencies ?? {}),
        ...(packageJSON.devDependencies ?? {}),
    };

    const packagesToAdd: string[] = [];
    const packagesToRemove: string[] = [];
    for (const packageName of usedPackages) {
        if (dependencies[makeGlidePackageName(packageName)] === undefined) {
            packagesToAdd.push(packageName);
        }
    }
    for (const fullPackageName of Object.keys(dependencies)) {
        const parsed = parseGlideImportPath(fullPackageName);
        if (parsed === undefined) continue;
        const { packageName } = parsed;

        if (!usedPackages.has(packageName)) {
            packagesToRemove.push(packageName);
        }
    }

    if (packagesToAdd.length === 0 && packagesToRemove.length === 0) {
        console.log("No unused dependencies found.");
        return;
    }

    if (packagesToAdd.length > 0) {
        console.log("Packages to add:", packagesToAdd.join(", "));
    }
    if (packagesToRemove.length > 0) {
        console.log("Packages to remove:", packagesToRemove.join(", "));
    }

    if (!doFix) return;

    packagesToAdd.forEach((packageName) => {
        packageJSON.dependencies[makeGlidePackageName(packageName)] =
            "workspace:*";
    });
    packagesToRemove.forEach((packageName) => {
        delete packageJSON.dependencies?.[makeGlidePackageName(packageName)];
        delete packageJSON.devDependencies?.[makeGlidePackageName(packageName)];
    });
    fs.writeFileSync(
        packageJSONPath,
        JSON.stringify(packageJSON, null, 4) + "\n"
    );
}
