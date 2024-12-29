const glidePrefix = "@glide/";
const distJSPrefix = "dist/js/";

export interface GlideImportPath {
    readonly packageName: string;
    readonly subPath: string | undefined;
}

export function parseGlideImportPath(
    path: string
): GlideImportPath | undefined {
    if (!path.startsWith(glidePrefix)) return undefined;

    path = path.substring(glidePrefix.length);

    const slashIndex = path.indexOf("/");
    if (slashIndex < 0) {
        return { packageName: path, subPath: undefined };
    }

    const packageName = path.substring(0, slashIndex);
    let subPath = path.substring(slashIndex + 1);

    // Not having a `dist/js` is inconsistent, since we don't distinguish it
    // from the other subpaths, but we're only doing this in one place, for
    // `@glide/glide-plugins/client`.
    if (subPath.startsWith(distJSPrefix)) {
        subPath = subPath.substring(distJSPrefix.length);
    }

    return { packageName, subPath };
}

export function makeGlidePackageName(packageName: string) {
    return `@glide/${packageName}`;
}
