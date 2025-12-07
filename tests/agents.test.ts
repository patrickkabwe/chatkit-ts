import { describe, expect, it } from "vitest";
import {
  AgentContext,
  accumulateText,
  streamAgentResponse,
  ThreadItemConverter,
  type RunResultStreaming,
  type StoreLike
} from "../src/agents";
import type {
  ThreadItemAddedEvent,
  ThreadItemDoneEvent,
  ThreadItemUpdatedEvent,
  ThreadMetadata,
  ThreadStreamEvent,
  WidgetItem
} from "../src/types";
import type { Card, Text } from "../src/widgets";
import { StreamEvent } from "@openai/agents-core";

function makeThread(): ThreadMetadata {
  return {
    id: "123",
    title: "Test",
    created_at: new Date()
  };
}

function makeStore(): StoreLike<null> {
  return {
    generateThreadId: () => "thr_1",
    generateItemId: () => "msg_1",
    loadThreadItems: async () => ({ data: [] }),
    addThreadItem: async () => {}
  };
}

function makeEmptyResult(): RunResultStreaming {
  return {
    async *streamEvents(): AsyncIterable<StreamEvent> {
      // No low-level events in these initial tests.
    }
  };
}

describe("AgentContext.streamWidget + streamAgentResponse", () => {
  it("streams a single widget item (non-generator)", async () => {
    const thread = makeThread();
    const store = makeStore();
    const context = new AgentContext({
      thread,
      store,
      requestContext: null
    });
    const result = makeEmptyResult();

    const widget: Card = {
      type: "Card",
      children: [{ type: "Text", value: "Hello, world!" }]
    };

    await context.streamWidget(widget);
     // Mark the internal queue as complete so iteration can finish.
    context._complete();

    const events: ThreadStreamEvent<Card>[] = [];
    for await (const ev of streamAgentResponse({ context, result })) {
      events.push(ev);
    }

    expect(events).toHaveLength(1);
    const ev = events[0] as ThreadItemDoneEvent<Card>;
    expect(ev.type).toBe("thread.item.done");
    expect((ev.item as WidgetItem<Card>).widget).toEqual(widget);
  });

  it("streams widget items for an async generator with streaming text", async () => {
    const thread = makeThread();
    const store = makeStore();
    const context = new AgentContext({
      thread,
      store,
      requestContext: null
    });
    const result = makeEmptyResult();

    async function* widgetGenerator() {
      yield {
        type: "Card",
        children: [{ type: "Text", id: "text", value: "" }]
      } as Card;
      yield {
        type: "Card",
        children: [
          { type: "Text", id: "text", value: "Hello, world", streaming: false }
        ]
      } as Card;
    }

    await context.streamWidget(widgetGenerator());
    context._complete();

    const events: ThreadStreamEvent<Card>[] = [];
    for await (const ev of streamAgentResponse({ context, result })) {
      events.push(ev);
    }

    expect(events).toHaveLength(3);
    const added = events[0] as ThreadItemAddedEvent<Card>;
    const updated = events[1] as ThreadItemUpdatedEvent<Card>;
    const done = events[2] as ThreadItemDoneEvent<Card>;

    expect(added.type).toBe("thread.item.added");
    expect((added.item as WidgetItem<Card>).widget).toEqual({
      type: "Card",
      children: [{ type: "Text", id: "text", value: "" }]
    });

    expect(updated.type).toBe("thread.item.updated");
    if (updated.type === "thread.item.updated") {
      const update = updated.update;
      expect(update.type).toBe("widget.streaming_text.value_delta");
      if (update.type === "widget.streaming_text.value_delta") {
        expect(update.component_id).toBe("text");
        expect(update.delta).toBe("Hello, world");
      }
    }

    expect(done.type).toBe("thread.item.done");
    expect((done.item as WidgetItem<Card>).widget).toEqual({
      type: "Card",
      children: [{ type: "Text", id: "text", value: "Hello, world", streaming: false }]
    });
  });
});

describe("accumulateText", () => {
  it("collects deltas into a full string", async () => {
    async function* events(): AsyncIterable<StreamEvent> {
      yield {
        type: "raw_response_event",
        data: {
          type: "response.output_text.delta",
          delta: "Hello, "
        }
      };
      yield {
        type: "raw_response_event",
        data: {
          type: "response.output_text.delta",
          delta: "world!"
        }
      };
    }

    const base: Text = {
      type: "Text",
      value: "",
      streaming: true
    };

    const snapshots: Text[] = [];
    for await (const widget of accumulateText(events(), base)) {
      snapshots.push(widget);
    }

    expect(snapshots).toEqual([
      { type: "Text", value: "", streaming: true },
      { type: "Text", value: "Hello, ", streaming: true },
      { type: "Text", value: "Hello, world!", streaming: true },
      { type: "Text", value: "Hello, world!", streaming: false }
    ]);
  });

  it("handles empty events stream", async () => {
    async function* events(): AsyncIterable<StreamEvent> {
      // No events
    }

    const base: Text = {
      type: "Text",
      value: "initial",
      streaming: true
    };

    const snapshots: Text[] = [];
    for await (const widget of accumulateText(events(), base)) {
      snapshots.push(widget);
    }

    // accumulateText yields the base widget first, then processes events (none),
    // then yields final widget with accumulated text (empty string) and streaming: false
    expect(snapshots).toEqual([
      { type: "Text", value: "initial", streaming: true },
      { type: "Text", value: "", streaming: false }
    ]);
  });

  it("ignores non-delta events", async () => {
    async function* events(): AsyncIterable<StreamEvent> {
      yield {
        type: "raw_response_event",
        data: {
          type: "response.output_text.delta",
          delta: "Hello"
        }
      };
      yield {
        type: "other_event",
        data: {}
      } as any;
    }

    const base: Text = {
      type: "Text",
      value: "",
      streaming: true
    };

    const snapshots: Text[] = [];
    for await (const widget of accumulateText(events(), base)) {
      snapshots.push(widget);
    }

    expect(snapshots).toEqual([
      { type: "Text", value: "", streaming: true },
      { type: "Text", value: "Hello", streaming: true },
      { type: "Text", value: "Hello", streaming: false }
    ]);
  });
});

