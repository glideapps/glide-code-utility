export function removeExport(exportedName: string, sourceCode: string): string {
    // Match patterns like:
    // - export const foo
    // - export function foo
    // - export async function foo
    // - export async function* foo<T>
    // - export type foo
    // - export interface foo
    // - export class foo
    // - export enum foo
    const exportRegex = new RegExp(
        `export\\s+` + // Match "export" followed by whitespace
            `(?:async\\s+)?` + // Optionally match "async" followed by whitespace
            `(?:const|function\\*?|type|interface|class|enum)\\s+` + // Match the declaration keyword, with optional * for generators
            `${escapeRegExp(exportedName)}` + // Match the exported name
            `(?:<[^>]*>)?\\b`, // Optionally match type parameters
        "g"
    );

    return sourceCode.replace(exportRegex, (match) => {
        // Remove the "export" keyword and any following whitespace
        return match.replace(/export\s+/, "");
    });
}

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
