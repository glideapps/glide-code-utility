import { Command } from "commander";
import { fixPackageUse } from "./fix-package-use";
import { moveFilePackage } from "./move-file-package";
import { barrelExport } from "./barrel-export";
import { countDependencyImports } from "./count-dependency-imports";
import { rewriteImports } from "./rewrite-imports";
import { dedupImports } from "./dedup-imports";
import { verbatimImports } from "./verbatim-imports";
import { resolveImportsInDirectories } from "./resolve-imports";
import { countImports } from "./count-imports";
import { removeReExports } from "./remove-re-exports";
import { readFileAndParseAllImports } from "./parse-imports";
import { serviceGlide } from "./service-glide";
import { findUnusedExports } from "./find-unused-exports";

const program = new Command();

program
    .command("service-glide")
    .argument("<repo-path>", "Path to the Glide repository")
    .description("Do everything to remove indirect imports")
    .action(async (repoPath) => {
        serviceGlide(repoPath);
    });

program
    .command("parse-file")
    .argument("<file>")
    .action(async (fileName) => {
        const parts = readFileAndParseAllImports(fileName);
        console.log(JSON.stringify(parts, null, 2));
    });

program
    .command("fix-package-use")
    .description(
        "Add/remove Glide package imports from a package, depending on whether they are used"
    )
    .argument("<directory>", "Directory that has the package.json file")
    .option("-f, --fix", "Actually fix packages in package.json")
    .action(async (dir, options) => {
        await fixPackageUse(dir, options.fix);
    });

program
    .command("move-file-package")
    .argument("<source-file>", "Path to the file to move")
    .argument("<target-directory>", "Path to the directory to move the file to")
    .description("Move a file to a package directory and update its exports")
    .action(async (sourceFilePath, targetDirPath) => {
        await moveFilePackage(sourceFilePath, targetDirPath);
    });

program
    .command("barrel-export")
    .argument("<package-dir>", "Path to the package directory")
    .argument("<source-paths...>", "Paths to directories to search for exports")
    .description("Generate a barrel export for a package")
    .action(async (packageDir, directoryPaths) => {
        barrelExport(packageDir, directoryPaths);
    });

program
    .command("rewrite-imports")
    .argument("<name>", "Name of the imported symbol")
    .argument("<from-path>", "Import path to rewrite")
    .argument("<to-path>", "New import path")
    .argument("<source-paths...>", "Paths to directories to search for imports")
    .description("Rewrite import paths in a project")
    .action(async (name, fromPath, toPath, sourcePaths) => {
        rewriteImports(name, fromPath, toPath, sourcePaths);
    });

program
    .command("count-dependency-imports")
    .description(
        `Iterates through each package dependencies with nx output and counts the imports of each one.  Useful for finding instances of light imports where dependencies could be moved.`
    )
    .argument("[directory]", "The nx workspace directory to operate in (glide)")
    .action((dir) => {
        countDependencyImports(dir ?? process.cwd());
    });

program
    .command("dedup-imports")
    .argument(
        "<source-paths...>",
        "Paths to directories with source files to process"
    )
    .option("-p, --prettier", "Prettify the output")
    .description(
        "Rewrites multiple imports of the same package to a single import"
    )
    .action(async (sourcePaths, options) => {
        dedupImports(sourcePaths, options.prettier);
    });

program
    .command("verbatim-imports")
    .argument(
        "<source-paths...>",
        "Paths to directories with source files to process"
    )
    .description(
        "Rewrites imports to use the verbatim import syntax with explicit extensions"
    )
    .action(async (sourcePaths) => {
        verbatimImports(sourcePaths);
    });

program
    .command("resolve-imports")
    .argument("<packages-path>", "Path to the packages directory")
    .argument(
        "<source-paths...>",
        "Paths to directories with source files to process"
    )
    .option("-p, --prettier", "Prettify the output")
    .description("Resolve imports of re-exported symbols")
    .action(async (packagesPath, sourceFilePaths, options) => {
        resolveImportsInDirectories(
            packagesPath,
            sourceFilePaths,
            options.prettier
        );
    });

program
    .command("count-imports")
    .argument(
        "<source-paths...>",
        "Paths to directories with source files to process"
    )
    .description("Count the number of imports of each symbol")
    .action(async (sourceFilePaths) => {
        countImports(sourceFilePaths);
    });

program
    .command("remove-re-exports")
    .argument(
        "<source-paths...>",
        "Paths to directories with source files to process"
    )
    .description("Remove re-exports of symbols")
    .action(async (sourceFilePaths) => {
        removeReExports(sourceFilePaths);
    });

program
    .command("find-unused-exports")
    .argument("<repo-path>", "Path to the Glide repository")
    .description("Naively finds all names that are exported but not imported")
    .action(async (repoPath) => {
        findUnusedExports(repoPath);
    });

await program.parseAsync(process.argv);
