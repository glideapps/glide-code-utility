import {
    readFileAndParseImports,
    unparseImportsAndWriteFile,
} from "./parse-imports";
import { isTSFile, walkDirectory } from "./support";

export function test(path: string) {
    walkDirectory(path, async (filePath) => {
        if (!isTSFile(filePath)) return;

        const parts = readFileAndParseImports(filePath);

        // console.log(JSON.stringify(parts, null, 4));

        unparseImportsAndWriteFile(parts, filePath, false);
    });
}
