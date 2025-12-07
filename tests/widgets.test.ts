import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "bun:test";
import { diffWidget } from "../src/helpers";
import type {
  WidgetRootUpdated,
  WidgetStreamingTextValueDelta
} from "../src/types";
import {
  type BasicRoot,
  type Card,
  type DynamicWidgetRoot,
  type Text,
  WidgetTemplate
} from "../src/widgets";

function card(children: Text[]): Card {
  return { type: "Card", children };
}

describe("diffWidget (basic Text/Card behavior)", () => {
  it("returns empty diff when widgets are identical", () => {
    const before = card([]);
    const after = card([]);
    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(0);
  });

  it("emits streaming text delta when value is extended and still streaming", () => {
    const before = card([{ type: "Text", id: "text", value: "Hello", streaming: true }]);
    const after = card([
      { type: "Text", id: "text", value: "Hello, world!", streaming: true }
    ]);

    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(1);
    const update = diff[0] as WidgetStreamingTextValueDelta;
    expect(update.type).toBe("widget.streaming_text.value_delta");
    expect(update.component_id).toBe("text");
    expect(update.delta).toBe(", world!");
    expect(update.done).toBe(false);
  });

  it("emits streaming text delta when value is extended and streaming flag changes to false", () => {
    const before = card([{ type: "Text", id: "text", value: "Hello", streaming: true }]);
    const after = card([
      { type: "Text", id: "text", value: "Hello, world!", streaming: false }
    ]);

    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(1);
    const update = diff[0] as WidgetStreamingTextValueDelta;
    expect(update.type).toBe("widget.streaming_text.value_delta");
    expect(update.component_id).toBe("text");
    expect(update.delta).toBe(", world!");
    expect(update.done).toBe(true);
  });

  it("emits root.updated when non-streaming text changes", () => {
    const before = card([{ type: "Text", value: "Hello" }]);
    const after = card([{ type: "Text", value: "world!" }]);

    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(1);
    const update = diff[0] as WidgetRootUpdated<Card>;
    expect(update.type).toBe("widget.root.updated");
  });
});

describe("diffWidget (DynamicWidgetRoot behavior)", () => {
  function dynamicCard(children: any[]): DynamicWidgetRoot {
    return { type: "Card", children } as DynamicWidgetRoot;
  }

  it("returns empty diff when dynamic widgets are identical", () => {
    const before = dynamicCard([]);
    const after = dynamicCard([]);
    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(0);
  });

  it("emits streaming text delta when value is extended and still streaming", () => {
    const before = dynamicCard([
      { type: "Text", id: "text", value: "Hello", streaming: true }
    ]);
    const after = dynamicCard([
      { type: "Text", id: "text", value: "Hello, world!", streaming: true }
    ]);

    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(1);
    const update = diff[0] as WidgetStreamingTextValueDelta;
    expect(update.type).toBe("widget.streaming_text.value_delta");
    expect(update.component_id).toBe("text");
    expect(update.delta).toBe(", world!");
    expect(update.done).toBe(false);
  });

  it("emits streaming text delta when value is extended and streaming flag changes to false", () => {
    const before = dynamicCard([
      { type: "Text", id: "text", value: "Hello", streaming: true }
    ]);
    const after = dynamicCard([
      { type: "Text", id: "text", value: "Hello, world!", streaming: false }
    ]);

    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(1);
    const update = diff[0] as WidgetStreamingTextValueDelta;
    expect(update.type).toBe("widget.streaming_text.value_delta");
    expect(update.component_id).toBe("text");
    expect(update.delta).toBe(", world!");
    expect(update.done).toBe(true);
  });

  it("emits root.updated when non-streaming text changes", () => {
    const before = dynamicCard([{ type: "Text", value: "Hello" }]);
    const after = dynamicCard([{ type: "Text", value: "world!" }]);

    const diff = diffWidget(before, after);
    expect(diff).toHaveLength(1);
    const update = diff[0] as WidgetRootUpdated<DynamicWidgetRoot>;
    expect(update.type).toBe("widget.root.updated");
  });
});

