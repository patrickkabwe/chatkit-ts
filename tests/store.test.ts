import { describe, expect, it } from "bun:test";
import {
  defaultGenerateId,
  NotFoundError,
  type StoreItemType,
  Store
} from "../src/store";
import type {
  AssistantMessageItem,
  Attachment,
  InferenceOptions,
  Page,
  ThreadItem,
  ThreadMetadata,
  UserMessageItem,
  UserMessageTextContent,
  WidgetItem
} from "../src/types";

interface RequestContext {
  userId: string;
}

function makeThread(
  threadId = "test_thread",
  createdAt: Date | null = null
): ThreadMetadata {
  const created = createdAt ?? new Date();
  return {
    id: threadId,
    title: "Test Thread",
    created_at: created,
    metadata: { test: "test" }
  };
}

function makeThreadItems(): ThreadItem[] {
  const now = new Date();

  const userMsg: UserMessageItem = {
    type: "user_message",
    id: "msg_100000",
    content: [{ text: "Hello!" }],
    attachments: [],
    inference_options: {},
    thread_id: "test_thread",
    created_at: now
  };

  const assistantMsg: AssistantMessageItem = {
    type: "assistant_message",
    id: "msg_000001",
    content: [{ type: "output_text", text: "Hi there!", annotations: [] }],
    thread_id: "test_thread",
    created_at: new Date(now.getTime() + 1000)
  };

  const widget: WidgetItem = {
    id: "widget_1",
    type: "widget",
    thread_id: "test_thread",
    created_at: new Date(now.getTime() + 2000),
    widget: {
      type: "Card",
      children: [
        {
          type: "Col",
          padding: { x: 4, y: 3 },
          border: { bottom: 1 },
          children: [
            {
              type: "Text",
              value: "Title",
              weight: "medium",
              size: "sm",
              color: "secondary"
            },
            {
              type: "Text",
              value: "test"
            }
          ]
        }
      ]
    }
  };

  return [userMsg, assistantMsg, widget];
}

const DEFAULT_CONTEXT: RequestContext = { userId: "test_user" };
const ALTERNATIVE_CONTEXT: RequestContext = { userId: "alternative_user" };

type ThreadRow = {
  thread: ThreadMetadata;
  createdAt: Date;
  userId: string;
};

type ItemRow = {
  item: ThreadItem;
  threadId: string;
  createdAt: Date;
  userId: string;
};

type AttachmentRow = {
  attachment: Attachment;
  userId: string;
};

class InMemoryStore extends Store<RequestContext> {
  private threads = new Map<string, ThreadRow>();
  private items = new Map<string, ItemRow>();
  private attachments = new Map<string, AttachmentRow>();

  async loadThread(
    threadId: string,
    context: RequestContext
  ): Promise<ThreadMetadata> {
    const row = this.threads.get(threadId);
    if (!row || row.userId !== context.userId) {
      throw new NotFoundError(`Thread ${threadId} not found`);
    }
    return row.thread;
  }

