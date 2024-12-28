import { describe, expect, test } from "bun:test";
import {
    makeGlidePackageName,
    parseGlideImportPath,
    type GlideImportPath,
} from "./glide";

describe("parseGlideImportPath", () => {
    const cases: [string, GlideImportPath | undefined][] = [
        ["some/random/path", undefined],
        ["@other/package", undefined],
        ["", undefined],
        [
            "@glide/components",
            { packageName: "components", subpath: undefined },
        ],
        [
            "@glide/components/Button",
            { packageName: "components", subpath: "Button" },
        ],
        [
            "@glide/components/forms/Input",
            { packageName: "components", subpath: "forms/Input" },
        ],
        [
            "@glide/components/dist/js/Button",
            { packageName: "components", subpath: "Button" },
        ],
        [
            "@glide/components/dist/js/forms/Input",
            { packageName: "components", subpath: "forms/Input" },
        ],
        [
            "@glide/my-components/Button",
            { packageName: "my-components", subpath: "Button" },
        ],
        [
            "@glide/components/forms/dist/js/nested",
            { packageName: "components", subpath: "forms/dist/js/nested" },
        ],
    ];

    test.each(cases)("parseGlideImportPath(%s) -> %j", (input, expected) => {
        const actual = parseGlideImportPath(input);
        if (expected === undefined) {
            expect(actual).toBeUndefined();
        } else {
            expect(actual).toEqual(expected);
        }
    });
});

describe("makeGlidePackageName", () => {
    const cases = [
        ["components", "@glide/components"],
        ["my-package", "@glide/my-package"],
    ] as const;

    test.each(cases)("makeGlidePackageName(%s) -> %s", (input, expected) => {
        expect(makeGlidePackageName(input)).toBe(expected);
    });
});
