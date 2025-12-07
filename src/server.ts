import type { Store, AttachmentStore } from "./store";
import type {
    Attachment,
    AssistantMessageContent,
    AssistantMessageItem,
    AssistantMessageUpdate,
    ClientToolCallItem,
    ErrorEvent,
    HiddenContextItem,
    Page,
    SDKHiddenContextItem,
    StreamOptions,
    StreamOptionsEvent,
    Thread,
    ThreadCreatedEvent,
    ThreadItemAddedEvent,
    ThreadItemDoneEvent,
    ThreadItemRemovedEvent,
    ThreadItemReplacedEvent,
    ThreadItemUpdatedEvent,
    ThreadStreamEvent,
    ThreadUpdatedEvent,
    UserMessageInput,
    UserMessageItem,
    WidgetItem
} from "./types";
import type { ThreadMetadata, ThreadItem } from "./types";
import { logger } from "./logger";
import { CustomStreamError, StreamError } from "./errors";
import { isStreamingReq } from "./helpers";
import {
    DEFAULT_PAGE_SIZE,
    DEFAULT_ERROR_MESSAGE
} from "./constants";

// --- ChatKitServer ---

export class StreamingResult implements AsyncIterable<Uint8Array> {
    readonly jsonEvents: AsyncGenerator<Uint8Array, void, unknown>;

    constructor(stream: AsyncGenerator<Uint8Array, void, unknown>) {
        this.jsonEvents = stream;
    }

    async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
        for await (const chunk of this.jsonEvents) {
            yield chunk;
        }
    }
}

export class NonStreamingResult {
    readonly json: Uint8Array;

    constructor(result: Uint8Array) {
        this.json = result;
    }
}


export abstract class ChatKitServer<TContext = unknown> {
    protected store: Store<TContext>;
    protected attachmentStore: AttachmentStore<TContext> | null;

    constructor(
        store: Store<TContext>,
        attachmentStore: AttachmentStore<TContext> | null = null
    ) {
        this.store = store;
        this.attachmentStore = attachmentStore;
    }

    /**
     * Subclasses must implement the core response streaming logic.
     */
    abstract respond(
        thread: ThreadMetadata,
        inputUserMessage: UserMessageItem | null,
        context: TContext
    ): AsyncIterable<ThreadStreamEvent>;

    /**
     * Return the configured AttachmentStore or raise if missing.
     */
    protected getAttachmentStore(): AttachmentStore<TContext> {
        if (!this.attachmentStore) {
            throw new Error(
                "AttachmentStore is not configured. Provide an AttachmentStore to ChatKitServer to handle file operations."
            );
        }
        return this.attachmentStore;
    }

    /**
     * Hook for adding feedback about items. Override in subclasses.
     */
    async addFeedback(
        _threadId: string,
        _itemIds: string[],
        _feedback: any,
        _context: TContext
    ): Promise<void> {
        // Default implementation is a no-op.
    }

    /**
     * React to custom widget actions. Override in subclasses.
     */
    action(
        _thread: ThreadMetadata,
        _action: any,
        _sender: WidgetItem | null,
        _context: TContext
    ): AsyncIterable<ThreadStreamEvent> {
        throw new Error(
            "The action() method must be overridden to react to actions."
        );
    }

    /**
     * Return stream-level runtime options. Allows the user to cancel the stream
     * by default. Override this method to customize behavior.
     */
    getStreamOptions(_thread: ThreadMetadata, _context: TContext): StreamOptions {
        return { allow_cancel: true };
    }

    /**
     * Perform custom cleanup / stop inference when a stream is cancelled.
     *
     * The default implementation persists any non-empty pending assistant
     * messages to the thread and appends a hidden SDK context item indicating
     * that the stream was cancelled.
     */
    async handleStreamCancelled(
        thread: ThreadMetadata,
        pendingItems: ThreadItem[],
        context: TContext
    ): Promise<void> {
        const pendingAssistantMessages: AssistantMessageItem[] = pendingItems.filter(
            (item): item is AssistantMessageItem =>
                (item as AssistantMessageItem)?.type === "assistant_message"
        );

        for (const item of pendingAssistantMessages) {
            const isEmpty =
                item.content.length === 0 ||
                item.content.every(
                    (content: AssistantMessageContent) => !content.text?.trim()
                );
            if (!isEmpty) {
                await this.store.addThreadItem(thread.id, item, context);
            }
        }

        const hiddenContextItem: SDKHiddenContextItem = {
            type: "sdk_hidden_context",
            thread_id: thread.id,
            created_at: new Date(),
            id: this.store.generateItemId("sdk_hidden_context", thread, context),
            content:
                "The user cancelled the stream. Stop responding to the prior request."
        };

        await this.store.addThreadItem(thread.id, hiddenContextItem, context);
    }

