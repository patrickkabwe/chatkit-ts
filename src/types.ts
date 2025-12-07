export type ThreadStatus =
  | { type: "active" }
  | { type: "locked"; reason?: string | null }
  | { type: "closed"; reason?: string | null };

export interface ThreadMetadata {
  id: string;
  title?: string | null;
  created_at: Date;
  status?: ThreadStatus;
  metadata?: Record<string, any>;
}

/**
 * Full thread representation, including items. It will be expanded as
 * more surface area is needed on the TypeScript side.
 */
export interface Page<T = any> {
  data: T[];
  has_more: boolean;
  after?: string | null;
}

export interface Thread extends ThreadMetadata {
  items: Page<ThreadItem>;
}

// --- Thread items (minimal subset) ---

export interface TaskItem {
  type: "task";
  id: string;
  thread_id: string;
  created_at: Date;
  task: unknown; // Task type would need to be defined based on workflow task structure
}

export type ThreadItem =
  | AssistantMessageItem
  | WidgetItem
  | ClientToolCallItem
  | HiddenContextItem
  | SDKHiddenContextItem
  | WorkflowItem
  | TaskItem
  | UserMessageItem
  | AttachmentItem;

export interface WidgetItem<WidgetRoot = any> {
  type: "widget";
  id: string;
  thread_id: string;
  created_at: Date;
  widget: WidgetRoot;
  copy_text?: string | null;
}

// Minimal assistant/user message and related stream types. These can be extended over time as more of the surface area is
// needed on the TypeScript side.

export interface AssistantMessageContent {
  type: "output_text";
  text: string;
  annotations: Annotation[];
}

export interface AssistantMessageContentPartAdded {
  type: "assistant_message.content_part.added";
  content_index: number;
  content: AssistantMessageContent;
}

export interface AssistantMessageContentPartTextDelta {
  type: "assistant_message.content_part.text_delta";
  content_index: number;
  delta: string;
}

export interface AssistantMessageContentPartAnnotationAdded {
  type: "assistant_message.content_part.annotation_added";
  content_index: number;
  annotation_index: number;
  annotation: Annotation;
}

export interface AssistantMessageContentPartDone {
  type: "assistant_message.content_part.done";
  content_index: number;
  content: AssistantMessageContent;
}

export type AssistantMessageUpdate =
  | AssistantMessageContentPartAdded
  | AssistantMessageContentPartTextDelta
  | AssistantMessageContentPartAnnotationAdded
  | AssistantMessageContentPartDone;

export interface Annotation {
  type: "annotation";
  source: FileSource | URLSource | EntitySource;
  index: number | null;
}

export interface FileSource {
  type: "file";
  title: string;
  filename: string;
  description?: string | null;
  timestamp?: string | null;
  group?: string | null;
}

export interface URLSource {
  type: "url";
  title: string;
  url: string;
  attribution?: string | null;
  description?: string | null;
  timestamp?: string | null;
  group?: string | null;
}

export interface EntitySource {
  type: "entity";
  title: string;
  id: string;
  icon?: string | null;
  data?: Record<string, any>;
  description?: string | null;
  timestamp?: string | null;
  group?: string | null;
}

export interface AssistantMessageItem {
  type: "assistant_message";
  id: string;
  thread_id: string;
  created_at: Date;
  content: AssistantMessageContent[];
}

export interface UserMessageInput {
  content: UserMessageTextContent[];
  attachments: string[];
  inference_options?: InferenceOptions;
  quoted_text?: string | null;
}

export interface UserMessageTextContent {
  type?: "input_text";
  text: string;
}

export interface UserMessageTagContent {
  type: "input_tag";
  id: string;
  text: string;
  data: Record<string, unknown>;
  group?: string | null;
  interactive?: boolean;
}

export type UserMessageContent = UserMessageTextContent | UserMessageTagContent;

export interface InferenceOptions {
  // Placeholder for model, temperature, tools, etc.
  toolChoice?: { id: string };
}

export interface UserMessageItem {
  type: "user_message";
  id: string;
  thread_id: string;
  created_at: Date;
  content: UserMessageContent[];
  attachments: Attachment[];
  quoted_text?: string | null;
  inference_options?: InferenceOptions;
}

