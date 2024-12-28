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

export async function aFunction() {
    const foo = await import("foo");
    const bar = await import(foo);
}

export const aConstant = 123;
export let aLet = 123;
export var aVar = 123;

export type AType = number;

export interface AnInterface {
    aField: number;
}

export class AClass {}

export enum AnEnum {
    A,
    B,
}

export { justAnExport, anotherExport as renamedExport };
