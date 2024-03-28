import { Command } from "commander";
import { findUnusedPackages } from "./find-unused-packages";

const program = new Command();

program
    .command("find-unused-packages")
    .description("Find unused packages in a project directory")
    .argument("[directory]", "Directory that has the package.json file")
    .option("-r, --remove", "Remove unused packages from package.json")
    .action(async (dir, options) => {
        await findUnusedPackages(dir ?? process.cwd(), options.remove);
    });

program.parse(process.argv);
