export type { Bar } from "foo";
export * from "foo";
export * as StarFoo from "foo";
export { Bar as Baz, type Qux } from "foo";

import "bla";

import * as StarFoo from "foo";
import type { Bar } from "foo";
import Foo, { Bar as Baz, type Qux } from "foo";
import JustFoo from "foo";
import type * as Typefoo from "foo";
import { type, as } from "foo";

export async function bla() {
    const foo = await import("foo");
}