  async saveThread(
    thread: ThreadMetadata,
    context: RequestContext
  ): Promise<void> {
    this.threads.set(thread.id, {
      thread,
      createdAt: new Date(thread.created_at),
      userId: context.userId
    });
  }

  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: "asc" | "desc",
    context: RequestContext
  ): Promise<Page<ThreadItem>> {
    let createdAfter: number | null = null;
    if (after) {
      const row = this.items.get(after);
      if (!row || row.userId !== context.userId) {
        throw new NotFoundError(`Item ${after} not found`);
      }
      createdAfter = row.createdAt.getTime();
    }

    const allItems = Array.from(this.items.values()).filter(
      row => row.threadId === threadId && row.userId === context.userId
    );

    allItems.sort((a, b) =>
      order === "asc"
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime()
    );

    const filtered = createdAfter
      ? allItems.filter(row =>
          order === "asc"
            ? row.createdAt.getTime() > createdAfter
            : row.createdAt.getTime() < createdAfter
        )
      : allItems;

    const slice = filtered.slice(0, limit + 1);
    const hasMore = slice.length > limit;
    const dataRows = hasMore ? slice.slice(0, limit) : slice;
    const data = dataRows.map(r => r.item);
    const nextAfter = hasMore ? dataRows[dataRows.length - 1]!.item.id : null;

    return { data, has_more: hasMore, after: nextAfter };
  }

  async saveAttachment(
    attachment: Attachment,
    context: RequestContext
  ): Promise<void> {
    this.attachments.set(attachment.id, {
      attachment,
      userId: context.userId
    });
  }

  async loadAttachment(
    attachmentId: string,
    _context: RequestContext
  ): Promise<Attachment> {
    const row = this.attachments.get(attachmentId);
    if (!row) {
      throw new NotFoundError(`File ${attachmentId} not found`);
    }
    return row.attachment;
  }

  async deleteAttachment(
    attachmentId: string,
    context: RequestContext
  ): Promise<void> {
    const row = this.attachments.get(attachmentId);
    if (row && row.userId === context.userId) {
      this.attachments.delete(attachmentId);
    }
  }

  async loadThreads(
    limit: number,
    after: string | null,
    order: "asc" | "desc",
    context: RequestContext
  ): Promise<Page<ThreadMetadata>> {
    let createdAfter: number | null = null;
    if (after) {
      const row = this.threads.get(after);
      if (!row || row.userId !== context.userId) {
        throw new NotFoundError(`Thread ${after} not found`);
      }
      createdAfter = row.createdAt.getTime();
    }

    const allThreads = Array.from(this.threads.values()).filter(
      row => row.userId === context.userId
    );

    allThreads.sort((a, b) =>
      order === "asc"
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : b.createdAt.getTime() - a.createdAt.getTime()
    );

    const filtered = createdAfter
      ? allThreads.filter(row =>
          order === "asc"
            ? row.createdAt.getTime() > createdAfter
            : row.createdAt.getTime() < createdAfter
        )
      : allThreads;

    const slice = filtered.slice(0, limit + 1);
    const hasMore = slice.length > limit;
    const dataRows = hasMore ? slice.slice(0, limit) : slice;
    const data = dataRows.map(r => r.thread);
    const nextAfter = hasMore ? dataRows[dataRows.length - 1]!.thread.id : null;

    return { data, has_more: hasMore, after: nextAfter };
  }

  async addThreadItem(
    threadId: string,
    item: ThreadItem,
    context: RequestContext
  ): Promise<void> {
    const createdAt = item.created_at ?? new Date();
    this.items.set(item.id, {
      item,
      threadId,
      createdAt,
      userId: context.userId
    });
  }

  async saveItem(
    threadId: string,
    item: ThreadItem,
    context: RequestContext
  ): Promise<void> {
    const existing = this.items.get(item.id);
    if (!existing || existing.threadId !== threadId) {
      throw new NotFoundError(
        `Item ${item.id} not found in thread ${threadId}`
      );
    }
    this.items.set(item.id, {
      item,
      threadId,
      createdAt: existing.createdAt,
      userId: context.userId
    });
  }

  async loadItem(
    threadId: string,
    itemId: string,
    context: RequestContext
  ): Promise<ThreadItem> {
    const row = this.items.get(itemId);
    if (!row || row.threadId !== threadId || row.userId !== context.userId) {
      throw new NotFoundError(
        `Item ${itemId} not found in thread ${threadId}`
      );
    }
    return row.item;
  }

  async deleteThread(
    threadId: string,
    context: RequestContext
  ): Promise<void> {
    const row = this.threads.get(threadId);
    if (!row || row.userId !== context.userId) {
      return;
    }
    this.threads.delete(threadId);
    for (const [id, itemRow] of Array.from(this.items.entries())) {
      if (itemRow.threadId === threadId && itemRow.userId === context.userId) {
        this.items.delete(id);
      }
    }
  }

  async deleteThreadItem(
    threadId: string,
    itemId: string,
    context: RequestContext
  ): Promise<void> {
    const row = this.items.get(itemId);
    if (!row || row.threadId !== threadId || row.userId !== context.userId) {
      return;
    }
    this.items.delete(itemId);
  }
}

class CustomInMemoryStore extends InMemoryStore {
  private counter = 0;

  override generateThreadId(_context: RequestContext): string {
    this.counter += 1;
    return `thr_custom_${this.counter}`;
  }

  override generateItemId(
    itemType: StoreItemType,
    thread: ThreadMetadata,
    _context: RequestContext
  ): string {
    this.counter += 1;
    return `${itemType}_custom_${this.counter}_${thread.id}`;
  }
}

