import type { StoreItemType } from "../store";
import { defaultGenerateId } from "../store";
import type {
  ThreadItemAddedEvent,
  ThreadItemDoneEvent,
  ThreadItemUpdatedEvent,
  ThreadMetadata,
  ThreadStreamEvent,
  WidgetItem,
  WidgetRootUpdated,
  WidgetStreamingTextValueDelta
} from "../types";
import type {
  WidgetComponent,
  WidgetComponentBase,
  WidgetRoot,
  Text
} from "../widgets";

function isStreamingText(component: WidgetComponentBase): component is Text {
  return (
    component.type === "Text" &&
    typeof (component as Text).value === "string"
  );
}

function fullReplace(before: WidgetComponentBase, after: WidgetComponentBase): boolean {
  if (before.type !== after.type || before.id !== after.id || before.key !== after.key) {
    return true;
  }

  const beforeRecord = before as unknown as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;
  const beforeEntries = Object.entries(beforeRecord);
  const afterEntries = Object.entries(afterRecord);
  const fields = new Set<string>([
    ...beforeEntries.map(([k]) => k),
    ...afterEntries.map(([k]) => k)
  ]);

  const fullReplaceValue = (
    beforeValue: unknown,
    afterValue: unknown
  ): boolean => {
    if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
      if (beforeValue.length !== afterValue.length) return true;
      for (let i = 0; i < beforeValue.length; i += 1) {
        if (fullReplaceValue(beforeValue[i], afterValue[i])) return true;
      }
      return false;
    }
    if (beforeValue !== afterValue) {
      if (
        typeof beforeValue === "object" &&
        beforeValue &&
        typeof afterValue === "object" &&
        afterValue &&
        "type" in (beforeValue as Record<string, unknown>) &&
        "type" in (afterValue as Record<string, unknown>)
      ) {
        return fullReplace(
          beforeValue as WidgetComponentBase,
          afterValue as WidgetComponentBase
        );
      }
      return true;
    }
    return false;
  };

  for (const field of fields) {
    if (
      isStreamingText(before) &&
      isStreamingText(after) &&
      field === "value" &&
      String((after as Text).value).startsWith(String((before as Text).value ?? ""))
    ) {
      // Appends to the `value` prop of Text components do not trigger a full
      // replace – they are handled as streaming deltas instead.
      continue;
    }
    if (
      isStreamingText(before) &&
      isStreamingText(after) &&
      field === "streaming"
    ) {
      // Changes to the `streaming` flag alone (e.g. true → false at the end of
      // a stream) should not be treated as a structural change that forces a
      // full widget replacement. They are captured via the `done` flag on
      // `widget.streaming_text.value_delta` updates.
      continue;
    }
    if (fullReplaceValue(beforeRecord[field], afterRecord[field])) {
      return true;
    }
  }

  return false;
}

export function diffWidget<T extends WidgetRoot>(
  before: T,
  after: T
): Array<WidgetStreamingTextValueDelta | WidgetRootUpdated<T>> {
  if (fullReplace(before, after)) {
    return [{ type: "widget.root.updated", widget: after }];
  }

  const deltas: Array<
    WidgetStreamingTextValueDelta | WidgetRootUpdated<T>
  > = [];

  const findAllStreamingTextComponents = (
    component: WidgetComponent | WidgetRoot
  ): Record<string, Text> => {
    const components: Record<string, Text> = {};

    const recurse = (comp: any) => {
      if (isStreamingText(comp) && comp.id) {
        components[comp.id] = comp as Text;
      }
      const children: any[] = comp.children ?? [];
      for (const child of children) {
        recurse(child);
      }
    };

    recurse(component);
    return components;
  };

  const beforeNodes = findAllStreamingTextComponents(before);
  const afterNodes = findAllStreamingTextComponents(after);

  for (const [id, afterNode] of Object.entries(afterNodes)) {
    const beforeNode = beforeNodes[id];
    if (!beforeNode) {
      throw new Error(
        `Node ${id} was not present when the widget was initially rendered. All nodes with ID must persist across all widget updates.`
      );
    }

    const beforeValue = String(beforeNode.value ?? "");
    const afterValue = String(afterNode.value ?? "");

    if (beforeValue !== afterValue) {
      if (!afterValue.startsWith(beforeValue)) {
        throw new Error(
          `Node ${id} was updated with a new value that is not a prefix of the initial value. All widget updates must be cumulative.`
        );
      }
      const done = !afterNode.streaming;
      deltas.push({
        type: "widget.streaming_text.value_delta",
        component_id: id,
        delta: afterValue.slice(beforeValue.length),
        done
      });
    }
  }

  return deltas;
}

export async function* streamWidget<T extends WidgetRoot>(
  thread: ThreadMetadata,
  widget: T | AsyncGenerator<T, void, unknown>,
  copyText?: string | null,
  generateId: (itemType: StoreItemType) => string = defaultGenerateId
): AsyncGenerator<ThreadStreamEvent<T>, void, unknown> {
  const itemId = generateId("message");

  const asyncIterator =
    (widget as AsyncGenerator<T, void, unknown>)[
      Symbol.asyncIterator
    ];

  if (typeof asyncIterator !== "function") {
    const item: WidgetItem<T> = {
      type: "widget",
      id: itemId,
      thread_id: thread.id,
      created_at: new Date(),
      widget: widget as T,
      copy_text: copyText ?? null
    };
    const event: ThreadItemDoneEvent<T> = {
      type: "thread.item.done",
      item
    };
    yield event;
    return;
  }

  const asyncGen = widget as AsyncGenerator<T, void, unknown>;
  const initialState = await asyncGen.next();
  if (initialState.done || !initialState.value) {
    return;
  }

  const item: WidgetItem<T> = {
    type: "widget",
    id: itemId,
    thread_id: thread.id,
    created_at: new Date(),
    widget: initialState.value,
    copy_text: copyText ?? null
  };

  const addedEvent: ThreadItemAddedEvent<T> = {
    type: "thread.item.added",
    item
  };
  yield addedEvent;

  let lastState: T = initialState.value;

  while (true) {
    const nextState = await asyncGen.next();
    if (nextState.done || !nextState.value) {
      break;
    }
    const updates = diffWidget(lastState, nextState.value);
    for (const update of updates) {
      const updatedEvent: ThreadItemUpdatedEvent<T> = {
        type: "thread.item.updated",
        item_id: itemId,
        update
      };
      yield updatedEvent;
    }
    lastState = nextState.value;
  }

  const doneEvent: ThreadItemDoneEvent<T> = {
    type: "thread.item.done",
    item: { ...item, widget: lastState }
  };
  yield doneEvent;
}

export function isStreamingReq(request: any): boolean {
  const streamingTypes = new Set<string>([
    "threads.create",
    "threads.add_user_message",
    "threads.add_client_tool_output",
    "threads.retry_after_item",
    "threads.custom_action"
  ]);
  return typeof request?.type === "string" && streamingTypes.has(request.type);
}

