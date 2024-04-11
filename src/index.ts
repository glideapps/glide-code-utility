import { Command } from "commander";
import { findUnusedPackages } from "./find-unused-packages";
import { moveFilePackage } from "./move-file-package";
import { barrelExport } from "./barrel-export";
import { countDependencyImports } from "./count-dependency-imports";
import { rewriteImports } from "./rewrite-imports";
import { dedupImports } from "./dedup-imports";

const program = new Command();

program
    .command("find-unused-packages")
    .description("Find unused packages in a project directory")
    .argument("[directory]", "Directory that has the package.json file")
    .option("-r, --remove", "Remove unused packages from package.json")
    .action((dir, options) => {
        findUnusedPackages(dir ?? process.cwd(), options.remove);
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
    .description(
        "Rewrites multiple imports of the same package to a single import"
    )
    .action(async (sourcePaths) => {
        dedupImports(sourcePaths);
    });

await program.parseAsync(process.argv);
