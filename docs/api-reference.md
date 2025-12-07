# API Reference

Complete API reference for the ChatKit TypeScript SDK.

## Table of Contents

- [Types](#types)
- [ChatKitServer](#chatkitserver)
- [Store](#store)
- [AttachmentStore](#attachmentstore)
- [Widgets](#widgets)
- [Agents](#agents)
- [Errors](#errors)
- [Utilities](#utilities)

## Types

### ThreadStatus

```typescript
type ThreadStatus =
  | { type: "active" }
  | { type: "locked"; reason?: string | null }
  | { type: "closed"; reason?: string | null };
```

### ThreadMetadata

```typescript
interface ThreadMetadata {
  id: string;
  title?: string | null;
  created_at: Date;
  status?: ThreadStatus;
  metadata?: Record<string, any>;
}
```

### Thread

```typescript
interface Thread extends ThreadMetadata {
  items: Page<ThreadItem>;
}
```

### Page

```typescript
interface Page<T> {
  data: T[];
  has_more: boolean;
  after?: string | null;
}
```

### ThreadItem

Union of all thread item types:

```typescript
type ThreadItem =
  | AssistantMessageItem
  | WidgetItem
  | ClientToolCallItem
  | HiddenContextItem
  | SDKHiddenContextItem
  | WorkflowItem
  | TaskItem
  | UserMessageItem
  | AttachmentItem;
```

### UserMessageItem

```typescript
interface UserMessageItem {
  type: "user_message";
  id: string;
  thread_id: string;
  created_at: Date;
  content: UserMessageContent[];
  attachments: Attachment[];
  quoted_text?: string | null;
  inference_options?: InferenceOptions;
}
```

### AssistantMessageItem

```typescript
interface AssistantMessageItem {
  type: "assistant_message";
  id: string;
  thread_id: string;
  created_at: Date;
  content: AssistantMessageContent[];
}
```

### WidgetItem

```typescript
interface WidgetItem<WidgetRoot = any> {
  type: "widget";
  id: string;
  thread_id: string;
  created_at: Date;
  widget: WidgetRoot;
  copy_text?: string | null;
}
```

### Attachment

```typescript
type Attachment = FileAttachment | ImageAttachment;

interface AttachmentBase {
  id: string;
  mime_type: string;
  name: string;
  upload_url?: string | null;
  preview_url?: string | null;
  created_at?: Date | null;
}

interface FileAttachment extends AttachmentBase {
  type: "file";
}

interface ImageAttachment extends AttachmentBase {
  type: "image";
}
```

### ThreadStreamEvent

Union of all streaming events:

```typescript
type ThreadStreamEvent =
  | ThreadCreatedEvent
  | ThreadUpdatedEvent
  | ThreadItemEvent
  | ThreadItemReplacedEvent
  | StreamOptionsEvent
  | ProgressUpdateEvent
  | ClientEffectEvent
  | ErrorEvent;
```

## ChatKitServer

Base class for implementing chat servers.

### Constructor

```typescript
constructor(
  store: Store<TContext>,
  attachmentStore?: AttachmentStore<TContext> | null
)
```

### Methods

#### process

Main entry point for processing requests.

```typescript
async process(
  request: string | Uint8Array | any,
  context: TContext
): Promise<StreamingResult | NonStreamingResult>
```

#### respond

Generate response for a user message. **Must be implemented by subclasses.**

```typescript
abstract respond(
  thread: ThreadMetadata,
  inputUserMessage: UserMessageItem | null,
  context: TContext
): AsyncIterable<ThreadStreamEvent>
```

#### action

Handle widget actions. **Must be implemented by subclasses.**

```typescript
action(
  thread: ThreadMetadata,
  action: any,
  sender: WidgetItem | null,
  context: TContext
): AsyncIterable<ThreadStreamEvent>
```

#### addFeedback

Handle user feedback about items.

```typescript
async addFeedback(
  threadId: string,
  itemIds: string[],
  feedback: any,
  context: TContext
): Promise<void>
```

#### getStreamOptions

Return stream-level runtime options.

```typescript
getStreamOptions(
  thread: ThreadMetadata,
  context: TContext
): StreamOptions
```

**Returns:**

```typescript
interface StreamOptions {
  allow_cancel: boolean;
}
```

#### handleStreamCancelled

Handle stream cancellation.

```typescript
async handleStreamCancelled(
  thread: ThreadMetadata,
  pendingItems: ThreadItem[],
  context: TContext
): Promise<void>
```

### Protected Methods

#### getAttachmentStore

Get the configured attachment store or throw if missing.

```typescript
protected getAttachmentStore(): AttachmentStore<TContext>
```

## Store

Abstract base class for persistence.

### Methods

#### generateThreadId

Generate a new thread ID.

```typescript
generateThreadId(context: TContext): string
```

#### generateItemId

Generate a new item ID.

```typescript
generateItemId(
  itemType: StoreItemType,
  thread: ThreadMetadata,
  context: TContext
): string
```

#### loadThread

Load thread metadata.

```typescript
abstract loadThread(
  threadId: string,
  context: TContext
): Promise<ThreadMetadata>
```

#### saveThread

Save thread metadata.

```typescript
abstract saveThread(
  thread: ThreadMetadata,
  context: TContext
): Promise<void>
```

#### loadThreadItems

Load paginated thread items.

```typescript
abstract loadThreadItems(
  threadId: string,
  after: string | null,
  limit: number,
  order: "asc" | "desc",
  context: TContext
): Promise<Page<ThreadItem>>
```

#### addThreadItem

Add a new thread item.

```typescript
abstract addThreadItem(
  threadId: string,
  item: ThreadItem,
  context: TContext
): Promise<void>
```

#### saveItem

Update an existing thread item.

```typescript
abstract saveItem(
  threadId: string,
  item: ThreadItem,
  context: TContext
): Promise<void>
```

#### loadItem

Load a specific thread item.

```typescript
abstract loadItem(
  threadId: string,
  itemId: string,
  context: TContext
): Promise<ThreadItem>
```

#### deleteThreadItem

Delete a thread item.

```typescript
abstract deleteThreadItem(
  threadId: string,
  itemId: string,
  context: TContext
): Promise<void>
```

#### loadThreads

List all threads with pagination.

```typescript
abstract loadThreads(
  limit: number,
  after: string | null,
  order: "asc" | "desc",
  context: TContext
): Promise<Page<ThreadMetadata>>
```

#### deleteThread

Delete a thread and all its items.

```typescript
abstract deleteThread(
  threadId: string,
  context: TContext
): Promise<void>
```

#### saveAttachment

Save attachment metadata.

```typescript
abstract saveAttachment(
  attachment: Attachment,
  context: TContext
): Promise<void>
```

#### loadAttachment

Load attachment metadata.

```typescript
abstract loadAttachment(
  attachmentId: string,
  context: TContext
): Promise<Attachment>
```

#### deleteAttachment

Delete attachment metadata.

```typescript
abstract deleteAttachment(
  attachmentId: string,
  context: TContext
): Promise<void>
```

### StoreItemType

```typescript
type StoreItemType =
  | "thread"
  | "message"
  | "tool_call"
  | "task"
  | "workflow"
  | "attachment"
  | "sdk_hidden_context";
```

## AttachmentStore

Abstract base class for file storage.

### Methods

#### createAttachment

Create an attachment with upload URL.

```typescript
async createAttachment(
  input: AttachmentCreateParams,
  context: TContext
): Promise<Attachment>
```

**Parameters:**

```typescript
interface AttachmentCreateParams {
  name: string;
  size: number;
  mime_type: string;
}
```

#### deleteAttachment

Delete an attachment file.

```typescript
abstract deleteAttachment(
  attachmentId: string,
  context: TContext
): Promise<void>
```

#### generateAttachmentId

Generate a new attachment ID.

```typescript
generateAttachmentId(mime_type: string, context: TContext): string
```

**Note**: You must implement your own `AttachmentStore` class. No implementations are provided by the SDK.

## Widgets

See [Widgets Documentation](./widgets.md) for complete widget API.

### streamWidget

Stream a widget or async generator of widgets.

```typescript
async function* streamWidget<T extends WidgetRoot>(
  thread: ThreadMetadata,
  widget: T | AsyncGenerator<T, void, unknown>,
  copyText?: string | null,
  generateId?: (itemType: StoreItemType) => string
): AsyncGenerator<ThreadStreamEvent<T>, void, unknown>
```

### diffWidget

Compute differences between widget states for streaming.

```typescript
function diffWidget<T extends WidgetRoot>(
  before: T,
  after: T
): Array<WidgetStreamingTextValueDelta | WidgetRootUpdated<T>>
```

## Agents

### AgentContext

Context for agent runs.

```typescript
class AgentContext<C> {
  thread: ThreadMetadata;
  store: StoreLike<C>;
  requestContext: C;
  previousResponseId: string | null;
  clientToolCall: ClientToolCall | null;
  workflowItem: WorkflowItem | null;

  constructor(args: {
    thread: ThreadMetadata;
    store: StoreLike<C>;
    requestContext?: C;
    previousResponseId?: string | null;
    clientToolCall?: ClientToolCall | null;
    workflowItem?: WorkflowItem | null;
  })

  generateId(type: StoreItemType, thread?: ThreadMetadata): string
  async streamWidget<T extends WidgetRoot>(
    widget: T | AsyncGenerator<T, void, unknown>,
    copyText?: string | null
  ): Promise<void>
  async stream(event: ThreadStreamEvent): Promise<void>
}
```

### ThreadItemConverter

Converts thread items to agent input format.

```typescript
class ThreadItemConverter {
  async toAgentInput(
    threadItems: ThreadItem[] | ThreadItem | unknown
  ): Promise<AgentInputItem[]>

  async attachmentToMessageContent(
    attachment: Attachment
  ): Promise<AgentInputContentPart>

  async tagToMessageContent(
    tag: UserMessageTagContent
  ): Promise<AgentInputContentPart>

  async hiddenContextToInput(
    item: HiddenContextItem | SDKHiddenContextItem
  ): Promise<AgentInputItem | AgentInputItem[] | null>

  async taskToInput(
    item: TaskItem
  ): Promise<AgentInputItem | AgentInputItem[] | null>

  async workflowToInput(
    item: WorkflowItem
  ): Promise<AgentInputItem | AgentInputItem[] | null>

  async widgetToInput(
    item: WidgetItem
  ): Promise<AgentInputItem | AgentInputItem[] | null>
}
```

### respondWithAgent

Helper for responding with an agent.

```typescript
async function* respondWithAgent<C>(params: {
  agent: unknown;
  runner: RunnerLike<C>;
  store: StoreLike<C>;
  thread: ThreadMetadata;
  input: ThreadItem | ThreadItem[] | null;
  context: C;
  converter?: ThreadItemConverter;
}): AsyncGenerator<ThreadStreamEvent, void, unknown>
```

### accumulateText

Accumulate text deltas into a widget.

```typescript
async function* accumulateText(
  events: AsyncIterable<StreamEvent>,
  baseWidget: TextWidget
): AsyncGenerator<TextWidget, void, unknown>
```

### simpleToAgentInput

Simple conversion to agent input format.

```typescript
function simpleToAgentInput(
  threadItems: ThreadItem[] | ThreadItem | unknown
): Promise<AgentInputItem[]>
```

## Errors

### StreamError

Error with specific error code.

```typescript
class StreamError extends BaseStreamError {
  code: ErrorCode;
  statusCode: number;
  allowRetry: boolean;

  constructor(
    code: ErrorCode,
    options?: { allowRetry?: boolean | null }
  )
}
```

### CustomStreamError

Error with custom message.

```typescript
class CustomStreamError extends BaseStreamError {
  message: string;
  allowRetry: boolean;

  constructor(
    message: string,
    options?: { allowRetry?: boolean }
  )
}
```

### NotFoundError

Resource not found error.

```typescript
class NotFoundError extends Error {
  constructor(message?: string)
}
```

### ErrorCode

```typescript
enum ErrorCode {
  STREAM_ERROR = "stream.error"
}
```

## Utilities

### Action

Action creation helper.

```typescript
class Action<TType extends string, TPayload> {
  readonly type: TType;
  readonly payload: TPayload;

  constructor(type: TType, payload: TPayload)

  static create<TPayload>(
    type: string,
    payload: TPayload,
    handler?: Handler,
    loadingBehavior?: LoadingBehavior
  ): ActionConfig<TPayload>

  static create<TPayload>(
    payload: TPayload,
    handler?: Handler,
    loadingBehavior?: LoadingBehavior
  ): ActionConfig<TPayload>
}
```

### Logger

Logging utility.

```typescript
interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  warning(...args: unknown[]): void;
  error(...args: unknown[]): void;
  critical(...args: unknown[]): void;
}

export const logger: Logger;
```

Set log level via `LOG_LEVEL` environment variable:
- `DEBUG`
- `INFO`
- `WARNING` (default)
- `ERROR`
- `CRITICAL`

### WidgetTemplate

Load and build widgets from templates.

```typescript
class WidgetTemplate {
  readonly version: "1.0";
  readonly name: string;
  readonly dataSchema: Record<string, any>;

  constructor(definition: WidgetTemplateDefinition)

  static fromFile(filePath: string): WidgetTemplate

  build(data?: Record<string, any>): DynamicWidgetRoot
  build_basic(data?: Record<string, any>): BasicRoot
}

interface WidgetTemplateDefinition {
  version: "1.0";
  name: string;
  template: string | ((data: Record<string, any>) => string);
  jsonSchema?: Record<string, any>;
  outputJsonPreview?: any;
  encodedWidget?: string;
}
```

### ID Generation

```typescript
function defaultGenerateId(itemType: StoreItemType): string
```

Generates IDs with format: `${prefix}_${hexCounter}`

Prefixes:
- `thread`: `"thr"`
- `message`: `"msg"`
- `tool_call`: `"tc"`
- `workflow`: `"wf"`
- `task`: `"tsk"`
- `attachment`: `"atc"`
- `sdk_hidden_context`: `"shcx"`