describe("InMemoryStore basic behavior", () => {
  it("save and load thread metadata", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    await store.saveThread(thread, DEFAULT_CONTEXT);
    const loaded = await store.loadThread(thread.id, DEFAULT_CONTEXT);
    expect(loaded.id).toBe(thread.id);
    expect(loaded.title).toBe(thread.title);
    expect(loaded.metadata).toEqual(thread.metadata);
  });

  it("save and load thread metadata with null title", async () => {
    const store = new InMemoryStore();
    const thread: ThreadMetadata = {
      id: "test_thread",
      title: null,
      created_at: new Date(),
      metadata: { test: "test" }
    };
    await store.saveThread(thread, DEFAULT_CONTEXT);
    const loaded = await store.loadThread(thread.id, DEFAULT_CONTEXT);
    expect(loaded.id).toBe(thread.id);
    expect(loaded.title).toBeNull();
    expect(loaded.metadata).toEqual(thread.metadata);
  });

  it("update thread metadata", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    await store.saveThread(thread, DEFAULT_CONTEXT);
    const updated = { ...thread, title: "Updated Title" };
    await store.saveThread(updated, DEFAULT_CONTEXT);
    const loaded = await store.loadThread(thread.id, DEFAULT_CONTEXT);
    expect(loaded.title).toBe("Updated Title");
  });

  it("save and load thread items", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    const items = makeThreadItems();
    await store.saveThread(thread, DEFAULT_CONTEXT);
    for (const item of items) {
      await store.addThreadItem(thread.id, item, DEFAULT_CONTEXT);
    }
    const loadedItems = (
      await store.loadThreadItems(thread.id, null, 10, "asc", DEFAULT_CONTEXT)
    ).data;
    expect(loadedItems).toEqual(items);
  });

  it("overwrite thread metadata", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    await store.saveThread(thread, DEFAULT_CONTEXT);
    const updated = { ...thread, title: "Updated Title" };
    await store.saveThread(updated, DEFAULT_CONTEXT);
    const loaded = await store.loadThread(thread.id, DEFAULT_CONTEXT);
    expect(loaded.title).toBe("Updated Title");
  });

  it("save and load file attachment", async () => {
    const store = new InMemoryStore();
    const file: Attachment = {
      id: "file_1",
      mime_type: "text/plain",
      name: "test.txt",
      type: "file",
      upload_url: null,
      preview_url: null
    };
    await store.saveAttachment(file, DEFAULT_CONTEXT);
    const loaded = await store.loadAttachment(file.id, DEFAULT_CONTEXT);
    expect(loaded).toEqual(file);
  });

  it("save and load image attachment", async () => {
    const store = new InMemoryStore();
    const image: Attachment = {
      id: "image_1",
      mime_type: "image/png",
      name: "test.png",
      type: "image",
      upload_url: null,
      preview_url: null
    };
    await store.saveAttachment(image, DEFAULT_CONTEXT);
    const loaded = await store.loadAttachment(image.id, DEFAULT_CONTEXT);
    expect(loaded).toEqual(image);
  });

  it("load_threads pagination", async () => {
    const store = new InMemoryStore();
    const now = new Date();
    const thread1 = makeThread("thread1", now);
    const thread2 = makeThread("thread2", new Date(now.getTime() + 1000));
    const thread3 = makeThread("thread3", new Date(now.getTime() + 2000));
    await store.saveThread(thread1, DEFAULT_CONTEXT);
    await store.saveThread(thread2, DEFAULT_CONTEXT);
    await store.saveThread(thread3, DEFAULT_CONTEXT);

    const page1 = await store.loadThreads(2, null, "asc", DEFAULT_CONTEXT);
    expect(page1.data.map(t => t.id)).toEqual(["thread1", "thread2"]);
    expect(page1.has_more).toBe(true);
    expect(page1.after).toBe("thread2");

    const page2 = await store.loadThreads(
      2,
      page1.data[page1.data.length - 1]!.id,
      "asc",
      DEFAULT_CONTEXT
    );
    expect(page2.data.map(t => t.id)).toEqual(["thread3"]);
    expect(page2.has_more).toBe(false);
    expect(page2.after).toBeNull();
  });

  it("thread items ordering asc/desc", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    const now = new Date();
    const items: UserMessageItem[] = [
      {
        type: "user_message",
        id: "msg1",
        content: [{ text: "A" }],
        attachments: [],
        inference_options: {},
        thread_id: thread.id,
        created_at: now
      },
      {
        type: "user_message",
        id: "msg2",
        content: [{ text: "B" }],
        attachments: [],
        inference_options: {},
        thread_id: thread.id,
        created_at: new Date(now.getTime() + 1000)
      },
      {
        type: "user_message",
        id: "msg3",
        content: [{ text: "C" }],
        attachments: [],
        inference_options: {},
        thread_id: thread.id,
        created_at: new Date(now.getTime() + 2000)
      }
    ];
    await store.saveThread(thread, DEFAULT_CONTEXT);
    for (const item of items) {
      await store.addThreadItem(thread.id, item, DEFAULT_CONTEXT);
    }

    const asc = await store.loadThreadItems(
      thread.id,
      null,
      3,
      "asc",
      DEFAULT_CONTEXT
    );
    const desc = await store.loadThreadItems(
      thread.id,
      null,
      3,
      "desc",
      DEFAULT_CONTEXT
    );
    expect(asc.data.map(i => i.id)).toEqual(["msg1", "msg2", "msg3"]);
    expect(desc.data.map(i => i.id)).toEqual(["msg3", "msg2", "msg1"]);
  });

  it("thread items offset and limit", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    const now = new Date();
    const items: UserMessageItem[] = [];
    for (let i = 0; i < 5; i += 1) {
      items.push({
        type: "user_message",
        id: `msg${i}`,
        content: [{ text: String(i) }],
        attachments: [],
        inference_options: {},
        thread_id: thread.id,
        created_at: new Date(now.getTime() + i * 1000)
      });
    }
    await store.saveThread(thread, DEFAULT_CONTEXT);
    for (const item of items) {
      await store.addThreadItem(thread.id, item, DEFAULT_CONTEXT);
    }

    const after = await store.loadThreadItems(
      thread.id,
      "msg1",
      3,
      "asc",
      DEFAULT_CONTEXT
    );
    expect(after.data.map(i => i.id)).toEqual(["msg2", "msg3", "msg4"]);
    expect(after.has_more).toBe(false);
    expect(after.after).toBeNull();

    const afterLimit = await store.loadThreadItems(
      thread.id,
      null,
      2,
      "asc",
      DEFAULT_CONTEXT
    );
    expect(afterLimit.data.map(i => i.id)).toEqual(["msg0", "msg1"]);
    expect(afterLimit.has_more).toBe(true);
    expect(afterLimit.after).toBe("msg1");
  });

  it("save and load item", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    const now = new Date();
    const assistantMsg: AssistantMessageItem = {
      type: "assistant_message",
      id: "msg_000001",
      content: [],
      thread_id: thread.id,
      created_at: now
    };
    const widget: WidgetItem = {
      id: "widget_1",
      type: "widget",
      thread_id: thread.id,
      created_at: new Date(now.getTime() + 1000),
      widget: { type: "Card", children: [{ type: "Text", value: "Test" }] }
    };
    await store.saveThread(thread, DEFAULT_CONTEXT);
    await store.addThreadItem(thread.id, assistantMsg, DEFAULT_CONTEXT);
    await store.addThreadItem(thread.id, widget, DEFAULT_CONTEXT);

    const updatedAssistant: AssistantMessageItem = {
      ...assistantMsg,
      content: [{ type: "output_text", text: "This is an assistant message.", annotations: [] }]
    };
    await store.saveItem(thread.id, updatedAssistant, DEFAULT_CONTEXT);
    const loadedAssistantItem = await store.loadItem(
      thread.id,
      assistantMsg.id,
      DEFAULT_CONTEXT
    );
    expect(loadedAssistantItem.type).toBe("assistant_message");
    if (loadedAssistantItem.type !== "assistant_message") {
      throw new Error("Expected assistant message");
    }
    const loadedAssistant = loadedAssistantItem;
    expect(loadedAssistant.id).toBe(assistantMsg.id);
    expect(loadedAssistant.content[0]).toEqual({
      type: "output_text",
      text: "This is an assistant message.",
      annotations: []
    });

    await store.saveItem(thread.id, widget, DEFAULT_CONTEXT);
    const loadedWidgetItem = await store.loadItem(
      thread.id,
      widget.id,
      DEFAULT_CONTEXT
    );
    expect(loadedWidgetItem.type).toBe("widget");
    if (loadedWidgetItem.type !== "widget") {
      throw new Error("Expected widget");
    }
    const loadedWidget = loadedWidgetItem;
    expect(loadedWidget.id).toBe(widget.id);
  });

  it("load nonexistent item throws NotFoundError", async () => {
    const store = new InMemoryStore();
    const thread = makeThread();
    await store.saveThread(thread, DEFAULT_CONTEXT);
    await expect(
      store.loadItem(thread.id, "does_not_exist", DEFAULT_CONTEXT)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("thread isolation by user", async () => {
    const store = new InMemoryStore();
    const thread = makeThread("user1_thread");
    await store.saveThread(thread, DEFAULT_CONTEXT);

    const loadedDefault = await store.loadThread(thread.id, DEFAULT_CONTEXT);
    expect(loadedDefault.title).toBe(thread.title);

    await expect(
      store.loadThread(thread.id, ALTERNATIVE_CONTEXT)
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("thread items isolation by user", async () => {
    const store = new InMemoryStore();
    const thread = makeThread("shared_thread");
    await store.saveThread(thread, DEFAULT_CONTEXT);

    const itemsDefault = makeThreadItems();
    for (const item of itemsDefault) {
      await store.addThreadItem(thread.id, item, DEFAULT_CONTEXT);
    }

    const loadedDefault = (
      await store.loadThreadItems(
        thread.id,
        null,
        10,
        "asc",
        DEFAULT_CONTEXT
      )
    ).data;
    expect(loadedDefault).toEqual(itemsDefault);

    const loadedAlternative = (
      await store.loadThreadItems(
        thread.id,
        null,
        10,
        "asc",
        ALTERNATIVE_CONTEXT
      )
    ).data;
    expect(loadedAlternative).toEqual([]);

    await expect(
      store.loadItem(thread.id, itemsDefault[0]!.id, ALTERNATIVE_CONTEXT)
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("defaultGenerateId prefixes", () => {
  it("uses expected prefixes for each StoreItemType", () => {
    const types: StoreItemType[] = [
      "thread",
      "message",
      "tool_call",
      "task",
      "workflow",
      "attachment",
      "sdk_hidden_context"
    ];

    for (const type of types) {
      const id = defaultGenerateId(type);
      expect(id).toMatch(/^[a-z]{2,4}_[0-9a-f]+$/);
    }
  });
});

describe("InMemoryStore ID generators", () => {
  it("default generators use default prefixes", () => {
    const store = new InMemoryStore();
    const ctx = DEFAULT_CONTEXT;
    const threadId = store.generateThreadId(ctx);
    expect(threadId.startsWith("thr_")).toBe(true);

    const thread = makeThread(threadId);
    expect(store.generateItemId("message", thread, ctx).startsWith("msg_")).toBe(
      true
    );
    expect(store.generateItemId("tool_call", thread, ctx).startsWith("tc_")).toBe(
      true
    );
    expect(store.generateItemId("task", thread, ctx).startsWith("tsk_")).toBe(
      true
    );
    expect(
      store.generateItemId("workflow", thread, ctx).startsWith("wf_")
    ).toBe(true);
  });

  it("overridden generators are used", () => {
    const store = new CustomInMemoryStore();
    const ctx = DEFAULT_CONTEXT;
    const threadId = store.generateThreadId(ctx);
    expect(threadId).toBe("thr_custom_1");

    const thread = makeThread(threadId);
    const msgId = store.generateItemId("message", thread, ctx);
    const toolCallId = store.generateItemId("tool_call", thread, ctx);
    const taskId = store.generateItemId("task", thread, ctx);

    expect(msgId).toBe("message_custom_2_thr_custom_1");
    expect(toolCallId).toBe("tool_call_custom_3_thr_custom_1");
    expect(taskId).toBe("task_custom_4_thr_custom_1");

    const thread2 = makeThread(store.generateThreadId(ctx));
    expect(thread2.id).toBe("thr_custom_5");

    const msgId2 = store.generateItemId("message", thread2, ctx);
    const toolCallId2 = store.generateItemId("tool_call", thread2, ctx);
    const taskId2 = store.generateItemId("task", thread2, ctx);

    expect(msgId2).toBe("message_custom_6_thr_custom_5");
    expect(toolCallId2).toBe("tool_call_custom_7_thr_custom_5");
    expect(taskId2).toBe("task_custom_8_thr_custom_5");
  });
});

describe("AttachmentStore", () => {
  it("generateAttachmentId returns attachment ID", () => {
    const { AttachmentStore } = require("../src/store");
    
    class TestAttachmentStore extends AttachmentStore {
      async deleteAttachment(): Promise<void> {}
    }
    
    const store = new TestAttachmentStore();
    const id = store.generateAttachmentId("text/plain", DEFAULT_CONTEXT);
    expect(id).toMatch(/^atc_[0-9a-f]+$/);
  });

  it("createAttachment throws by default", async () => {
    const { AttachmentStore } = require("../src/store");
    
    class TestAttachmentStore extends AttachmentStore {
      async deleteAttachment(): Promise<void> {}
    }
    
    const store = new TestAttachmentStore();
    await expect(
      store.createAttachment(
        { name: "test.txt", size: 100, mime_type: "text/plain" },
        DEFAULT_CONTEXT
      )
    ).rejects.toThrow("must override createAttachment");
  });
});
