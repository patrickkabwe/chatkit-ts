import { describe, expect, it } from "vitest";
import {
  ChatKitServer,
  StreamingResult,
  NonStreamingResult
} from "../src/server";
import { Store, NotFoundError, AttachmentStore, type AttachmentCreateParams } from "../src/store";
import type {
  ThreadMetadata,
  ThreadItem,
  Page,
  Attachment,
  UserMessageInput
} from "../src/types";


// Minimal store implementation for testing
class TestStore extends Store<null> {
  private threads = new Map<string, ThreadMetadata>();
  private items = new Map<string, ThreadItem[]>();

  async loadThread(threadId: string, context: null): Promise<ThreadMetadata> {
    const thread = this.threads.get(threadId);
    if (!thread) {
      throw new NotFoundError("Thread not found");
    }
    return thread;
  }

  async saveThread(thread: ThreadMetadata, context: null): Promise<void> {
    this.threads.set(thread.id, thread);
  }

  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: "asc" | "desc",
    context: null
  ): Promise<Page<ThreadItem>> {
    const items = this.items.get(threadId) || [];
    return { data: items, has_more: false, after: null };
  }

  async saveAttachment(attachment: Attachment, context: null): Promise<void> {}

  async loadAttachment(attachmentId: string, context: null): Promise<Attachment> {
    return {
      id: attachmentId,
      type: "file",
      name: "test.txt",
      mime_type: "text/plain",
      upload_url: null,
      preview_url: null
    };
  }

  async deleteAttachment(attachmentId: string, context: null): Promise<void> {}

  async loadThreads(
    limit: number,
    after: string | null,
    order: "asc" | "desc",
    context: null
  ): Promise<Page<ThreadMetadata>> {
    return { data: Array.from(this.threads.values()), has_more: false, after: null };
  }

  async addThreadItem(threadId: string, item: ThreadItem, context: null): Promise<void> {
    const items = this.items.get(threadId) || [];
    items.push(item);
    this.items.set(threadId, items);
  }

  async saveItem(threadId: string, item: ThreadItem, context: null): Promise<void> {
    const items = this.items.get(threadId) || [];
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    this.items.set(threadId, items);
  }

  async loadItem(threadId: string, itemId: string, context: null): Promise<ThreadItem> {
    const items = this.items.get(threadId) || [];
    const item = items.find(i => i.id === itemId);
    if (!item) {
      throw new NotFoundError("Item not found");
    }
    return item;
  }

  async deleteThread(threadId: string, context: null): Promise<void> {
    this.threads.delete(threadId);
    this.items.delete(threadId);
  }

  async deleteThreadItem(threadId: string, itemId: string, context: null): Promise<void> {
    const items = this.items.get(threadId) || [];
    const filtered = items.filter(i => i.id !== itemId);
    this.items.set(threadId, filtered);
  }
}

class TestChatKitServerWithContext extends ChatKitServer<null> {
  async *respond(): AsyncGenerator<any, void, unknown> {
    // Implementation for testing
  }
}

class TestAttachmentStore extends AttachmentStore<null> {
  async deleteAttachment(attachmentId: string, context: null): Promise<void> {}

  async createAttachment(
    params: AttachmentCreateParams,
    context: null
  ): Promise<Attachment> {
    return {
      id: "att_1",
      type: params.mime_type.startsWith("image/") ? "image" : "file",
      name: params.name,
      mime_type: params.mime_type,
      upload_url: null,
      preview_url: null
    };
  }
}

describe("StreamingResult", () => {
  it("implements AsyncIterable", async () => {
    async function* generator() {
      yield new Uint8Array([1, 2, 3]);
      yield new Uint8Array([4, 5, 6]);
    }

    const result = new StreamingResult(generator());
    const chunks: Uint8Array[] = [];
    for await (const chunk of result) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3]));
    expect(chunks[1]).toEqual(new Uint8Array([4, 5, 6]));
  });

  it("exposes jsonEvents property", async () => {
    async function* generator() {
      yield new Uint8Array([1]);
    }

    const result = new StreamingResult(generator());
    expect(result.jsonEvents).toBeDefined();
    
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.jsonEvents) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
  });
});

