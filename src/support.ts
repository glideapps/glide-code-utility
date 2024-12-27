import fs from "fs";
import path from "path";

export async function walkDirectory(
    dir: string,
    processFile: (path: string) => Promise<void>
): Promise<void> {
    for (const file of fs.readdirSync(dir)) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            await walkDirectory(filePath, processFile);
        } else {
            await processFile(filePath);
        }
    }
}

export function isTSFile(filename: string) {
    return filename.endsWith(".ts") || filename.endsWith(".tsx");
}
