import type { ThreadStreamEvent } from "../types.js";

/**
 * Sentinel value used to mark queue completion.
 */
export class QueueCompleteSentinel {}

/**
 * Type for items that can be queued.
 */
export type QueueItem = ThreadStreamEvent | QueueCompleteSentinel;

/**
 * Simple async queue abstraction used for the event pipeline.
 */
export class AsyncQueue<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private resolvers: Array<(value: IteratorResult<T>) => void> = [];
  private done = false;

  enqueue(item: T): void {
    if (this.done) return;
    const resolver = this.resolvers.shift();
    if (resolver) {
      resolver({ value: item, done: false });
    } else {
      this.items.push(item);
    }
  }

  complete(): void {
    if (this.done) return;
    this.done = true;
    while (this.resolvers.length > 0) {
      const r = this.resolvers.shift();
      r?.({ value: undefined as unknown as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length > 0) {
          const value = this.items.shift() as T;
          return Promise.resolve({ value, done: false });
        }
        if (this.done) {
          return Promise.resolve({
            value: undefined as unknown as T,
            done: true
          });
        }
        return new Promise<IteratorResult<T>>(resolve => {
          this.resolvers.push(resolve);
        });
      }
    };
  }
}

/**
 * Wrapper class for queue items to distinguish them from other async iterable items.
 */
export class QueueEventWrapper {
  constructor(public readonly event: QueueItem) {}
}

/**
 * Iterator that wraps queue items in QueueEventWrapper instances.
 */
export async function* queueEventIterator(
  queue: AsyncIterable<QueueItem>
): AsyncGenerator<QueueEventWrapper, void, unknown> {
  for await (const event of queue) {
    yield new QueueEventWrapper(event);
  }
}

