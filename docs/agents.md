# Agents Integration Documentation

The ChatKit SDK provides helpers for integrating with the OpenAI Agents SDK, making it easy to build agent-powered chat applications.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [AgentContext](#agentcontext)
- [ThreadItemConverter](#threaditemconverter)
- [Responding with Agents](#responding-with-agents)
- [Custom Converters](#custom-converters)
- [Streaming Widgets with Agents](#streaming-widgets-with-agents)
- [Advanced Topics](#advanced-topics)

## Overview

The agent integration helpers bridge ChatKit's thread model with the OpenAI Agents SDK's input format. They handle:

- Converting thread items to agent input format
- Managing agent context and state
- Streaming agent responses as ChatKit events
- Integrating widgets with agent workflows

## Quick Start

### Basic Agent Integration

```typescript
import { respondWithAgent, ThreadItemConverter } from "chatkit-ts";
import { Agent, Runner } from "@openai/agents";

class MyServer extends ChatKitServer {
  private agent: Agent;
  private runner: Runner;

  constructor(store: Store, agent: Agent, runner: Runner) {
    super(store);
    this.agent = agent;
    this.runner = runner;
  }

  async respond(thread, userMessage, context) {
    yield* respondWithAgent({
      agent: this.agent,
      runner: this.runner.runStreamed.bind(this.runner),
      store: this.store,
      thread,
      input: userMessage,
      context,
      converter: new ThreadItemConverter()
    });
  }
}
```

### Using Default Converter

For simple cases, you can use the default converter:

```typescript
import { simpleToAgentInput } from "chatkit-ts";

// Convert thread items to agent input
const input = await simpleToAgentInput([userMessage, assistantMessage]);
```

## AgentContext

`AgentContext` provides a context for agent runs with helper methods for streaming widgets and events.

### Properties

```typescript
class AgentContext<C> {
  thread: ThreadMetadata;
  store: StoreLike<C>;
  requestContext: C;
  previousResponseId: string | null;
  clientToolCall: ClientToolCall | null;
  workflowItem: WorkflowItem | null;
}
```

### Methods

#### streamWidget

Stream a widget into the agent response:

```typescript
async streamWidget<T extends WidgetRoot>(
  widget: T | AsyncGenerator<T, void, unknown>,
  copyText?: string | null
): Promise<void>;
```

**Example:**

```typescript
const ctx = new AgentContext({ thread, store, requestContext: context });

await ctx.streamWidget({
  type: "Card",
  children: [
    { type: "Text", value: "Processing..." }
  ]
});

// Widget events will be included in the agent response stream
```

#### stream

Manually enqueue a thread stream event:

```typescript
async stream(event: ThreadStreamEvent): Promise<void>;
```

**Example:**

```typescript
ctx.stream({
  type: "progress_update",
  text: "Analyzing data..."
});
```

#### generateId

Generate IDs for thread items:

```typescript
generateId(type: StoreItemType, thread?: ThreadMetadata): string;
```

**Example:**

```typescript
const messageId = ctx.generateId("message");
```

### Using AgentContext in Agents

Access the context from agent tools:

```typescript
const agent = new Agent({
  tools: [
    {
      name: "show_progress",
      handler: async (args, { context }) => {
        if (context instanceof AgentContext) {
          await context.streamWidget({
            type: "Card",
            children: [
              { type: "Text", value: args.message }
            ]
          });
        }
      }
    }
  ]
});
```

## ThreadItemConverter

`ThreadItemConverter` converts ChatKit thread items into the OpenAI Agents SDK's "easy input" format.

### Default Conversion

The default converter handles:

- `user_message` → `{ type: "message", role: "user", content: [...] }`
- `assistant_message` → `{ type: "message", role: "assistant", content: [...] }`
- `client_tool_call` → `{ type: "function_call", ... }` and `{ type: "function_call_output", ... }`
- `widget` → Simple text representation

### Extending the Converter

Override methods to customize conversion:

```typescript
class MyConverter extends ThreadItemConverter {
  async attachmentToMessageContent(attachment: Attachment): Promise<AgentInputContentPart> {
    return {
      type: "input_file",
      file_url: attachment.preview_url || attachment.upload_url
    };
  }

  async tagToMessageContent(tag: UserMessageTagContent): Promise<AgentInputContentPart> {
    return {
      type: "input_text",
      text: `@${tag.text} (${JSON.stringify(tag.data)})`
    };
  }

  async hiddenContextToInput(
    item: HiddenContextItem | SDKHiddenContextItem
  ): Promise<AgentInputItem | AgentInputItem[] | null> {
    return {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: item.content
        }
      ]
    };
  }

  async taskToInput(item: TaskItem): Promise<AgentInputItem | AgentInputItem[] | null> {
    // Convert task to agent input
    return {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: `Task: ${JSON.stringify(item.task)}`
        }
      ]
    };
  }

  async workflowToInput(item: WorkflowItem): Promise<AgentInputItem | AgentInputItem[] | null> {
    // Convert workflow to agent input
    return {
      type: "message",
      role: "system",
      content: [
        {
          type: "input_text",
          text: `Workflow: ${JSON.stringify(item.workflow)}`
        }
      ]
    };
  }

  async widgetToInput(item: WidgetItem): Promise<AgentInputItem | AgentInputItem[] | null> {
    // Custom widget representation
    return {
      type: "message",
      role: "user",
      content: [
        {
          type: "input_text",
          text: `Widget ${item.id}: ${item.copy_text || JSON.stringify(item.widget)}`
        }
      ]
    };
  }
}
```

### Input Content Types

The converter produces `AgentInputContentPart` objects:

```typescript
type AgentInputContentPart =
  | { type: "input_text"; text: string }
  | { type: "output_text"; text: string; annotations?: Annotation[] }
  | { type: "input_image"; image_url: { url: string } }
  | { type: "input_file"; file_id?: string; file_url?: string };
```

### Complete Example

```typescript
class EmailConverter extends ThreadItemConverter {
  async attachmentToMessageContent(attachment: Attachment): Promise<AgentInputContentPart> {
    // Email attachments as files
    if (attachment.type === "file") {
      return {
        type: "input_file",
        file_url: attachment.preview_url
      };
    }
    // Images as image inputs
    return {
      type: "input_image",
      image_url: {
        url: attachment.preview_url || ""
      }
    };
  }

  async tagToMessageContent(tag: UserMessageTagContent): Promise<AgentInputContentPart> {
    // Convert @mentions to structured input
    return {
      type: "input_text",
      text: `Mentioned: ${tag.text}\nData: ${JSON.stringify(tag.data)}`
    };
  }
}
```

## Responding with Agents

### Basic Usage

```typescript
import { respondWithAgent } from "chatkit-ts";

async respond(thread, userMessage, context) {
  yield* respondWithAgent({
    agent: this.agent,
    runner: this.runner.runStreamed.bind(this.runner),
    store: this.store,
    thread,
    input: userMessage,
    context,
    converter: new MyConverter()
  });
}
```

### Parameters

- `agent`: The agent instance
- `runner`: Runner with `runStreamed` method (or function)
- `store`: Store implementation
- `thread`: Current thread metadata
- `input`: User message or thread items to process
- `context`: Request context
- `converter`: Optional custom converter (defaults to `ThreadItemConverter`)

### Runner Types

The runner can be:

1. **Function**:

```typescript
const runner = async (agent, input, options) => {
  return agent.runStreamed(input, options);
};
```

2. **Object with method**:

```typescript
const runner = {
  runStreamed: async (agent, input, options) => {
    return agent.runStreamed(input, options);
  }
};
```

## Streaming Widgets with Agents

Combine agent responses with interactive widgets:

```typescript
import { respondWithAgent, AgentContext, accumulateText } from "chatkit-ts";

async respond(thread, userMessage, context) {
  const ctx = new AgentContext({ thread, store: this.store, requestContext: context });

  // Start streaming a widget
  ctx.streamWidget({
    type: "Card",
    children: [
      {
        type: "Text",
        id: "status",
        value: "",
        streaming: true
      }
    ]
  });

  // Stream agent response
  yield* respondWithAgent({
    agent: this.agent,
    runner: this.runner.runStreamed.bind(this.runner),
    store: this.store,
    thread,
    input: userMessage,
    context,
    converter: new MyConverter()
  });
}
```

### Accumulating Text into Widgets

Use `accumulateText` to build a widget incrementally:

```typescript
import { accumulateText } from "chatkit-ts";

async function* generateResponse(agentStream) {
  const baseWidget = {
    type: "Text",
    id: "response",
    value: "",
    streaming: true
  };

  yield* accumulateText(agentStream, baseWidget);
}
```

## Advanced Topics

### Client Tool Calls

Handle tool calls that require client-side execution:

```typescript
class MyConverter extends ThreadItemConverter {
  protected async clientToolCallToInput(
    item: ClientToolCallItem
  ): Promise<AgentInputItem | AgentInputItem[] | null> {
    if (item.status === "pending") {
      // Don't include pending tool calls
      return null;
    }

    const calls: AgentInputItem[] = [
      {
        type: "function_call",
        call_id: item.call_id,
        name: item.name,
        arguments: JSON.stringify(item.arguments ?? {})
      }
    ];

    if (item.output !== undefined) {
      calls.push({
        type: "function_call_output",
        call_id: item.call_id,
        output: JSON.stringify(item.output)
      });
    }

    return calls;
  }
}
```

### Quoted Text

Handle quoted text in user messages:

```typescript
class MyConverter extends ThreadItemConverter {
  protected async userMessageToInput(
    item: UserMessageItem,
    isLastMessage: boolean
  ): Promise<AgentInputItem | AgentInputItem[] | null> {
    const baseMessage = await super.userMessageToInput(item, isLastMessage);

    // Add quoted text as context if it's the last message
    if (item.quoted_text && isLastMessage) {
      return [
        baseMessage,
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: `The user is referring to this:\n${item.quoted_text}`
            }
          ]
        }
      ];
    }

    return baseMessage;
  }
}
```

### Custom Agent Input Format

Convert to custom input formats:

```typescript
class CustomConverter extends ThreadItemConverter {
  async toAgentInput(
    threadItems: ThreadItem[] | ThreadItem | unknown
  ): Promise<AgentInputItem[]> {
    // Get standard conversion
    const items = await super.toAgentInput(threadItems);

    // Transform to custom format
    return items.map(item => {
      if (item.type === "message" && item.role === "user") {
        // Add metadata
        return {
          ...item,
          metadata: {
            timestamp: new Date().toISOString()
          }
        };
      }
      return item;
    });
  }
}
```

### Error Handling

Handle conversion errors gracefully:

```typescript
class SafeConverter extends ThreadItemConverter {
  async attachmentToMessageContent(attachment: Attachment): Promise<AgentInputContentPart> {
    try {
      // Your conversion logic
      return {
        type: "input_file",
        file_url: attachment.preview_url || ""
      };
    } catch (error) {
      // Fallback to text representation
      return {
        type: "input_text",
        text: `Attachment: ${attachment.name} (${attachment.mime_type})`
      };
    }
  }
}
```

### Multi-Modal Inputs

Handle images and files:

```typescript
class MultiModalConverter extends ThreadItemConverter {
  async attachmentToMessageContent(attachment: Attachment): Promise<AgentInputContentPart> {
    if (attachment.type === "image") {
      return {
        type: "input_image",
        image_url: {
          url: attachment.preview_url || ""
        }
      };
    }

    return {
      type: "input_file",
      file_url: attachment.preview_url || "",
      file_id: attachment.id
    };
  }
}
```

## Best Practices

1. **Always handle attachments**: Implement `attachmentToMessageContent` for file/image support
2. **Preserve context**: Include hidden context and metadata when relevant
3. **Handle errors**: Provide fallbacks for unsupported item types
4. **Optimize conversion**: Cache expensive conversions when possible
5. **Use streaming**: Leverage `AgentContext.streamWidget` for real-time updates
6. **Test converters**: Write tests for edge cases (missing data, invalid formats, etc.)

## Examples

See the `example/` directory in the repository for complete working examples of agent integration.

