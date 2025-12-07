import { describe, expect, it } from "bun:test";
import {
  AsyncQueue,
  QueueCompleteSentinel,
  QueueEventWrapper,
  queueEventIterator
} from "../src/helpers/async-queue";
import type { ThreadStreamEvent } from "../src/types";

describe("AsyncQueue", () => {
  it("enqueues and dequeues items in order", async () => {
    const queue = new AsyncQueue<number>();
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.complete(); // Must complete to signal end of queue

    const items: number[] = [];
    for await (const item of queue) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3]);
  });

  it("handles async consumption", async () => {
    const queue = new AsyncQueue<string>();
    
    // Start consuming before enqueuing
    const consumer = (async () => {
      const items: string[] = [];
      for await (const item of queue) {
        items.push(item);
        if (items.length === 3) {
          queue.complete();
        }
      }
      return items;
    })();

    // Enqueue items after consumer starts
    await new Promise(resolve => setTimeout(resolve, 10));
    queue.enqueue("a");
    await new Promise(resolve => setTimeout(resolve, 10));
    queue.enqueue("b");
    await new Promise(resolve => setTimeout(resolve, 10));
    queue.enqueue("c");

    const items = await consumer;
    expect(items).toEqual(["a", "b", "c"]);
  });

  it("returns done when queue is completed", async () => {
    const queue = new AsyncQueue<number>();
    queue.enqueue(1);
    queue.complete();

    const items: number[] = [];
    for await (const item of queue) {
      items.push(item);
    }

    expect(items).toEqual([1]);
  });

  it("ignores enqueue after completion", async () => {
    const queue = new AsyncQueue<number>();
    queue.enqueue(1);
    queue.complete();
    queue.enqueue(2); // Should be ignored

    const items: number[] = [];
    for await (const item of queue) {
      items.push(item);
    }

    expect(items).toEqual([1]);
  });

  it("handles multiple pending consumers", async () => {
    const queue = new AsyncQueue<number>();
    
    const consumer1 = (async () => {
      const items: number[] = [];
      for await (const item of queue) {
        items.push(item);
        if (items.length === 2) break;
      }
      return items;
    })();

    const consumer2 = (async () => {
      const items: number[] = [];
      for await (const item of queue) {
        items.push(item);
        if (items.length === 2) break;
      }
      return items;
    })();

    // Enqueue items
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    queue.enqueue(4);
    queue.complete();

    const items1 = await consumer1;
    const items2 = await consumer2;

    // Each consumer should get different items
    expect(items1.length).toBe(2);
    expect(items2.length).toBe(2);
    expect([...items1, ...items2].sort()).toEqual([1, 2, 3, 4]);
  });

  it("handles empty queue completion", async () => {
    const queue = new AsyncQueue<number>();
    queue.complete();

    const items: number[] = [];
    for await (const item of queue) {
      items.push(item);
    }

    expect(items).toEqual([]);
  });

  it("resolves pending promises when completed", async () => {
    const queue = new AsyncQueue<number>();
    
    const consumer = (async () => {
      const items: number[] = [];
      for await (const item of queue) {
        items.push(item);
      }
      return items;
    })();

    // Wait a bit for consumer to start waiting
    await new Promise(resolve => setTimeout(resolve, 10));
    
    queue.enqueue(1);
    queue.complete();

    const items = await consumer;
    expect(items).toEqual([1]);
  });

  it("handles multiple complete calls", () => {
    const queue = new AsyncQueue<number>();
    queue.enqueue(1);
    queue.complete();
    queue.complete(); // Should be no-op
    queue.complete(); // Should be no-op

    expect(() => queue.complete()).not.toThrow();
  });
});

describe("QueueCompleteSentinel", () => {
  it("can be instantiated", () => {
    const sentinel = new QueueCompleteSentinel();
    expect(sentinel).toBeInstanceOf(QueueCompleteSentinel);
  });

  it("can be used as a queue item", () => {
    const queue = new AsyncQueue<QueueCompleteSentinel | number>();
    const sentinel = new QueueCompleteSentinel();
    queue.enqueue(1);
    queue.enqueue(sentinel);
    queue.enqueue(2);
    queue.complete();

    // This should work without errors
    expect(sentinel).toBeDefined();
  });
});

describe("QueueEventWrapper", () => {
  it("wraps queue items", () => {
    const event: ThreadStreamEvent = {
      type: "thread.item.added",
      item: {
        type: "widget",
        id: "widget_1",
        thread_id: "thr_1",
        created_at: new Date(),
        widget: { type: "Card", children: [] }
      }
    };

    const wrapper = new QueueEventWrapper(event);
    expect(wrapper.event).toBe(event);
  });

  it("wraps QueueCompleteSentinel", () => {
    const sentinel = new QueueCompleteSentinel();
    const wrapper = new QueueEventWrapper(sentinel);
    expect(wrapper.event).toBe(sentinel);
  });
});

describe("queueEventIterator", () => {
  it("wraps all queue items", async () => {
    async function* generateEvents(): AsyncIterable<ThreadStreamEvent | QueueCompleteSentinel> {
      yield {
        type: "thread.item.added",
        item: {
          type: "widget",
          id: "widget_1",
          thread_id: "thr_1",
          created_at: new Date(),
          widget: { type: "Card", children: [] }
        }
      };
      yield new QueueCompleteSentinel();
    }

    const wrappers: QueueEventWrapper[] = [];
    for await (const wrapper of queueEventIterator(generateEvents())) {
      wrappers.push(wrapper);
    }

    expect(wrappers).toHaveLength(2);
    expect(wrappers[0]).toBeInstanceOf(QueueEventWrapper);
    expect(wrappers[0].event.type).toBe("thread.item.added");
    expect(wrappers[1]).toBeInstanceOf(QueueEventWrapper);
    expect(wrappers[1].event).toBeInstanceOf(QueueCompleteSentinel);
  });

  it("handles empty iterable", async () => {
    async function* generateEvents(): AsyncIterable<ThreadStreamEvent | QueueCompleteSentinel> {
      // No events
    }

    const wrappers: QueueEventWrapper[] = [];
    for await (const wrapper of queueEventIterator(generateEvents())) {
      wrappers.push(wrapper);
    }

    expect(wrappers).toHaveLength(0);
  });

  it("works with AsyncQueue", async () => {
    const queue = new AsyncQueue<ThreadStreamEvent | QueueCompleteSentinel>();
    queue.enqueue({
      type: "thread.item.done",
      item: {
        type: "widget",
        id: "widget_1",
        thread_id: "thr_1",
        created_at: new Date(),
        widget: { type: "Card", children: [] }
      }
    });
    queue.complete();

    const wrappers: QueueEventWrapper[] = [];
    for await (const wrapper of queueEventIterator(queue)) {
      wrappers.push(wrapper);
    }

    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]).toBeInstanceOf(QueueEventWrapper);
    if (wrappers[0].event.type === "thread.item.done") {
      expect(wrappers[0].event.item.id).toBe("widget_1");
    }
  });
});

