import * as fs from "fs";
import { parseImports, unparseImports } from "./parse-imports";
import { isTSFile, walkDirectory } from "./support";

export function test(path: string) {
    walkDirectory(path, (filePath) => {
        if (!isTSFile(filePath)) return;

        const content = fs.readFileSync(filePath, "utf8");

        const parts = parseImports(content);

        // console.log(JSON.stringify(parts, null, 4));

        fs.writeFileSync(filePath, unparseImports(parts), "utf8");
    });
}