    /**
     * Entry point for processing a ChatKit request payload.
     *
     * Accepts either a JSON string/bytes or a pre-parsed object with a `type`
     * discriminator.
     */
    async process(
        request: string | Uint8Array | any,
        context: TContext
    ): Promise<StreamingResult | NonStreamingResult> {
        let parsedRequest: any;

        if (typeof request === "string") {
            parsedRequest = JSON.parse(request);
        } else if (request instanceof Uint8Array) {
            parsedRequest = JSON.parse(new TextDecoder().decode(request));
        } else {
            parsedRequest = request;
        }

        if (isStreamingReq(parsedRequest)) {
            return new StreamingResult(
                this.processStreaming(parsedRequest, context)
            );
        }
        return new NonStreamingResult(
            await this.processNonStreaming(parsedRequest, context)
        );
    }

    /**
     * Handle non-streaming requests (e.g. list threads, get thread by id).
     */
    protected async processNonStreaming(
        request: any,
        context: TContext
    ): Promise<Uint8Array> {
        switch (request.type) {
            case "threads.get_by_id": {
                const thread = await this.loadFullThread(
                    request.params.thread_id,
                    context
                );
                return this.serialize(this.toThreadResponse(thread));
            }
            case "threads.list": {
                const params = request.params ?? {};
                const threads = await this.store.loadThreads(
                    params.limit ?? DEFAULT_PAGE_SIZE,
                    params.after ?? null,
                    params.order ?? "desc",
                    context
                );
                const page: Page<Thread> = {
                    has_more: threads.has_more,
                    after: threads.after,
                    data: threads.data.map(thread => this.toThreadResponse(thread))
                };
                return this.serialize(page);
            }
            case "items.feedback": {
                await this.addFeedback(
                    request.params.thread_id,
                    request.params.item_ids,
                    request.params.kind,
                    context
                );
                return new TextEncoder().encode("{}");
            }
            case "attachments.create": {
                const attachmentStore = this.getAttachmentStore();
                // Normalize params - handle both camelCase and snake_case
                const params = {
                    name: request.params.name,
                    size: request.params.size ?? 0,
                    mime_type: request.params.mimeType ?? request.params.mime_type
                };
                const attachment = await attachmentStore.createAttachment(
                    params,
                    context
                );
                const mime_type = attachment.mime_type;
                if (!mime_type) {
                    throw new Error("Attachment mime_type is required");
                }
                const isImage =
                    (attachment as Attachment).type === "image" ||
                    mime_type.startsWith("image/");
                const attachmentWithDefaults: Attachment = {
                    ...attachment,
                    type: (attachment as Attachment).type ?? (isImage ? "image" : "file"),
                    upload_url: attachment.upload_url ?? null,
                    preview_url: attachment.preview_url ?? null
                };
                await this.store.saveAttachment(attachmentWithDefaults, context);
                const apiAttachment: Record<string, unknown> = {
                    id: attachmentWithDefaults.id,
                    mime_type: mime_type,
                    name: attachmentWithDefaults.name,
                    type: attachmentWithDefaults.type,
                    upload_url: attachmentWithDefaults.upload_url
                };
                if (attachmentWithDefaults.preview_url) {
                    apiAttachment.preview_url = attachmentWithDefaults.preview_url;
                }
                return this.serialize(apiAttachment);
            }
            case "attachments.delete": {
                const attachmentStore = this.getAttachmentStore();
                await attachmentStore.deleteAttachment(
                    request.params.attachment_id,
                    context
                );
                await this.store.deleteAttachment(
                    request.params.attachment_id,
                    context
                );
                return new TextEncoder().encode("{}");
            }
            case "items.list": {
                const params = request.params ?? {};
                const items = await this.store.loadThreadItems(
                    params.thread_id,
                    params.after ?? null,
                    params.limit ?? DEFAULT_PAGE_SIZE,
                    params.order ?? "asc",
                    context
                );
                // filter out hidden context items
                items.data = items.data.filter(
                    item =>
                        (item as HiddenContextItem | SDKHiddenContextItem).type !==
                        "hidden_context" &&
                        (item as HiddenContextItem | SDKHiddenContextItem).type !==
                        "sdk_hidden_context"
                );
                return this.serialize(items);
            }
            case "threads.update": {
                const thread = await this.store.loadThread(
                    request.params.thread_id,
                    context
                );
                thread.title = request.params.title;
                await this.store.saveThread(thread, context);
                return this.serialize(this.toThreadResponse(thread));
            }
            case "threads.delete": {
                await this.store.deleteThread(request.params.thread_id, context);
                return new TextEncoder().encode("{}");
            }
            default:
                throw new Error(`Unknown non-streaming request type: ${request.type}`);
        }
    }

