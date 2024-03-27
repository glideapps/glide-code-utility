import fs from "fs";
import path from "path";
import { glob } from "glob";

const dir = process.argv[2] || process.cwd();

const packageJsonPath = path.join(dir, "package.json");

if (!fs.existsSync(packageJsonPath)) {
    console.error("package.json not found in the current directory.");
    process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const dependencies = Object.keys(packageJson.dependencies || {});

const tsFiles = glob.sync(path.join(dir, "**/*.ts*"));

const usedDependencies = new Set();

// Updated regex to capture the full import path
const importExportRegex = /from\s+['"](@?[^'"]+)['"]/g;

tsFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    let match;
    while ((match = importExportRegex.exec(content)) !== null) {
        const importPath = match[1];
        const matchedDependency = dependencies.find(
            (dep) => importPath === dep || importPath.startsWith(dep + "/")
        );
        if (matchedDependency) {
            usedDependencies.add(matchedDependency);
        }
    }
});

const unusedDependencies = dependencies.filter(
    (dep) => !usedDependencies.has(dep)
);

console.log("Unused Dependencies:", unusedDependencies);
