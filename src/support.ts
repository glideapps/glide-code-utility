// https://makandracards.com/makandra/15879-javascript-how-to-generate-a-regular-expression-from-a-string
export function escapeStringAsRegexp(string: string): string {
    return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}
