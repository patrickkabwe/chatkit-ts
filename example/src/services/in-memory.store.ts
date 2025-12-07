import {
  type ThreadMetadata,
  type ThreadItem,
  type Attachment,
  type Page,
} from "../../../src";
import { Store } from "../../../src/store";

// Simple in-memory Store
export class InMemoryStore<TContext = unknown> extends Store<TContext> {
  private threads = new Map<string, ThreadMetadata & { items: ThreadItem[] }>();
  private attachments = new Map<string, Attachment>();

  async loadThread(threadId: string, _context: TContext): Promise<ThreadMetadata> {
    const thr = this.threads.get(threadId);
    if (!thr) {
      // For the demo, lazily create a thread if it does not exist yet.
      const created: ThreadMetadata & { items: ThreadItem[] } = {
        id: threadId,
        created_at: new Date(),
        items: [],
      };
      this.threads.set(threadId, created);
      return { id: created.id, created_at: created.created_at };
    }
    const { items, ...meta } = thr;
    return meta;
  }

  async saveThread(thread: ThreadMetadata, _context: TContext): Promise<void> {
    const existing = this.threads.get(thread.id);
    const items = existing?.items ?? [];
    this.threads.set(thread.id, { ...thread, items });
  }

  async loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: "asc" | "desc",
    _context: TContext,
  ): Promise<Page<ThreadItem>> {
    const thr = this.threads.get(threadId);
    const all = (thr?.items ?? []).slice();
    if (order === "desc") {
      all.reverse();
    }

    let startIndex = 0;
    if (after) {
      const idx = all.findIndex(i => i.id === after);
      if (idx >= 0) startIndex = idx + 1;
    }

    const slice = all.slice(startIndex, startIndex + limit);
    const last = slice[slice.length - 1];

    return {
      data: slice,
      has_more: startIndex + limit < all.length,
      after: last?.id ?? null,
    };
  }

  async saveAttachment(attachment: Attachment, _context: TContext): Promise<void> {
    this.attachments.set(attachment.id, attachment);
  }

  async loadAttachment(attachmentId: string, _context: TContext): Promise<Attachment> {
    const at = this.attachments.get(attachmentId);
    if (!at) throw new Error(`Attachment ${attachmentId} not found`);
    return at;
  }

  async deleteAttachment(attachmentId: string, _context: TContext): Promise<void> {
    this.attachments.delete(attachmentId);
  }

  async loadThreads(
    limit: number,
    after: string | null,
    order: "asc" | "desc",
    _context: TContext,
  ): Promise<Page<ThreadMetadata>> {
    let all = Array.from(this.threads.values()).map(({ items, ...meta }) => meta);
    all.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
    if (order === "desc") {
      all.reverse();
    }

    let startIndex = 0;
    if (after) {
      const idx = all.findIndex(t => t.id === after);
      if (idx >= 0) startIndex = idx + 1;
    }

    const slice = all.slice(startIndex, startIndex + limit);
    const last = slice[slice.length - 1];

    return {
      data: slice,
      has_more: startIndex + limit < all.length,
      after: last?.id ?? null,
    };
  }

  async addThreadItem(
    threadId: string,
    item: ThreadItem,
    _context: TContext,
  ): Promise<void> {
    const thr = this.threads.get(threadId);
    if (!thr) {
      throw new Error(`Thread ${threadId} not found`);
    }
    thr.items.push(item);
  }

  async saveItem(
    threadId: string,
    item: ThreadItem,
    _context: TContext,
  ): Promise<void> {
    const thr = this.threads.get(threadId);
    if (!thr) {
      throw new Error(`Thread ${threadId} not found`);
    }
    const idx = thr.items.findIndex(i => i.id === item.id);
    if (idx >= 0) {
      thr.items[idx] = item;
    } else {
      thr.items.push(item);
    }
  }

  async loadItem(
    threadId: string,
    itemId: string,
    _context: TContext,
  ): Promise<ThreadItem> {
    const thr = this.threads.get(threadId);
    if (!thr) {
      throw new Error(`Thread ${threadId} not found`);
    }
    const item = thr.items.find(i => i.id === itemId);
    if (!item) {
      throw new Error(`Item ${itemId} not found in thread ${threadId}`);
    }
    return item;
  }

  async deleteThread(threadId: string, _context: TContext): Promise<void> {
    this.threads.delete(threadId);
  }

  async deleteThreadItem(
    threadId: string,
    itemId: string,
    _context: TContext,
  ): Promise<void> {
    const thr = this.threads.get(threadId);
    if (!thr) return;
    thr.items = thr.items.filter(i => i.id !== itemId);
  }
}

