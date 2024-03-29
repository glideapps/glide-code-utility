import { Command } from "commander";
import { findUnusedPackages } from "./find-unused-packages";
import { moveFilePackage } from "./move-file-package";
import { barrelExport } from "./barrel-export";

const program = new Command();

program
    .command("find-unused-packages")
    .description("Find unused packages in a project directory")
    .argument("[directory]", "Directory that has the package.json file")
    .option("-r, --remove", "Remove unused packages from package.json")
    .action(async (dir, options) => {
        await findUnusedPackages(dir ?? process.cwd(), options.remove);
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
        await barrelExport(packageDir, directoryPaths);
    });

await program.parseAsync(process.argv);
