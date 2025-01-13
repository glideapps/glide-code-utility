import fs from "fs";
import path from "path";

export async function walkDirectory(
    dirOrFilePath: string,
    processFile: (path: string) => Promise<void>
): Promise<void> {
    if (!fs.existsSync(dirOrFilePath)) return;

    // Is `dir` actually a normal file?
    if (fs.statSync(dirOrFilePath).isFile()) {
        await processFile(dirOrFilePath);
    } else {
        for (const file of fs.readdirSync(dirOrFilePath)) {
            const filePath = path.join(dirOrFilePath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) {
                await walkDirectory(filePath, processFile);
            } else {
                await processFile(filePath);
            }
        }
    }
}

export function isTSFile(filename: string) {
    return filename.endsWith(".ts") || filename.endsWith(".tsx");
}