    /**
     * Handle streaming requests and emit server-sent-event style bytes.
     */
    protected async *processStreaming(
        request: any,
        context: TContext
    ): AsyncGenerator<Uint8Array, void, unknown> {
        try {
            for await (const event of this.processStreamingImpl(request, context)) {
                const b = this.serialize(event);
                const prefix = new TextEncoder().encode("data: ");
                const suffix = new TextEncoder().encode("\n\n");

                const combined = new Uint8Array(
                    prefix.length + b.length + suffix.length
                );
                combined.set(prefix, 0);
                combined.set(b, prefix.length);
                combined.set(suffix, prefix.length + b.length);

                yield combined;
            }
        } catch (error) {
            // Let cancellation bubble up without logging as an error.
            if (error instanceof Error && error.name === "AbortError") {
                throw error;
            }
            logger.error("Error while generating streamed response", error);
            throw error;
        }
    }

    /**
     * Core dispatch for streaming requests. Yields typed ThreadStreamEvents.
     */
    protected async *processStreamingImpl(
        request: any,
        context: TContext
    ): AsyncGenerator<ThreadStreamEvent, void, unknown> {
        switch (request.type) {
            case "threads.create": {
                const thread: Thread = {
                    id: this.store.generateThreadId(context),
                    created_at: new Date(),
                    items: { data: [], has_more: false, after: null }
                };
                await this.store.saveThread(thread, context);
                const createdEvent: ThreadCreatedEvent = {
                    type: "thread.created",
                    thread: this.toThreadResponse(thread)
                };
                yield createdEvent;

                const userMessage = await this.buildUserMessageItem(
                    request.params.input,
                    thread,
                    context
                );
                for await (const event of this.processNewThreadItemRespond(
                    thread,
                    userMessage,
                    context
                )) {
                    yield event;
                }
                break;
            }
            case "threads.add_user_message": {
                const thread = await this.store.loadThread(
                    request.params.thread_id,
                    context
                );
                const userMessage = await this.buildUserMessageItem(
                    request.params.input,
                    thread,
                    context
                );
                for await (const event of this.processNewThreadItemRespond(
                    thread,
                    userMessage,
                    context
                )) {
                    yield event;
                }
                break;
            }
            case "threads.add_client_tool_output": {
                const thread = await this.store.loadThread(
                    request.params.thread_id,
                    context
                );
                const items = await this.store.loadThreadItems(
                    thread.id,
                    null,
                    1,
                    "desc",
                    context
                );
                const toolCall = items.data.find(
                    item =>
                        (item as ClientToolCallItem).type === "client_tool_call" &&
                        (item as ClientToolCallItem).status === "pending"
                ) as ClientToolCallItem | undefined;

                if (!toolCall) {
                    throw new Error(
                        `Last thread item in ${thread.id} was not a ClientToolCallItem`
                    );
                }

                toolCall.output = request.params.result;
                toolCall.status = "completed";

                await this.store.saveItem(thread.id, toolCall, context);

                // Safety against dangling pending tool calls if there are
                // multiple in a row, which should be impossible.
                await this.cleanupPendingClientToolCall(thread, context);

                for await (const event of this.processEvents(
                    thread,
                    context,
                    () => this.respond(thread, null, context)
                )) {
                    yield event;
                }
                break;
            }
            case "threads.retry_after_item": {
                const threadMetadata = await this.store.loadThread(
                    request.params.thread_id,
                    context
                );

                const itemsToRemove: ThreadItem[] = [];
                let userMessageItem: UserMessageItem | null = null;

                for await (const item of this.paginateThreadItemsReverse(
                    request.params.thread_id,
                    context
                )) {
                    if (item.id === request.params.item_id) {
                        if ((item as UserMessageItem).type !== "user_message") {
                            throw new Error(
                                `Item ${request.params.item_id} is not a user message`
                            );
                        }
                        userMessageItem = item as UserMessageItem;
                        break;
                    }
                    itemsToRemove.push(item);
                }

                if (userMessageItem) {
                    for (const item of itemsToRemove) {
                        await this.store.deleteThreadItem(
                            request.params.thread_id,
                            item.id,
                            context
                        );
                    }
                    for await (const event of this.processEvents(
                        threadMetadata,
                        context,
                        () => this.respond(threadMetadata, userMessageItem, context)
                    )) {
                        yield event;
                    }
                }
                break;
            }
            case "threads.custom_action": {
                const threadMetadata = await this.store.loadThread(
                    request.params.thread_id,
                    context
                );

                let item: ThreadItem | null = null;
                if (request.params.item_id) {
                    item = await this.store.loadItem(
                        request.params.thread_id,
                        request.params.item_id,
                        context
                    );
                }

                if (item && (item as WidgetItem).widget === undefined) {
                    // Not a widget item – shouldn't happen if caller is using the API correctly.
                    const errorEvent: ErrorEvent = {
                        type: "error",
                        code: "stream_error",
                        allowRetry: false
                    };
                    yield errorEvent;
                    return;
                }

                for await (const event of this.processEvents(
                    threadMetadata,
                    context,
                    () =>
                        this.action(
                            threadMetadata,
                            request.params.action,
                            (item as WidgetItem) ?? null,
                            context
                        )
                )) {
                    yield event;
                }
                break;
            }
            default:
                throw new Error(`Unknown streaming request type: ${request.type}`);
        }
    }