describe("AgentContext", () => {
  it("generates thread ID", () => {
    const store = makeStore();
    const context = new AgentContext({
      thread: makeThread(),
      store,
      requestContext: null
    });
    const id = context.generateId("thread");
    expect(id).toBe("thr_1");
  });

  it("generates item ID with thread", () => {
    const store = makeStore();
    const thread = makeThread();
    const context = new AgentContext({
      thread,
      store,
      requestContext: null
    });
    const id = context.generateId("message", thread);
    expect(id).toBe("msg_1");
  });

  it("generates item ID without thread (uses context thread)", () => {
    const store = makeStore();
    const thread = makeThread();
    const context = new AgentContext({
      thread,
      store,
      requestContext: null
    });
    const id = context.generateId("message");
    expect(id).toBe("msg_1");
  });

  it("handles requestContext parameter", () => {
    const store = makeStore();
    const requestContext = { userId: "user123" };
    const context = new AgentContext({
      thread: makeThread(),
      store,
      requestContext
    });
    expect(context.requestContext).toEqual(requestContext);
  });

  it("handles optional parameters", () => {
    const store = makeStore();
    const context = new AgentContext({
      thread: makeThread(),
      store,
      previousResponseId: "prev_123",
      clientToolCall: { name: "test", arguments: {} },
      workflowItem: null
    });
    expect(context.previousResponseId).toBe("prev_123");
    expect(context.clientToolCall).toEqual({ name: "test", arguments: {} });
    expect(context.workflowItem).toBeNull();
  });

  it("can manually stream events", async () => {
    const store = makeStore();
    const context = new AgentContext({
      thread: makeThread(),
      store,
      requestContext: null
    });

    const event: ThreadStreamEvent<Card> = {
      type: "thread.item.added",
      item: {
        type: "widget",
        id: "widget_1",
        thread_id: "thr_test",
        created_at: new Date(),
        widget: { type: "Card", children: [{ type: "Text", value: "Test" }] }
      }
    };

    await context.stream(event);
    context._complete();

    // Create a result that completes immediately
    const completingResult: RunResultStreaming = {
      async *streamEvents(): AsyncIterable<StreamEvent> {
        // Empty stream that completes immediately
        return;
      }
    };

    const events: ThreadStreamEvent<Card>[] = [];
    for await (const ev of streamAgentResponse({
      context,
      result: completingResult
    })) {
      events.push(ev);
    }

    // streamAgentResponse yields queued events in the finally block after result completes
    expect(events.length).toBeGreaterThanOrEqual(1);
    // The event should be in the results
    const foundEvent = events.find(e => e.type === "thread.item.added");
    expect(foundEvent).toBeDefined();
    if (foundEvent && foundEvent.type === "thread.item.added") {
      expect(foundEvent.item.id).toBe("widget_1");
    }
  });
});

describe("ThreadItemConverter", () => {
  const converter = new ThreadItemConverter();

  function makeCard(children: Text[]): Card {
    return { type: "Card", children };
  }

  it("throws on attachmentToMessageContent", async () => {
    await expect(
      converter.attachmentToMessageContent({
        id: "att_1",
        type: "file",
        name: "test.txt",
        mime_type: "text/plain"
      } as any)
    ).rejects.toThrow("Converter.attachmentToMessageContent must be implemented");
  });

  it("throws on tagToMessageContent", async () => {
    await expect(converter.tagToMessageContent({})).rejects.toThrow(
      "Converter.tagToMessageContent must be implemented"
    );
  });

  it("throws on hiddenContextToInput", async () => {
    await expect(
      converter.hiddenContextToInput({
        type: "hidden_context",
        id: "hc_1",
        thread_id: "thr_1",
        created_at: new Date(),
        content: "test"
      } as any)
    ).rejects.toThrow("HiddenContextItems require Converter.hiddenContextToInput");
  });

  it("throws on taskToInput", async () => {
    await expect(
      converter.taskToInput({
        type: "task",
        id: "task_1",
        thread_id: "thr_1",
        created_at: new Date()
      } as any)
    ).rejects.toThrow("TaskItems require Converter.taskToInput to be implemented");
  });

  it("throws on workflowToInput", async () => {
    await expect(
      converter.workflowToInput({
        type: "workflow",
        id: "wf_1",
        thread_id: "thr_1",
        created_at: new Date()
      } as any)
    ).rejects.toThrow("WorkflowItems require Converter.workflowToInput to be implemented");
  });

  it("converts widget to input", async () => {
    const widget: WidgetItem = {
      type: "widget",
      id: "widget_1",
      thread_id: "thr_1",
      created_at: new Date(),
      widget: makeCard([{ type: "Text", value: "Test" }])
    };

    const result = await converter.widgetToInput(widget);
    expect(result).toEqual({
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: expect.stringContaining("graphical UI widget")
        }
      ]
    });
  });
});
