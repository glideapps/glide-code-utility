import { Command } from "commander";
import { findUnusedPackages } from "./find-unused-packages";
import { moveFilePackage } from "./move-file-package";

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

await program.parseAsync(process.argv);
