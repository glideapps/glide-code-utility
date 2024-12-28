import { expect, describe, test } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import {
    readFileAndParseImports,
    unparseImports,
    type Parts,
} from "./parse-imports";
import { mapFilterUndefined } from "@glideapps/ts-necessities";

interface TestCase {
    readonly filePath: string;
    readonly parts: Parts;
}

function readTestCases(): readonly TestCase[] {
    // get all `*.ts` files from `../tests/`, based on this file's path
    const testsPath = path.join(__dirname, "..", "tests");
    return mapFilterUndefined(fs.readdirSync(testsPath), (f) => {
        if (!f.endsWith(".ts")) return undefined;
        const jsonPath = path.join(testsPath, f.replace(/\.ts$/, ".json"));
        const parts = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as Parts;
        return { filePath: path.join(testsPath, f), parts };
    });
}

describe("parseImports", () => {
    for (const { filePath, parts } of readTestCases()) {
        test(filePath, () => {
            const parts = readFileAndParseImports(filePath);
            expect(parts).toEqual(parts);
        });
    }
});

describe("unparseImports", () => {
    for (const { filePath, parts } of readTestCases()) {
        test(filePath, () => {
            const code = unparseImports(parts);
            const expectedCode = fs.readFileSync(filePath, "utf8");
            expect(code).toEqual(expectedCode);
        });
    }
});