describe("WidgetTemplate.fromFile", () => {
  const widgetCases: Array<{
    widgetName: string;
    data: any | null;
  }> = [
    { widgetName: "list_view_no_data", data: null },
    { widgetName: "card_no_data", data: null },
    {
      widgetName: "list_view_with_data",
      data: {
        items: [
          { id: "blue", label: "Blue line", color: "blue-500" },
          { id: "orange", label: "Orange line", color: "orange-500" },
          { id: "purple", label: "Purple line", color: "purple-500" }
        ]
      }
    },
    {
      widgetName: "card_with_data",
      data: {
        channel: "#proj-chatkit",
        time: "4:48 PM",
        user: {
          image: "/pam.png",
          name: "Pam Beesly"
        }
      }
    }
  ];

  it.each(widgetCases)(
    "builds DynamicWidgetRoot from $widgetName.widget",
    ({ widgetName, data }) => {
      const widgetPath = join(
        __dirname,
        "assets",
        "widgets",
        `${widgetName}.widget`
      );
      const template = WidgetTemplate.fromFile(widgetPath);

      const expectedPath = join(
        __dirname,
        "assets",
        "widgets",
        `${widgetName}.json`
      );
      const expectedWidgetDict = JSON.parse(
        readFileSync(expectedPath, "utf-8")
      );

      const widget = template.build(data ?? undefined);

      expect(widget).toBeDefined();
      expect((widget as DynamicWidgetRoot).type).toBeDefined();
      expect(widget).toEqual(expectedWidgetDict);
    }
  );
});

describe("WidgetTemplate.withBasicRoot", () => {
  it("builds BasicRoot from basic_root.widget", () => {
    const widgetPath = join(
      __dirname,
      "assets",
      "widgets",
      "basic_root.widget"
    );
    const template = WidgetTemplate.fromFile(widgetPath);

    const expectedPath = join(
      __dirname,
      "assets",
      "widgets",
      "basic_root.json"
    );
    const expectedWidgetDict = JSON.parse(
      readFileSync(expectedPath, "utf-8")
    );

    const widget = template.build_basic({
      name: "Harry Potter",
      bio: "The boy who lived"
    });

    expect(widget).toBeDefined();
    expect((widget as BasicRoot).type).toBe("Basic");
    expect(widget).toEqual(expectedWidgetDict);
  });
});

describe("WidgetTemplate constructor", () => {
  it("creates template from string template", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: '{"type": "Card", "children": []}'
    });

    expect(template.version).toBe("1.0");
    expect(template.name).toBe("test");
    const widget = template.build();
    expect(widget.type).toBe("Card");
  });

  it("creates template from function template", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: (data) => JSON.stringify({
        type: "Card",
        children: [{ type: "Text", value: data.message || "default" }]
      })
    });

    const widget = template.build({ message: "Hello" });
    expect(widget.type).toBe("Card");
    expect((widget as any).children[0].value).toBe("Hello");
  });

  it("throws on unsupported version", () => {
    expect(() => {
      new WidgetTemplate({
        version: "2.0" as any,
        name: "test",
        template: "{}"
      });
    }).toThrow("Unsupported widget spec version: 2.0");
  });

  it("handles jsonSchema", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: "{}",
      jsonSchema: { type: "object", properties: { name: { type: "string" } } }
    });

    expect(template.dataSchema).toEqual({
      type: "object",
      properties: { name: { type: "string" } }
    });
  });

  it("defaults jsonSchema to empty object", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: "{}"
    });

    expect(template.dataSchema).toEqual({});
  });
});

describe("WidgetTemplate.build error handling", () => {
  it("falls back to outputPreview when JSON parsing fails", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: "invalid json",
      outputJsonPreview: { type: "Card", children: [] }
    });

    const widget = template.build();
    expect(widget.type).toBe("Card");
  });

  it("throws when JSON parsing fails and no outputPreview", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: "invalid json"
    });

    expect(() => template.build()).toThrow();
  });

  it("handles function template that returns invalid JSON", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: () => "invalid json",
      outputJsonPreview: { type: "ListView", children: [] }
    });

    const widget = template.build();
    expect(widget.type).toBe("ListView");
  });
});

describe("WidgetTemplate.build_basic error handling", () => {
  it("falls back to outputPreview when JSON parsing fails", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: "invalid json",
      outputJsonPreview: { type: "Basic" }
    });

    const widget = template.build_basic();
    expect(widget.type).toBe("Basic");
  });

  it("throws when JSON parsing fails and no outputPreview", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: "invalid json"
    });

    expect(() => template.build_basic()).toThrow();
  });
});

describe("WidgetTemplate data normalization", () => {
  it("handles undefined data", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: (data) => JSON.stringify({ data })
    });

    const widget = template.build();
    expect((widget as any).data).toEqual({});
  });

  it("handles null data", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: (data) => JSON.stringify({ data })
    });

    const widget = template.build(null as any);
    expect((widget as any).data).toEqual({});
  });

  it("passes through valid data", () => {
    const template = new WidgetTemplate({
      version: "1.0",
      name: "test",
      template: (data) => JSON.stringify({ type: "Card", value: data.value })
    });

    const widget = template.build({ value: "test" });
    expect((widget as any).value).toBe("test");
  });
});