    protected async cleanupPendingClientToolCall(
        thread: ThreadMetadata,
        context: TContext
    ): Promise<void> {
        const items = await this.store.loadThreadItems(
            thread.id,
            null,
            DEFAULT_PAGE_SIZE,
            "desc",
            context
        );
        for (const toolCall of items.data) {
            if ((toolCall as ClientToolCallItem).type !== "client_tool_call") {
                continue;
            }
            if ((toolCall as ClientToolCallItem).status === "pending") {
                logger.warning(
                    "Client tool call",
                    (toolCall as ClientToolCallItem).call_id,
                    "was not completed, ignoring"
                );
                await this.store.deleteThreadItem(thread.id, toolCall.id, context);
            }
        }
    }

    protected async *processNewThreadItemRespond(
        thread: ThreadMetadata,
        item: UserMessageItem,
        context: TContext
    ): AsyncGenerator<ThreadStreamEvent, void, unknown> {
        await this.store.addThreadItem(thread.id, item, context);
        await this.cleanupPendingClientToolCall(thread, context);

        const doneEvent: ThreadItemDoneEvent<ThreadItem> = {
            type: "thread.item.done",
            item: item as unknown as WidgetItem
        };
        yield doneEvent;

        for await (const event of this.processEvents(
            thread,
            context,
            () => this.respond(thread, item, context)
        )) {
            yield event;
        }
    }