export interface ClientToolCallItem {
  type: "client_tool_call";
  id: string;
  thread_id: string;
  created_at: Date;
  call_id: string;
  name: string;
  arguments: unknown;
  output?: unknown;
  status: "pending" | "completed";
}

export interface Workflow {
  tasks: any[];
}

export interface WorkflowItem {
  type: "workflow";
  id: string;
  thread_id: string;
  created_at: Date;
  workflow: Workflow;
}

export interface HiddenContextItem {
  type: "hidden_context" | "sdk_hidden_context";
  id: string;
  thread_id: string;
  created_at: Date;
  content: string;
}

export interface SDKHiddenContextItem extends HiddenContextItem {
}

// --- Attachments (minimal subset) ---

export type AttachmentType = "file" | "image";

export interface AttachmentBase {
  id: string;
  mime_type: string;
  name: string;
  upload_url?: string | null;
  preview_url?: string | null;
  created_at?: Date | null;
}

export interface FileAttachment extends AttachmentBase {
  type: "file";
}

export interface ImageAttachment extends AttachmentBase {
  type: "image";
}

export type Attachment = FileAttachment | ImageAttachment;

export type AttachmentItem = Attachment;

// --- Stream options and events (minimal subset) ---

export interface StreamOptions {
  allow_cancel: boolean;
}

export interface StreamOptionsEvent {
  type: "stream_options";
  stream_options: StreamOptions;
}

export interface ThreadItemRemovedEvent {
  type: "thread.item.removed";
  item_id: string;
}

export interface WidgetStreamingTextValueDelta {
  type: "widget.streaming_text.value_delta";
  component_id: string;
  delta: string;
  done: boolean;
}

export interface WidgetRootUpdated<WidgetRoot = any> {
  type: "widget.root.updated";
  widget: WidgetRoot;
}

export type WidgetUpdate<WidgetRoot = any> =
  | WidgetStreamingTextValueDelta
  | WidgetRootUpdated<WidgetRoot>;

export interface ThreadItemAddedEvent<WidgetRoot = any> {
  type: "thread.item.added";
  item: ThreadItem;
}

export interface ThreadItemUpdatedEvent<WidgetRoot = any> {
  type: "thread.item.updated";
  item_id: string;
  update: WidgetUpdate<WidgetRoot> | AssistantMessageUpdate;
}

export interface ThreadItemDoneEvent<WidgetRoot = any> {
  type: "thread.item.done";
  item: ThreadItem;
}

export type ThreadItemEvent<WidgetRoot = any> =
  | ThreadItemAddedEvent<WidgetRoot>
  | ThreadItemUpdatedEvent<WidgetRoot>
  | ThreadItemDoneEvent<WidgetRoot>
  | ThreadItemRemovedEvent;

// --- Top-level stream events ---

export interface ThreadCreatedEvent {
  type: "thread.created";
  thread: Thread;
}

export interface ThreadUpdatedEvent {
  type: "thread.updated";
  thread: Thread;
}

export interface ThreadItemReplacedEvent {
  type: "thread.item.replaced";
  item: ThreadItem;
}

export interface ProgressUpdateEvent {
  type: "progress_update";
  text: string;
}

export interface ClientEffectEvent {
  type: "client_effect";
  name: string;
  data?: Record<string, unknown>;
}

export interface ErrorEvent {
  type: "error";
  code: "stream_error" | "custom";
  message?: string | null;
  allowRetry?: boolean;
}

export type ThreadStreamEvent<WidgetRoot = any> =
  | ThreadCreatedEvent
  | ThreadUpdatedEvent
  | ThreadItemEvent<WidgetRoot>
  | ThreadItemReplacedEvent
  | StreamOptionsEvent
  | ProgressUpdateEvent
  | ClientEffectEvent
  | ErrorEvent;

// --- Actions ---

export type Handler = "client" | "server";

export type LoadingBehavior = "auto" | "none" | "self" | "container";

/**
 * Shape of an action dispatched from a widget.
 *
 * Actions are triggered when users interact with widgets (buttons, form submissions, etc.).
 * Actions can be constructed directly or generated from widget templates.
 */
export interface ActionConfig<TPayload = any> {
  type: string;
  payload: TPayload | null;
  handler: Handler;
  loadingBehavior: LoadingBehavior;
}
