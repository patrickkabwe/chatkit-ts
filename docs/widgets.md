# Widgets Documentation

Widgets are interactive UI components that can be streamed and updated in real-time. They provide a declarative way to build rich, interactive interfaces in chat applications.

## Table of Contents

- [Overview](#overview)
- [Widget Types](#widget-types)
- [Streaming Widgets](#streaming-widgets)
- [Actions](#actions)
- [Forms](#forms)
- [Layout Components](#layout-components)
- [Input Components](#input-components)
- [Display Components](#display-components)
- [Charts](#charts)
- [Widget Templates](#widget-templates)

## Overview

Widgets are JSON-serializable objects that describe UI components. They are:

- **Type-safe**: Full TypeScript definitions for all widget types
- **Streamable**: Support incremental updates during generation
- **Interactive**: Can trigger server-side actions via buttons, forms, etc.
- **Composable**: Can be nested to build complex UIs

### Basic Widget Structure

All widgets extend `WidgetComponentBase`:

```typescript
interface WidgetComponentBase {
  type: string;
  id?: string | null;
  key?: string | null;
}
```

### Widget Roots

Top-level widgets must be one of:

- `Card`: Versatile container with optional footer actions
- `ListView`: Container for lists of items
- `Basic`: Layout root for nesting components

## Widget Types

### Layout Components

#### Box / Row / Col

Flexbox containers with direction control.

```typescript
{
  type: "Box",
  direction: "row" | "col",
  children: WidgetComponent[],
  gap: number | string,
  padding: number | string | Spacing,
  margin: number | string | Spacing,
  align: Alignment,
  justify: Justification,
  // ... layout properties
}
```

**Example:**

```typescript
{
  type: "Row",
  gap: 16,
  children: [
    { type: "Text", value: "Left" },
    { type: "Text", value: "Right" }
  ]
}
```

#### Spacer

Flexible spacer for pushing content apart.

```typescript
{
  type: "Spacer",
  minSize: number | string
}
```

#### Divider

Visual separator between sections.

```typescript
{
  type: "Divider",
  color: string | ThemeColor,
  size: number | string,
  spacing: number | string,
  flush: boolean
}
```

### Display Components

#### Text

Plain text with typography controls.

```typescript
{
  type: "Text",
  value: string,
  streaming?: boolean,  // Enable streaming transitions
  size: "xs" | "sm" | "md" | "lg" | "xl",
  color: string | ThemeColor,
  weight: "normal" | "medium" | "semibold" | "bold",
  italic: boolean,
  lineThrough: boolean,
  textAlign: "start" | "center" | "end",
  truncate: boolean,
  maxLines: number,
  editable: false | EditableProps  // Enable inline editing
}
```

**Streaming Example:**

```typescript
// Initial state
{ type: "Text", id: "text1", value: "Hello", streaming: true }

// Updates stream text deltas
// Final state
{ type: "Text", id: "text1", value: "Hello, world!", streaming: false }
```

#### Title

Prominent headline text.

```typescript
{
  type: "Title",
  value: string,
  size: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl",
  color: string | ThemeColor,
  weight: "normal" | "medium" | "semibold" | "bold",
  textAlign: "start" | "center" | "end",
  truncate: boolean,
  maxLines: number
}
```

#### Caption

Supporting caption text.

```typescript
{
  type: "Caption",
  value: string,
  size: "sm" | "md" | "lg",
  color: string | ThemeColor,
  weight: "normal" | "medium" | "semibold" | "bold",
  textAlign: "start" | "center" | "end",
  truncate: boolean,
  maxLines: number
}
```

#### Markdown

Markdown content renderer.

```typescript
{
  type: "Markdown",
  value: string,
  streaming?: boolean  // Enable streaming transitions
}
```

#### Badge

Small status or category indicator.

```typescript
{
  type: "Badge",
  label: string,
  color: "secondary" | "success" | "danger" | "warning" | "info" | "discovery",
  variant: "solid" | "soft" | "outline",
  size: "sm" | "md" | "lg",
  pill: boolean
}
```

#### Image

Image component with sizing and fitting controls.

```typescript
{
  type: "Image",
  src: string,
  alt: string,
  fit: "cover" | "contain" | "fill" | "scale-down" | "none",
  position: "top left" | "top" | "top right" | "left" | "center" | "right" | "bottom left" | "bottom" | "bottom right",
  radius: RadiusValue,
  frame: boolean,
  flush: boolean,
  width: number | string,
  height: number | string,
  aspectRatio: number | string
}
```

#### Icon

Icon component using built-in icon set.

```typescript
{
  type: "Icon",
  name: IconName,  // See icons.ts for available icons
  color: string | ThemeColor,
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl"
}
```

### Container Components

#### Card

Versatile container with optional actions.

```typescript
{
  type: "Card",
  children: WidgetComponent[],
  asForm: boolean,  // Enable form submission
  background: string | ThemeColor,
  size: "sm" | "md" | "lg" | "full",
  padding: number | string | Spacing,
  status: WidgetStatus,
  collapsed: boolean,
  confirm: CardAction,  // Confirm button
  cancel: CardAction,   // Cancel button
  theme: "light" | "dark"
}
```

**Example:**

```typescript
{
  type: "Card",
  children: [
    { type: "Title", value: "Confirm Action" },
    { type: "Text", value: "Are you sure?" }
  ],
  confirm: {
    label: "Confirm",
    action: { type: "confirm", payload: { id: "123" } }
  },
  cancel: {
    label: "Cancel",
    action: { type: "cancel", payload: null }
  }
}
```

#### ListView

Container for lists of items.

```typescript
{
  type: "ListView",
  children: ListViewItem[],
  limit: number | "auto",
  status: WidgetStatus,
  theme: "light" | "dark"
}
```

**ListViewItem:**

```typescript
{
  type: "ListViewItem",
  children: WidgetComponent[],
  onClickAction: ActionConfig,
  gap: number | string,
  align: Alignment
}
```

**Example:**

```typescript
{
  type: "ListView",
  children: [
    {
      type: "ListViewItem",
      children: [
        { type: "Text", value: "Item 1" }
      ],
      onClickAction: { type: "select", payload: { id: 1 } }
    },
    {
      type: "ListViewItem",
      children: [
        { type: "Text", value: "Item 2" }
      ],
      onClickAction: { type: "select", payload: { id: 2 } }
    }
  ]
}
```

### Input Components

#### Input

Single-line text input.

```typescript
{
  type: "Input",
  name: string,
  inputType: "number" | "email" | "text" | "password" | "tel" | "url",
  defaultValue: string,
  required: boolean,
  pattern: string,
  placeholder: string,
  autoFocus: boolean,
  autoSelect: boolean,
  allowAutofillExtensions: boolean,
  disabled: boolean,
  variant: "soft" | "outline",
  size: ControlSize,
  gutterSize: "2xs" | "xs" | "sm" | "md" | "lg" | "xl",
  pill: boolean
}
```

#### Textarea

Multiline text input.

```typescript
{
  type: "Textarea",
  name: string,
  defaultValue: string,
  required: boolean,
  pattern: string,
  placeholder: string,
  autoFocus: boolean,
  autoSelect: boolean,
  disabled: boolean,
  variant: "soft" | "outline",
  size: ControlSize,
  gutterSize: "2xs" | "xs" | "sm" | "md" | "lg" | "xl",
  rows: number,
  autoResize: boolean,
  maxRows: number,
  allowAutofillExtensions: boolean
}
```

#### Select

Dropdown selection.

```typescript
{
  type: "Select",
  name: string,
  options: SelectOption[],
  onChangeAction: ActionConfig,
  placeholder: string,
  defaultValue: string,
  variant: ControlVariant,
  size: ControlSize,
  pill: boolean,
  block: boolean,
  clearable: boolean,
  disabled: boolean
}

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
}
```

#### Checkbox

Checkbox input.

```typescript
{
  type: "Checkbox",
  name: string,
  label: string,
  defaultChecked: boolean,
  onChangeAction: ActionConfig,
  disabled: boolean,
  required: boolean
}
```

#### RadioGroup

Grouped radio buttons.

```typescript
{
  type: "RadioGroup",
  name: string,
  options: RadioOption[],
  onChangeAction: ActionConfig,
  ariaLabel: string,
  defaultValue: string,
  direction: "row" | "col",
  disabled: boolean,
  required: boolean
}

interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}
```

#### DatePicker

Date picker input.

```typescript
{
  type: "DatePicker",
  name: string,
  onChangeAction: ActionConfig,
  placeholder: string,
  defaultValue: Date,
  min: Date,
  max: Date,
  variant: ControlVariant,
  size: ControlSize,
  side: "top" | "bottom" | "left" | "right",
  align: "start" | "center" | "end",
  pill: boolean,
  block: boolean,
  clearable: boolean,
  disabled: boolean
}
```

#### Label

Form label.

```typescript
{
  type: "Label",
  value: string,
  fieldName: string,
  size: TextSize,
  weight: "normal" | "medium" | "semibold" | "bold",
  textAlign: "start" | "center" | "end",
  color: string | ThemeColor
}
```

#### Button

Button component.

```typescript
{
  type: "Button",
  submit: boolean,  // Submit form button
  label: string,
  onClickAction: ActionConfig,
  iconStart: WidgetIcon,
  iconEnd: WidgetIcon,
  style: "primary" | "secondary",
  iconSize: "sm" | "md" | "lg" | "xl" | "2xl",
  color: "primary" | "secondary" | "info" | "discovery" | "success" | "caution" | "warning" | "danger",
  variant: ControlVariant,
  size: ControlSize,
  pill: boolean,
  uniform: boolean,
  block: boolean,
  disabled: boolean
}
```

#### Form

Form wrapper for collecting data.

```typescript
{
  type: "Form",
  onSubmitAction: ActionConfig,
  direction: "row" | "col",
  children: WidgetComponent[],
  // ... all BoxBase properties
}
```

### Charts

#### Chart

Data visualization component.

```typescript
{
  type: "Chart",
  data: Array<Record<string, string | number>>,
  series: Series[],
  xAxis: string | XAxisConfig,
  showYAxis: boolean,
  showLegend: boolean,
  showTooltip: boolean,
  barGap: number,
  barCategoryGap: number,
  height: number | string,
  width: number | string,
  aspectRatio: number | string
}

type Series = BarSeries | AreaSeries | LineSeries;

interface BarSeries {
  type: "bar";
  label: string;
  dataKey: string;
  stack?: string;
  color?: string | ThemeColor;
}

interface AreaSeries {
  type: "area";
  label: string;
  dataKey: string;
  stack?: string;
  color?: string | ThemeColor;
  curveType?: CurveType;
}

interface LineSeries {
  type: "line";
  label: string;
  dataKey: string;
  color?: string | ThemeColor;
  curveType?: CurveType;
}
```

**Example:**

```typescript
{
  type: "Chart",
  data: [
    { month: "Jan", sales: 100, expenses: 80 },
    { month: "Feb", sales: 120, expenses: 90 },
    { month: "Mar", sales: 150, expenses: 100 }
  ],
  series: [
    { type: "bar", label: "Sales", dataKey: "sales" },
    { type: "bar", label: "Expenses", dataKey: "expenses" }
  ],
  xAxis: "month",
  showYAxis: true,
  showLegend: true
}
```

### Utility Components

#### Transition

Wrapper for animating layout changes.

```typescript
{
  type: "Transition",
  children: WidgetComponent
}
```

## Streaming Widgets

Widgets support real-time streaming updates. This is especially useful for:

- Progressive text generation
- Loading states
- Real-time data updates

### Streaming Text

Use the `streaming` property on `Text` and `Markdown` components:

```typescript
// Initial widget
{
  type: "Text",
  id: "output",
  value: "Hello",
  streaming: true
}

// Update via streaming delta
// value: "Hello, world!"
// streaming: true

// Final update
// value: "Hello, world!",
// streaming: false
```

### Streaming Widgets in Code

```typescript
import { streamWidget } from "chatkit-ts";

async function* generateWidget() {
  // Initial state
  yield {
    type: "Card",
    children: [
      {
        type: "Text",
        id: "status",
        value: "Loading",
        streaming: true
      }
    ]
  };

  // Update
  await new Promise(resolve => setTimeout(resolve, 1000));
  yield {
    type: "Card",
    children: [
      {
        type: "Text",
        id: "status",
        value: "Loading...",
        streaming: true
      }
    ]
  };

  // Final state
  await new Promise(resolve => setTimeout(resolve, 1000));
  yield {
    type: "Card",
    children: [
      {
        type: "Text",
        id: "status",
        value: "Complete!",
        streaming: false
      }
    ]
  };
}

for await (const event of streamWidget(thread, generateWidget())) {
  // Stream events: thread.item.added, thread.item.updated, thread.item.done
}
```

## Actions

Actions are triggered when users interact with widgets (buttons, form submissions, etc.).

### Action Configuration

```typescript
interface ActionConfig {
  type: string;
  payload: any | null;
  handler: "client" | "server";
  loadingBehavior: "auto" | "none" | "self" | "container";
}
```

### Creating Actions

```typescript
import { Action } from "chatkit-ts";

// Method 1: Using Action.create()
const action = Action.create("my_action", { id: "123" });

// Method 2: Using subclass
class MyAction extends Action<"my_action", { id: string }> {
  static type = "my_action" as const;
}

const action2 = MyAction.create({ id: "123" });
```

### Handling Actions

Override the `action()` method in your server:

```typescript
class MyServer extends ChatKitServer {
  async action(thread, action, sender, context) {
    if (action.type === "my_action") {
      const { id } = action.payload;
      // Handle the action
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
}
```

## Forms

Forms collect user input and submit data to the server.

### Creating Forms

```typescript
{
  type: "Form",
  onSubmitAction: {
    type: "submit_form",
    payload: null,
    handler: "server"
  },
  children: [
    {
      type: "Label",
      value: "Name",
      fieldName: "name"
    },
    {
      type: "Input",
      name: "name",
      placeholder: "Enter your name",
      required: true
    },
    {
      type: "Button",
      label: "Submit",
      submit: true
    }
  ]
}
```

### Handling Form Submissions

When a form is submitted, the action payload contains all form data:

```typescript
async action(thread, action, sender, context) {
  if (action.type === "submit_form") {
    // Access form data from the action context
    const formData = action.payload;  // Contains all form field values
    // Process form data
  }
}
```

## Widget Templates

Widget templates allow you to define reusable widget structures with data binding.

### Loading Templates

```typescript
import { WidgetTemplate } from "chatkit-ts";

// From file
const template = WidgetTemplate.fromFile("./widgets/my-widget.widget");

// From definition
const template = new WidgetTemplate({
  version: "1.0",
  name: "MyWidget",
  template: (data) => JSON.stringify({
    type: "Card",
    children: [
      { type: "Title", value: data.title },
      { type: "Text", value: data.description }
    ]
  })
});
```

### Building Widgets from Templates

```typescript
const widget = template.build({
  title: "Hello",
  description: "World"
});
```

### Template File Format

```json
{
  "version": "1.0",
  "name": "MyWidget",
  "template": "{\"type\":\"Card\",\"children\":[{\"type\":\"Title\",\"value\":\"{{title}}\"}]}",
  "jsonSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" }
    }
  },
  "outputJsonPreview": {
    "type": "Card",
    "children": [{"type": "Title", "value": "Example"}]
  }
}
```

## Theme Support

Widgets support theme-aware colors and styling:

```typescript
{
  type: "Text",
  value: "Theme-aware text",
  color: {
    light: "#000000",
    dark: "#ffffff"
  }
}
```

## Best Practices

1. **Use IDs for streaming**: Always provide `id` for components that will be streamed
2. **Incremental updates**: Widget updates must be cumulative (append-only for text)
3. **Action handlers**: Always provide action handlers for interactive widgets
4. **Form validation**: Use `required`, `pattern`, and validation on inputs
5. **Accessibility**: Use `ariaLabel` for radio groups and provide `alt` text for images
6. **Performance**: Use `limit` on ListView to avoid rendering too many items
7. **Responsive design**: Use flexible sizing (`flex`, `minWidth`, `maxWidth`) instead of fixed pixels