    protected async *processEvents(
        thread: ThreadMetadata,
        context: TContext,
        stream: () => AsyncIterable<ThreadStreamEvent>
    ): AsyncGenerator<ThreadStreamEvent, void, unknown> {
        // allow the response to start streaming
        await Promise.resolve();

        // Send initial stream options
        const streamOptionsEvent: StreamOptionsEvent = {
            type: "stream_options",
            stream_options: this.getStreamOptions(thread, context)
        };
        yield streamOptionsEvent;

        // Track the same reference by default; most respond implementations mutate
        // the thread in place when metadata changes.
        let lastThread: ThreadMetadata = thread;

        // Keep track of items that were streamed but not yet saved
        // so that we can persist them when the stream is cancelled.
        const pendingItems: Record<string, ThreadItem> = {};

        const buildThreadResponseWithPending = async (): Promise<Thread> => {
            const fullThread = await this.loadFullThread(thread.id, context);
            const seen = new Set(fullThread.items.data.map(item => item.id));
            const pendingList = Object.values(pendingItems).filter(
                item => !seen.has(item.id)
            );
            const mergedItems = {
                ...fullThread.items,
                data: [...fullThread.items.data, ...pendingList]
            };
            return this.toThreadResponse({ ...fullThread, items: mergedItems });
        };

        try {
            for await (const event of stream()) {
                if (event.type === "thread.item.added") {
                    const added = event as ThreadItemAddedEvent;
                    pendingItems[added.item.id] = added.item;
                }

                let emitThreadUpdate = false;

                switch (event.type) {
                    case "thread.item.done": {
                        const done = event as ThreadItemDoneEvent;
                        await this.store.addThreadItem(thread.id, done.item, context);
                        delete pendingItems[done.item.id];
                        emitThreadUpdate = true;
                        break;
                    }
                    case "thread.item.removed": {
                        const removed = event as ThreadItemRemovedEvent;
                        await this.store.deleteThreadItem(
                            thread.id,
                            removed.item_id,
                            context
                        );
                        delete pendingItems[removed.item_id];
                        emitThreadUpdate = true;
                        break;
                    }
                    case "thread.item.replaced": {
                        const replaced = event as ThreadItemReplacedEvent;
                        await this.store.saveItem(thread.id, replaced.item, context);
                        delete pendingItems[replaced.item.id];
                        emitThreadUpdate = true;
                        break;
                    }
                    case "thread.item.added": {
                        emitThreadUpdate = true;
                        break;
                    }
                    case "thread.item.updated": {
                        const updatedEvent = event as ThreadItemUpdatedEvent;
                        const pending = pendingItems[updatedEvent.item_id];
                        if (
                            pending &&
                            (pending as AssistantMessageItem).type === "assistant_message"
                        ) {
                            const updated = this.applyAssistantMessageUpdate(
                                pending as AssistantMessageItem,
                                updatedEvent.update as AssistantMessageUpdate
                            );
                            pendingItems[pending.id] = updated;
                        }
                        break;
                    }
                    default:
                        break;
                }

                // Do not send hidden context items back to the client.
                const shouldSwallowEvent =
                    event.type === "thread.item.done" &&
                    (((event as ThreadItemDoneEvent).item as any).type ===
                        "hidden_context" ||
                        ((event as ThreadItemDoneEvent).item as any).type ===
                        "sdk_hidden_context");

                if (!shouldSwallowEvent) {
                    yield event;
                }

                // Emit updated thread when items change or metadata changes.
                if (emitThreadUpdate || thread !== lastThread) {
                    if (thread !== lastThread) {
                        lastThread = thread;
                        await this.store.saveThread(thread, context);
                    }
                    const fullThread = await buildThreadResponseWithPending();
                    const updatedThreadEvent: ThreadUpdatedEvent = {
                        type: "thread.updated",
                        thread: fullThread
                    };
                    yield updatedThreadEvent;
                }
            }

            // Final check for thread updates after streaming completes.
            const fullThreadAtEnd = await buildThreadResponseWithPending();
            const updatedThreadEventAtEnd: ThreadUpdatedEvent = {
                type: "thread.updated",
                thread: fullThreadAtEnd
            };
            yield updatedThreadEventAtEnd;
        } catch (error) {
            if (error instanceof CustomStreamError) {
                const errorEvent: ErrorEvent = {
                    type: "error",
                    code: "custom",
                    message: error.message,
                    allowRetry: error.allowRetry
                };
                yield errorEvent;
            } else if (error instanceof StreamError) {
                const errorEvent: ErrorEvent = {
                    type: "error",
                    code: "stream_error",
                    allowRetry: error.allowRetry
                };
                yield errorEvent;
            } else {
                const errorEvent: ErrorEvent = {
                    type: "error",
                    code: "stream_error",
                    allowRetry: true,
                    message: DEFAULT_ERROR_MESSAGE
                };
                yield errorEvent;
                logger.error(error);
            }

            if (thread !== lastThread) {
                await this.store.saveThread(thread, context);
            }
            const fullThread = await buildThreadResponseWithPending();
            const updatedThreadEvent: ThreadUpdatedEvent = {
                type: "thread.updated",
                thread: fullThread
            };
            yield updatedThreadEvent;
        }
    }

