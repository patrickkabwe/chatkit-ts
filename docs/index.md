# ChatKit TypeScript SDK

A comprehensive TypeScript port of the OpenAI ChatKit Python SDK for TypeScript/JavaScript developers. This SDK provides a complete framework for building chat-based applications with streaming responses, interactive widgets, and flexible storage backends.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Advanced Topics](#advanced-topics)

## Overview

ChatKit TS is a TypeScript SDK that enables developers to build conversational AI applications with:

- **Streaming Responses**: Real-time streaming of assistant responses and UI updates
- **Interactive Widgets**: Rich, interactive UI components rendered server-side
- **Flexible Storage**: Pluggable storage backends for threads, messages, and attachments
- **Agent Integration**: Built-in support for OpenAI Agents SDK
- **Type Safety**: Full TypeScript support with comprehensive type definitions

### Key Features

- 🔄 **Real-time Streaming**: Server-sent events (SSE) for live updates
- 🎨 **Rich Widgets**: Card, ListView, Form, Chart, and 20+ component types
- 💾 **Flexible Storage**: Abstract store interface with multiple implementations
- 📎 **Attachment Support**: Disk-based and AWS S3 attachment stores
- 🤖 **Agent Integration**: Helpers for OpenAI Agents SDK
- 🔒 **Type Safe**: Full TypeScript definitions for all APIs

## Installation

```bash
# Using bun (recommended)
bun add chatkit-ts

# Using npm
npm install chatkit-ts

# Using yarn
yarn add chatkit-ts

# Using pnpm
pnpm add chatkit-ts
```

### Peer Dependencies

- `@openai/agents`: Required for agent integration
- `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`: Required for AWS S3 attachment store

## Quick Start

### Basic Server Setup

```typescript
import { ChatKitServer } from "chatkit-ts";
import { InMemoryStore } from "./store"; // Your store implementation

class MyServer extends ChatKitServer {
  async respond(thread, userMessage, context) {
    // Your response logic here
    // Return an async iterable of ThreadStreamEvent
  }
}

const store = new InMemoryStore();
const server = new MyServer(store);
```

### Handling a Request

```typescript
const request = {
  type: "threads.create",
  params: {
    input: {
      content: [{ type: "input_text", text: "Hello!" }],
      attachments: []
    }
  }
};

const result = await server.process(request, context);

if (result instanceof StreamingResult) {
  for await (const chunk of result) {
    // Process streaming chunks
    console.log(new TextDecoder().decode(chunk));
  }
}
```

## Core Concepts

### Threads and Messages

A **thread** is a conversation container that holds a sequence of **thread items** (messages, widgets, tool calls, etc.). Threads have:

- **ID**: Unique identifier
- **Title**: Optional display name
- **Status**: active, locked, or closed
- **Metadata**: Custom key-value pairs
- **Items**: Paginated list of thread items

### Thread Items

Thread items are the building blocks of conversations:

- `user_message`: User input with text, attachments, and options
- `assistant_message`: Assistant responses with text and annotations
- `widget`: Interactive UI components
- `client_tool_call`: Tool calls requiring client-side execution
- `workflow`: Multi-step workflow definitions
- `task`: Individual workflow tasks
- `attachment`: File or image attachments
- `hidden_context`: System messages not shown to users

### Widgets

Widgets are interactive UI components that can be streamed and updated in real-time. They support:

- **Streaming**: Incremental updates as content is generated
- **Actions**: User interactions that trigger server-side handlers
- **Forms**: Data collection and submission
- **Charts**: Data visualization

See [Widgets Documentation](./widgets.md) for complete details.

### Stores

Stores handle persistence of threads, messages, and attachments. You can implement custom stores or use provided ones:

- **Abstract Store**: Define your own persistence layer
- **Disk Attachment Store**: File-based attachment storage
- **AWS S3 Attachment Store**: Cloud-based attachment storage

See [Stores Documentation](./stores.md) for implementation details.

### Streaming

The SDK uses Server-Sent Events (SSE) for streaming responses. Events include:

- `thread.created`: New thread initialized
- `thread.updated`: Thread metadata changed
- `thread.item.added`: New item added to thread
- `thread.item.updated`: Item content updated (streaming)
- `thread.item.done`: Item finalized
- `thread.item.removed`: Item deleted
- `error`: Error occurred during processing

## Architecture

### Request Flow

```
Client Request
    ↓
ChatKitServer.process()
    ↓
processStreaming() or processNonStreaming()
    ↓
respond() or action()
    ↓
ThreadStreamEvent Generation
    ↓
SSE Encoding
    ↓
Client Response
```

### Component Relationships

```
ChatKitServer
├── Store (persistence)
├── AttachmentStore (file handling)
├── respond() (response generation)
└── action() (widget actions)

AgentContext
├── StoreLike (minimal store interface)
├── streamWidget() (widget streaming)
└── stream() (event streaming)

ThreadItemConverter
└── toAgentInput() (conversion to Agents SDK format)
```

## API Reference

### ChatKitServer

Base class for implementing chat servers.

#### Constructor

```typescript
constructor(
  store: Store<TContext>,
  attachmentStore?: AttachmentStore<TContext> | null
)
```

#### Methods

- `process(request, context)`: Main entry point for processing requests
- `respond(thread, userMessage, context)`: Generate response (abstract, must implement)
- `action(thread, action, sender, context)`: Handle widget actions (abstract, must implement)
- `addFeedback(threadId, itemIds, feedback, context)`: Handle user feedback
- `getStreamOptions(thread, context)`: Configure stream options
- `handleStreamCancelled(thread, pendingItems, context)`: Handle stream cancellation

### Store

Abstract base class for persistence.

#### Required Methods

- `loadThread(threadId, context)`: Load thread metadata
- `saveThread(thread, context)`: Save thread metadata
- `loadThreadItems(threadId, after, limit, order, context)`: Load paginated items
- `addThreadItem(threadId, item, context)`: Add new item
- `saveItem(threadId, item, context)`: Update existing item
- `deleteThreadItem(threadId, itemId, context)`: Remove item
- `loadAttachment(attachmentId, context)`: Load attachment metadata
- `saveAttachment(attachment, context)`: Save attachment metadata
- `deleteAttachment(attachmentId, context)`: Remove attachment
- `loadThreads(limit, after, order, context)`: List all threads

### AttachmentStore

Abstract base class for file storage.

#### Methods

- `createAttachment(params, context)`: Create attachment with upload URL
- `deleteAttachment(attachmentId, context)`: Remove attachment file

### Widget System

See [Widgets Documentation](./widgets.md) for complete widget API reference.

### Agent Integration

See [Agents Documentation](./agents.md) for agent integration details.

## Examples

### Complete Example Server

```typescript
import { ChatKitServer, ThreadStreamEvent } from "chatkit-ts";
import { InMemoryStore } from "./store";

class MyChatServer extends ChatKitServer {
  async respond(thread, userMessage, context) {
    const text = userMessage.content[0]?.text || "";
    
    // Simple echo response
    yield {
      type: "assistant_message",
      id: this.store.generateItemId("message", thread, context),
      thread_id: thread.id,
      created_at: new Date(),
      content: [{
        type: "output_text",
        text: `You said: ${text}`,
        annotations: []
      }]
    };
  }

  async action(thread, action, sender, context) {
    // Handle widget actions
    yield {
      type: "thread.item.done",
      item: {
        type: "widget",
        id: sender?.id || "",
        thread_id: thread.id,
        created_at: new Date(),
        widget: { type: "Card", children: [] }
      }
    };
  }
}
```

### Widget Streaming

```typescript
import { streamWidget } from "chatkit-ts";

async function* generateWidget() {
  yield { type: "Card", children: [
    { type: "Text", value: "Loading...", streaming: true }
  ]};
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  yield { type: "Card", children: [
    { type: "Text", value: "Complete!", streaming: false }
  ]};
}

for await (const event of streamWidget(thread, generateWidget())) {
  // Stream widget updates
}
```

### Agent Integration

```typescript
import { respondWithAgent, ThreadItemConverter } from "chatkit-ts";
import { Agent } from "@openai/agents";

class MyConverter extends ThreadItemConverter {
  async attachmentToMessageContent(attachment) {
    return {
      type: "input_file",
      file_url: attachment.preview_url
    };
  }
}

async function* respond(thread, userMessage, context) {
  const agent = new Agent({ /* config */ });
  
  yield* respondWithAgent({
    agent,
    runner: agent.runStreamed.bind(agent),
    store: this.store,
    thread,
    input: userMessage,
    context,
    converter: new MyConverter()
  });
}
```

## Advanced Topics

### Custom Store Implementation

```typescript
import { Store, ThreadMetadata, ThreadItem, Attachment } from "chatkit-ts";

class MyCustomStore extends Store {
  async loadThread(threadId: string, context: any) {
    // Your implementation
  }
  
  // ... implement all required methods
}
```

### Error Handling

```typescript
import { StreamError, CustomStreamError } from "chatkit-ts";

try {
  // Your logic
} catch (error) {
  throw new StreamError(ErrorCode.STREAM_ERROR, {
    allowRetry: true
  });
}
```

### Logging

```typescript
import { logger } from "chatkit-ts";

logger.debug("Debug message");
logger.info("Info message");
logger.warning("Warning message");
logger.error("Error message");
```

Set log level via environment variable:

```bash
LOG_LEVEL=DEBUG node server.js
```

### Request Types

#### Streaming Requests

- `threads.create`: Create new thread with initial message
- `threads.add_user_message`: Add user message to thread
- `threads.add_client_tool_output`: Submit tool call result
- `threads.retry_after_item`: Retry from specific message
- `threads.custom_action`: Handle widget action

#### Non-Streaming Requests

- `threads.get_by_id`: Get thread by ID
- `threads.list`: List all threads
- `threads.update`: Update thread metadata
- `threads.delete`: Delete thread
- `items.list`: List thread items
- `items.feedback`: Submit user feedback
- `attachments.create`: Create attachment
- `attachments.delete`: Delete attachment

## License

MIT

## Contributing

Contributions are welcome! Please see the contributing guidelines.

## Support

For issues and questions, please open an issue on GitHub.

