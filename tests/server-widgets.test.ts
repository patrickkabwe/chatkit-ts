import { describe, expect, it } from "bun:test";
import { diffWidget, streamWidget } from "../src/helpers";
import type { ThreadMetadata, ThreadStreamEvent } from "../src/types";
import type { Card, Text } from "../src/widgets";

function makeThread(): ThreadMetadata {
  return {
    id: "thr_test",
    title: "Test",
    created_at: new Date()
  };
}

function makeCard(children: Text[]): Card {
  return {
    type: "Card",
    children
  };
}

describe("streamWidget", () => {
  it("returns widget item when given a single widget (non-generator)", async () => {
    const thread = makeThread();
    const widget = makeCard([{ type: "Text", value: "Hello, world!" }]);

    const events: ThreadStreamEvent<Card>[] = [];
    for await (const ev of streamWidget(thread, widget)) {
      events.push(ev);
    }

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.type).toBe("thread.item.done");
    if (event.type === "thread.item.done" && event.item.type === "widget") {
      expect(event.item.widget).toEqual(widget);
    }
  });

  it("streams widget updates for generator with streaming text", async () => {
    const thread = makeThread();

    async function* widgetGenerator(): AsyncGenerator<Card, void, unknown> {
      yield makeCard([{ type: "Text", id: "text", value: "" }]);
      yield makeCard([{ type: "Text", id: "text", value: "Hello, world", streaming: false }]);
    }

    const events: ThreadStreamEvent<Card>[] = [];
    for await (const ev of streamWidget(thread, widgetGenerator())) {
      events.push(ev);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("thread.item.added");
    expect(events[1].type).toBe("thread.item.updated");
    expect(events[2].type).toBe("thread.item.done");

    if (events[1].type === "thread.item.updated") {
      const update = events[1].update;
      expect(update.type).toBe("widget.streaming_text.value_delta");
      if (update.type === "widget.streaming_text.value_delta") {
        expect(update.component_id).toBe("text");
        expect(update.delta).toBe("Hello, world");
        expect(update.done).toBe(true);
      }
    }
  });

  it("emits full widget replace when structure changes", async () => {
    const thread = makeThread();

    async function* widgetGenerator(): AsyncGenerator<Card, void, unknown> {
      yield makeCard([{ type: "Text", id: "text", value: "Hello!" }]);
      yield makeCard([
        { type: "Text", key: "other text", value: "World!", streaming: false }
      ]);
    }

    const events: ThreadStreamEvent<Card>[] = [];
    for await (const ev of streamWidget(thread, widgetGenerator())) {
      events.push(ev);
    }

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("thread.item.added");
    expect(events[1].type).toBe("thread.item.updated");
    expect(events[2].type).toBe("thread.item.done");

    if (events[1].type === "thread.item.updated") {
      const update = events[1].update;
      expect(update.type).toBe("widget.root.updated");
      if (update.type === "widget.root.updated") {
        expect(update.widget).toEqual(
          makeCard([
            {
              type: "Text",
              key: "other text",
              value: "World!",
              streaming: false
            }
          ])
        );
      }
    }
  });
});

describe("diffWidget", () => {
  it("returns streaming text delta when value is extended", () => {
    const before = makeCard([{ type: "Text", id: "text", value: "" }]);
    const after = makeCard([
      { type: "Text", id: "text", value: "Hello, world", streaming: false }
    ]);

    const deltas = diffWidget(before, after);
    expect(deltas).toHaveLength(1);
    const [delta] = deltas;
    expect(delta.type).toBe("widget.streaming_text.value_delta");
    if (delta.type === "widget.streaming_text.value_delta") {
      expect(delta.component_id).toBe("text");
      expect(delta.delta).toBe("Hello, world");
      expect(delta.done).toBe(true);
    }
  });
});


