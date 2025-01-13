import fs from "fs";
import path from "path";
import { resolveImportsInDirectories } from "./resolve-imports";
import { removeReExports } from "./remove-re-exports";
import { dedupImports } from "./dedup-imports";
import { fixPackageUse } from "./fix-package-use";
import { prettier } from "./prettier";
import { concurrentForEach } from "./concurrent";
import { getGlideSourcePaths } from "./glide";

export async function serviceGlide(repoPath: string) {
    repoPath = path.resolve(repoPath);

    const { packageNames, allSourcePaths } = getGlideSourcePaths(repoPath);

    console.log("resolving imports");
    const resolveModified = await resolveImportsInDirectories(
        path.join(repoPath, "packages"),
        allSourcePaths,
        false
    );

    console.log("removing re-exports");
    const removeModified = await removeReExports(allSourcePaths);

    const allModifiedFiles = new Set([...resolveModified, ...removeModified]);

    console.log("de-duping imports in changed files");
    await dedupImports(Array.from(allModifiedFiles), false);

    console.log("fixing package use");
    for (const packageName of packageNames) {
        const packageDir = path.join(repoPath, "packages", packageName);
        await fixPackageUse(packageDir, true);
    }

    if (allModifiedFiles.size === 0) {
        console.log("No TypeScript file was modified.");
        return;
    }

    console.log(
        `Modified ${allModifiedFiles.size} TypeScript files - running prettier`
    );
    await concurrentForEach(allModifiedFiles, 10, async (filePath) => {
        // We can remove files, so check for that before running prettier.
        if (!fs.existsSync(filePath)) return;
        await prettier(filePath);
    });
}