    protected async buildUserMessageItem(
        input: UserMessageInput,
        thread: ThreadMetadata,
        context: TContext
    ): Promise<UserMessageItem> {
        const attachments: Attachment[] = [];
        for (const attachmentId of input.attachments ?? []) {
            attachments.push(await this.store.loadAttachment(attachmentId, context));
        }

        const item: UserMessageItem = {
            type: "user_message",
            id: this.store.generateItemId("message", thread, context),
            content: input.content.map(part => ({
                ...part,
                type: (part as any).type ?? "input_text"
            })),
            thread_id: thread.id,
            attachments,
            quoted_text: input.quoted_text ?? null,
            inference_options: input.inference_options,
            created_at: new Date()
        };
        return item;
    }

    protected applyAssistantMessageUpdate(
        item: AssistantMessageItem,
        update: AssistantMessageUpdate
    ): AssistantMessageItem {
        const updated: AssistantMessageItem = {
            ...item,
            content: (item.content ?? []).map(c => ({ ...c }))
        };

        while (updated.content.length <= (update as any).content_index) {
            updated.content.push({ type: "output_text", text: "", annotations: [] });
        }

        switch (update.type) {
            case "assistant_message.content_part.added": {
                updated.content[update.content_index] = update.content;
                break;
            }
            case "assistant_message.content_part.text_delta": {
                updated.content[update.content_index].text += update.delta;
                break;
            }
            case "assistant_message.content_part.annotation_added": {
                const annotations = updated.content[update.content_index].annotations ?? [];
                if (update.annotation_index <= annotations.length) {
                    annotations.splice(update.annotation_index, 0, update.annotation);
                } else {
                    annotations.push(update.annotation);
                }
                updated.content[update.content_index].annotations = annotations;
                break;
            }
            case "assistant_message.content_part.done": {
                updated.content[update.content_index] = update.content;
                break;
            }
            default:
                break;
        }
        return updated;
    }

    protected async loadFullThread(
        threadId: string,
        context: TContext
    ): Promise<Thread> {
        const threadMeta = await this.store.loadThread(threadId, context);
        const threadItems = await this.store.loadThreadItems(
            threadId,
            null,
            DEFAULT_PAGE_SIZE,
            "asc",
            context
        );
        return {
            ...(threadMeta as ThreadMetadata),
            items: threadItems
        } as Thread;
    }

    protected async *paginateThreadItemsReverse(
        threadId: string,
        context: TContext
    ): AsyncGenerator<ThreadItem, void, unknown> {
        let after: string | null = null;
        while (true) {
            const items = await this.store.loadThreadItems(
                threadId,
                after,
                DEFAULT_PAGE_SIZE,
                "asc",
                context
            );
            for (const item of items.data) {
                yield item;
            }
            if (!items.has_more) {
                break;
            }
            after = items.after ?? null;
        }
    }

    protected serialize(obj: any): Uint8Array {
        return new TextEncoder().encode(JSON.stringify(obj));
    }

    protected toThreadResponse(thread: ThreadMetadata | Thread): Thread {
        const isHidden = (item: ThreadItem): boolean =>
            ((item as HiddenContextItem).type === "hidden_context" ||
                (item as SDKHiddenContextItem).type === "sdk_hidden_context") ??
            false;

        const items: Page<ThreadItem> =
            (thread as Thread).items ?? ({ data: [], has_more: false } as Page<
                ThreadItem
            >);
        items.data = items.data.filter(item => !isHidden(item));

        return {
            id: thread.id,
            title: thread.title,
            created_at: thread.created_at,
            items,
            status: (thread as any).status,
            metadata: (thread as any).metadata
        } as Thread;
    }
}
