const glidePathRexeg = /^@glide\/([^/]+)(\/dist\/js\/(.+))?$/;

interface GlideImportPath {
    readonly packageName: string;
    readonly subpath: string | undefined;
}

export function parseGlideImportPath(
    path: string
): GlideImportPath | undefined {
    const match = path.match(glidePathRexeg);
    if (match === null) return undefined;

    const packageName = match[1];
    let subpath: string | undefined = match[3];
    if (subpath === "") {
        subpath = undefined;
    }

    return { packageName, subpath };
}
