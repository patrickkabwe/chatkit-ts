import type { Attachment, Page, ThreadItem, ThreadMetadata } from "./types";

export type StoreItemType =
  | "thread"
  | "message"
  | "tool_call"
  | "task"
  | "workflow"
  | "attachment"
  | "sdk_hidden_context";

const ID_PREFIXES: Record<StoreItemType, string> = {
  thread: "thr",
  message: "msg",
  tool_call: "tc",
  workflow: "wf",
  task: "tsk",
  attachment: "atc",
  sdk_hidden_context: "shcx"
};

let idCounter = 0;

export function defaultGenerateId(itemType: StoreItemType): string {
  const prefix = ID_PREFIXES[itemType];
  idCounter += 1;
  return `${prefix}_${idCounter.toString(16)}`;
}

// --- Errors ---

export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// --- Store and AttachmentStore ---

export interface AttachmentCreateParams {
  name: string;
  size: number;
  mime_type: string;
}

export abstract class AttachmentStore<TContext = unknown> {
  abstract deleteAttachment(
    attachmentId: string,
    context: TContext
  ): Promise<void>;

  // Optional two-phase upload hook – by default this is unsupported.
  async createAttachment(
    _input: AttachmentCreateParams,
    _context: TContext
  ): Promise<Attachment> {
    throw new Error(
      `${this.constructor.name} must override createAttachment() to support two-phase file upload`
    );
  }

  generateAttachmentId(_mime_type: string, _context: TContext): string {
    return defaultGenerateId("attachment");
  }
}

export abstract class Store<TContext = unknown> {
  /**
   * Return a new identifier for a thread. Override to customize thread ID generation.
   */
  generateThreadId(_context: TContext): string {
    return defaultGenerateId("thread");
  }

  /**
   * Return a new identifier for a thread item. Override to customize item ID generation.
   */
  generateItemId(
    itemType: StoreItemType,
    _thread: ThreadMetadata,
    _context: TContext
  ): string {
    return defaultGenerateId(itemType);
  }

  abstract loadThread(
    threadId: string,
    context: TContext
  ): Promise<ThreadMetadata>;

  abstract saveThread(
    thread: ThreadMetadata,
    context: TContext
  ): Promise<void>;

  abstract loadThreadItems(
    threadId: string,
    after: string | null,
    limit: number,
    order: "asc" | "desc",
    context: TContext
  ): Promise<Page<ThreadItem>>;

  abstract saveAttachment(
    attachment: Attachment,
    context: TContext
  ): Promise<void>;

  abstract loadAttachment(
    attachmentId: string,
    context: TContext
  ): Promise<Attachment>;

  abstract deleteAttachment(
    attachmentId: string,
    context: TContext
  ): Promise<void>;

  abstract loadThreads(
    limit: number,
    after: string | null,
    order: "asc" | "desc",
    context: TContext
  ): Promise<Page<ThreadMetadata>>;

  abstract addThreadItem(
    threadId: string,
    item: ThreadItem,
    context: TContext
  ): Promise<void>;

  abstract saveItem(
    threadId: string,
    item: ThreadItem,
    context: TContext
  ): Promise<void>;

  abstract loadItem(
    threadId: string,
    itemId: string,
    context: TContext
  ): Promise<ThreadItem>;

  abstract deleteThread(
    threadId: string,
    context: TContext
  ): Promise<void>;

  abstract deleteThreadItem(
    threadId: string,
    itemId: string,
    context: TContext
  ): Promise<void>;
}