describe("NonStreamingResult", () => {
  it("stores json result", () => {
    const json = new TextEncoder().encode('{"test": "value"}');
    const result = new NonStreamingResult(json);
    expect(result.json).toEqual(json);
  });
});

describe("ChatKitServer", () => {
  describe("constructor", () => {
    it("initializes with store", () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store);
      expect(server).toBeDefined();
    });

    it("initializes with store and attachmentStore", () => {
      const store = new TestStore();
      const attachmentStore = null;
      const server = new TestChatKitServerWithContext(store, attachmentStore);
      expect(server).toBeDefined();
    });
  });

  describe("getAttachmentStore", () => {
    it("returns attachmentStore when set", () => {
      const store = new TestStore();
      const attachmentStore = new TestAttachmentStore();
      const server = new TestChatKitServerWithContext(store, attachmentStore);
      expect(server["getAttachmentStore"]()).toBe(attachmentStore);
    });

    it("throws when attachmentStore is not set", () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store, null);
      expect(() => server["getAttachmentStore"]()).toThrow(
        "AttachmentStore is not configured"
      );
    });
  });

  describe("getStreamOptions", () => {
    it("returns default options", () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store);
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date()
      };
      const options = server.getStreamOptions(thread, null);
      expect(options).toEqual({ allow_cancel: true });
    });
  });

  describe("addFeedback", () => {
    it("is a no-op by default", async () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store);
      await expect(
        server.addFeedback("thr_1", ["item_1"], {}, null)
      ).resolves.toBeUndefined();
    });
  });

  describe("action", () => {
    it("throws by default", () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store);
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date()
      };
      // The error is thrown synchronously when action is called
      expect(() => {
        server.action(thread, {}, null, null);
      }).toThrow("The action() method must be overridden");
    });
  });

  describe("process", () => {
    it("handles string request", async () => {
      const store = new TestStore();
      class RespondingServer extends TestChatKitServerWithContext {
        async *respond(): AsyncGenerator<any, void, unknown> {
          yield { type: "thread.item.done", item: {} };
        }
      }
      const server = new RespondingServer(store);
      const request = JSON.stringify({
        type: "threads.create",
        params: { input: { content: [{ text: "Hello" }] } }
      });
      const result = await server.process(request, null);
      expect(result).toBeInstanceOf(StreamingResult);
    });

    it("handles Uint8Array request", async () => {
      const store = new TestStore();
      class RespondingServer extends TestChatKitServerWithContext {
        async *respond(): AsyncGenerator<any, void, unknown> {
          yield { type: "thread.item.done", item: {} };
        }
      }
      const server = new RespondingServer(store);
      const request = new TextEncoder().encode(
        JSON.stringify({
          type: "threads.create",
          params: { input: { content: [{ text: "Hello" }] } }
        })
      );
      const result = await server.process(request, null);
      expect(result).toBeInstanceOf(StreamingResult);
    });

    it("handles object request", async () => {
      const store = new TestStore();
      class RespondingServer extends TestChatKitServerWithContext {
        async *respond(): AsyncGenerator<any, void, unknown> {
          yield { type: "thread.item.done", item: {} };
        }
      }
      const server = new RespondingServer(store);
      const request = {
        type: "threads.create",
        params: { input: { content: [{ text: "Hello" }] } }
      };
      const result = await server.process(request, null);
      expect(result).toBeInstanceOf(StreamingResult);
    });

    it("handles non-streaming request", async () => {
      const store = new TestStore();
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date(),
        title: "Test Thread"
      };
      await store.saveThread(thread, null);
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "threads.get_by_id",
        params: { thread_id: "thr_test" }
      };
      const result = await server.process(request, null);
      expect(result).toBeInstanceOf(NonStreamingResult);
      if (result instanceof NonStreamingResult) {
        const json = JSON.parse(new TextDecoder().decode(result.json));
        expect(json.id).toBe("thr_test");
      }
    });
  });

  describe("processNonStreaming", () => {
    it("handles threads.get_by_id", async () => {
      const store = new TestStore();
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date(),
        title: "Test Thread"
      };
      await store.saveThread(thread, null);
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "threads.get_by_id",
        params: { thread_id: "thr_test" }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json.id).toBe("thr_test");
      expect(json.title).toBe("Test Thread");
    });

    it("handles threads.list", async () => {
      const store = new TestStore();
      const thread1: ThreadMetadata = {
        id: "thr_1",
        created_at: new Date(),
        title: "Thread 1"
      };
      const thread2: ThreadMetadata = {
        id: "thr_2",
        created_at: new Date(),
        title: "Thread 2"
      };
      await store.saveThread(thread1, null);
      await store.saveThread(thread2, null);
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "threads.list",
        params: { limit: 10, after: null, order: "desc" }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json.data).toHaveLength(2);
    });

    it("handles items.feedback", async () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "items.feedback",
        params: {
          thread_id: "thr_test",
          item_ids: ["item_1"],
          kind: "positive"
        }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json).toEqual({});
    });

    it("handles attachments.create", async () => {
      const store = new TestStore();
      const attachmentStore = new TestAttachmentStore();
      const server = new TestChatKitServerWithContext(store, attachmentStore);
      const request = {
        type: "attachments.create",
        params: {
          name: "test.txt",
          size: 100,
          mime_type: "text/plain"
        }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json.name).toBe("test.txt");
      expect(json.mime_type).toBe("text/plain");
    });

    it("handles attachments.create with camelCase params", async () => {
      const store = new TestStore();
      const attachmentStore = new TestAttachmentStore();
      const server = new TestChatKitServerWithContext(store, attachmentStore);
      const request = {
        type: "attachments.create",
        params: {
          name: "test.png",
          size: 200,
          mimeType: "image/png"
        }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json.mime_type).toBe("image/png");
    });

    it("handles attachments.delete", async () => {
      const store = new TestStore();
      const attachmentStore = new TestAttachmentStore();
      const server = new TestChatKitServerWithContext(store, attachmentStore);
      const request = {
        type: "attachments.delete",
        params: { attachment_id: "att_1" }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json).toEqual({});
    });

    it("handles items.list", async () => {
      const store = new TestStore();
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date(),
        title: "Test Thread"
      };
      await store.saveThread(thread, null);
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "items.list",
        params: {
          thread_id: "thr_test",
          after: null,
          limit: 10,
          order: "asc"
        }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("handles threads.update", async () => {
      const store = new TestStore();
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date(),
        title: "Old Title"
      };
      await store.saveThread(thread, null);
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "threads.update",
        params: {
          thread_id: "thr_test",
          title: "New Title"
        }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json.title).toBe("New Title");
    });

    it("handles threads.delete", async () => {
      const store = new TestStore();
      const thread: ThreadMetadata = {
        id: "thr_test",
        created_at: new Date(),
        title: "Test Thread"
      };
      await store.saveThread(thread, null);
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "threads.delete",
        params: { thread_id: "thr_test" }
      };
      const result = await server["processNonStreaming"](request, null);
      const json = JSON.parse(new TextDecoder().decode(result));
      expect(json).toEqual({});
      await expect(store.loadThread("thr_test", null)).rejects.toThrow();
    });

    it("throws on unknown request type", async () => {
      const store = new TestStore();
      const server = new TestChatKitServerWithContext(store);
      const request = {
        type: "unknown.type",
        params: {}
      };
      await expect(
        server["processNonStreaming"](request, null)
      ).rejects.toThrow("Unknown non-streaming request type");
    });
  });
});

