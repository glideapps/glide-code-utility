import fs from "fs";
import path from "path";

// https://makandracards.com/makandra/15879-javascript-how-to-generate-a-regular-expression-from-a-string
export function escapeStringAsRegexp(string: string): string {
    return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

export function separateStringByMatches(
    regexp: RegExp,
    inputString: string
): readonly (string | RegExpExecArray)[] {
    let parts: (string | RegExpExecArray)[] = [];
    let match: RegExpExecArray | null;

    let lastIndex = 0;

    while ((match = regexp.exec(inputString)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        // Add part of string before the current match
        if (start > lastIndex) {
            parts.push(inputString.substring(lastIndex, start));
        }

        // Add the matched part
        parts.push(match);

        lastIndex = end;
    }

    // Add remaining part of string after the last match
    if (lastIndex < inputString.length) {
        parts.push(inputString.substring(lastIndex));
    }

    return parts;
}

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
