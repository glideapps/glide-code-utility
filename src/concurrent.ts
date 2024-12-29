import pLimit from "p-limit";

export async function concurrentForEach<T>(
    items: Iterable<T>,
    maxConcurrent: number,
    fn: (item: T) => Promise<void>
): Promise<void> {
    const limit = pLimit(maxConcurrent);
    const promises = Array.from(items, (item) => limit(() => fn(item)));
    await Promise.all(promises);
}

export async function concurrentMap<T, R>(
    items: Iterable<T>,
    maxConcurrent: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const limit = pLimit(maxConcurrent);
    return Promise.all(Array.from(items, (item) => limit(() => fn(item))));
}
