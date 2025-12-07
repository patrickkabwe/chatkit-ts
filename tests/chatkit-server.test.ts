import { describe, it, expect } from "bun:test";
import { ChatKitServer } from "../src/server";
import { Store } from "../src/store";
import type {
  Attachment,
  AssistantMessageContent,
  AssistantMessageItem,
  Page,
  SDKHiddenContextItem,
  ThreadItem,
  ThreadMetadata
} from "../src/types";

// NOTE: This file contains tests for the ChatKitServer implementation.

describe("ChatKitServer", () => {
  it("persists pending assistant message and hidden context on stream cancellation", async () => {
    const addedItems: any[] = [];

    class TestStore extends Store {
      async addThreadItem(_threadId: string, item: any): Promise<void> {
        addedItems.push(item);
      }

      generateItemId(): string {
        return "shcx_test";
      }

      // Minimal implementations to satisfy the abstract Store interface.
      // These are not exercised by this test.
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadThread(): Promise<ThreadMetadata> {
        throw new Error("loadThread not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async saveThread(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadThreadItems(): Promise<Page<ThreadItem>> {
        throw new Error("loadThreadItems not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async saveAttachment(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadAttachment(): Promise<Attachment> {
        throw new Error("loadAttachment not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async deleteAttachment(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadThreads(): Promise<Page<ThreadMetadata>> {
        throw new Error("loadThreads not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async saveItem(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadItem(): Promise<ThreadItem> {
        throw new Error("loadItem not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async deleteThread(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async deleteThreadItem(): Promise<void> {
        return;
      }
    }

    class TestChatKitServer extends ChatKitServer {
      // eslint-disable-next-line @typescript-eslint/require-await
      async *respond(): AsyncGenerator<never, void, unknown> {
        // Not used in this test.
      }
    }

    const store = new TestStore();
    const server = new TestChatKitServer(store);

    const thread: ThreadMetadata = {
      id: "thr_test",
      created_at: new Date()
    };

    const pendingAssistant: AssistantMessageItem = {
      type: "assistant_message",
      id: "assistant-message-pending",
      thread_id: thread.id,
      created_at: new Date(),
      content: [{ type: "output_text", text: "Hello, ", annotations: [] }]
    };

    await server.handleStreamCancelled(thread, [pendingAssistant], {});

    // One non-empty assistant message plus one hidden context item
    expect(addedItems).toHaveLength(2);

    const assistantMessage = addedItems.find(
      item => (item as AssistantMessageItem).type === "assistant_message"
    ) as AssistantMessageItem | undefined;
    expect(assistantMessage).toBeDefined();
    expect(
      (assistantMessage?.content[0] as AssistantMessageContent).text
    ).toBe("Hello, ");

    const hiddenContext = addedItems.find(
      item => (item as SDKHiddenContextItem).type === "sdk_hidden_context"
    ) as SDKHiddenContextItem | undefined;

    expect(hiddenContext).toBeDefined();
    expect(hiddenContext?.thread_id).toBe(thread.id);
    expect(hiddenContext?.content).toBe(
      "The user cancelled the stream. Stop responding to the prior request."
    );
  });
  it("does not persist empty pending assistant message on cancellation", async () => {
    const addedItems: any[] = [];

    class TestStore extends Store {
      async addThreadItem(_threadId: string, item: any): Promise<void> {
        addedItems.push(item);
      }

      generateItemId(): string {
        return "shcx_test";
      }

      // Minimal abstract method stubs (not used in this test).
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadThread(): Promise<ThreadMetadata> {
        throw new Error("loadThread not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async saveThread(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadThreadItems(): Promise<Page<ThreadItem>> {
        throw new Error("loadThreadItems not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async saveAttachment(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadAttachment(): Promise<Attachment> {
        throw new Error("loadAttachment not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async deleteAttachment(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadThreads(): Promise<Page<ThreadMetadata>> {
        throw new Error("loadThreads not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async saveItem(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async loadItem(): Promise<ThreadItem> {
        throw new Error("loadItem not implemented in TestStore");
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async deleteThread(): Promise<void> {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/require-await
      async deleteThreadItem(): Promise<void> {
        return;
      }
    }

    class TestChatKitServer extends ChatKitServer {
      // eslint-disable-next-line @typescript-eslint/require-await
      async *respond(): AsyncGenerator<never, void, unknown> {
        // Not used in this test.
      }
    }

    const store = new TestStore();
    const server = new TestChatKitServer(store);

    const thread: ThreadMetadata = {
      id: "thr_test_empty",
      created_at: new Date()
    };

    const emptyAssistant: AssistantMessageItem = {
      type: "assistant_message",
      id: "assistant-message-empty",
      thread_id: thread.id,
      created_at: new Date(),
      content: [{ type: "output_text", text: "   ", annotations: [] }]
    };

    await server.handleStreamCancelled(thread, [emptyAssistant], {});

    // Only the hidden context item should be persisted, not the empty assistant message.
    expect(addedItems).toHaveLength(1);
    const [hiddenContext] = addedItems as SDKHiddenContextItem[];
    expect(hiddenContext.type).toBe("sdk_hidden_context");
    expect(hiddenContext.thread_id).toBe(thread.id);
    expect(hiddenContext.content).toBe(
      "The user cancelled the stream. Stop responding to the prior request."
    );

    const assistantMessage = addedItems.find(
      item => (item as AssistantMessageItem).type === "assistant_message"
    );
    expect(assistantMessage).toBeUndefined();
  });
});

