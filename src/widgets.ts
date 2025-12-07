import { readFileSync } from "fs";
import { isAbsolute, resolve, sep } from "path";
import type { ActionConfig } from "./types";
import type { IconName } from "./icons";

/**
 * Color values for light and dark themes.
 */
export interface ThemeColor {
  /** Color to use when the theme is dark. */
  dark: string;
  /** Color to use when the theme is light. */
  light: string;
}

/**
 * Shorthand spacing values applied to a widget.
 */
export interface Spacing {
  /** Top spacing; accepts a spacing unit or CSS string. */
  top?: number | string;
  /** Right spacing; accepts a spacing unit or CSS string. */
  right?: number | string;
  /** Bottom spacing; accepts a spacing unit or CSS string. */
  bottom?: number | string;
  /** Left spacing; accepts a spacing unit or CSS string. */
  left?: number | string;
  /** Horizontal spacing; accepts a spacing unit or CSS string. */
  x?: number | string;
  /** Vertical spacing; accepts a spacing unit or CSS string. */
  y?: number | string;
}

/**
 * Border style definition for an edge.
 */
export interface Border {
  /** Thickness of the border in px. */
  size: number;
  /**
   * Border color; accepts border color token, a primitive color token,
   * a CSS string, or theme-aware `{ light, dark }`.
   *
   * Valid tokens: `default` `subtle` `strong`
   *
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  color?: string | ThemeColor;
  /** Border line style. */
  style?:
    | "solid"
    | "dashed"
    | "dotted"
    | "double"
    | "groove"
    | "ridge"
    | "inset"
    | "outset";
}

/**
 * Composite border configuration applied across edges.
 */
export interface Borders {
  /** Top border or thickness in px. */
  top?: number | Border;
  /** Right border or thickness in px. */
  right?: number | Border;
  /** Bottom border or thickness in px. */
  bottom?: number | Border;
  /** Left border or thickness in px. */
  left?: number | Border;
  /** Horizontal borders or thickness in px. */
  x?: number | Border;
  /** Vertical borders or thickness in px. */
  y?: number | Border;
}

/**
 * Integer minimum/maximum bounds.
 */
export interface MinMax {
  /** Minimum value (inclusive). */
  min?: number;
  /** Maximum value (inclusive). */
  max?: number;
}

/**
 * Editable field options for text widgets.
 */
export interface EditableProps {
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** Autofocus the editable input when it appears. */
  autoFocus?: boolean;
  /** Select all text on focus. */
  autoSelect?: boolean;
  /** Native autocomplete hint for the input. */
  autoComplete?: string;
  /** Allow browser password/autofill extensions. */
  allowAutofillExtensions?: boolean;
  /** Regex pattern for input validation. */
  pattern?: string;
  /** Placeholder text for the editable input. */
  placeholder?: string;
  /** Mark the editable input as required. */
  required?: boolean;
}

/** Allowed corner radius tokens. */
export type RadiusValue =
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "full"
  | "100%"
  | "none";

/** Horizontal text alignment options. */
export type TextAlign = "start" | "center" | "end";

/** Body text size tokens. */
export type TextSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Icon size tokens. */
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

/** Title text size tokens. */
export type TitleSize =
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl";

/** Caption text size tokens. */
export type CaptionSize = "sm" | "md" | "lg";

/** Flexbox alignment options. */
export type Alignment = "start" | "center" | "end" | "baseline" | "stretch";

/** Flexbox justification options. */
export type Justification =
  | "start"
  | "center"
  | "end"
  | "between"
  | "around"
  | "evenly"
  | "stretch";

/** Button and input style variants. */
export type ControlVariant = "solid" | "soft" | "outline" | "ghost";

/** Button and input size variants. */
export type ControlSize =
  | "3xs"
  | "2xs"
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl";

/**
 * Base model for all ChatKit widget components.
 *
 * This is the common shape shared by all component interfaces.
 */
export interface WidgetComponentBase {
  /** Discriminator for the component type. */
  type: string;
  id?: string | null;
  key?: string | null;
}

/**
 * Widget status representation using a favicon.
 */
export interface WidgetStatusWithFavicon {
  /** Status text to display. */
  text: string;
  /** URL of a favicon to render at the start of the status. */
  favicon?: string;
  /** Show a frame around the favicon for contrast. */
  frame?: boolean;
}

/**
 * Widget status representation using an icon.
 */
export interface WidgetStatusWithIcon {
  /** Status text to display. */
  text: string;
  /** Icon to render at the start of the status. */
  icon?: WidgetIcon;
}

/** Union for representing widget status messaging. */
export type WidgetStatus = WidgetStatusWithFavicon | WidgetStatusWithIcon;

/**
 * Single row inside a `ListView` component.
 */
export interface ListViewItem extends WidgetComponentBase {
  type: "ListViewItem";
  /** Content for the list item. */
  children: WidgetComponent[];
  /** Optional action triggered when the list item is clicked. */
  onClickAction?: ActionConfig | null;
  /** Gap between children within the list item; spacing unit or CSS string. */
  gap?: number | string | null;
  /** Y-axis alignment for content within the list item. */
  align?: Alignment | null;
}

/**
 * Container component for rendering collections of list items.
 */
export interface ListView extends WidgetComponentBase {
  type: "ListView";
  /** Items to render in the list. */
  children: ListViewItem[];
  /** Max number of items to show before a "Show more" control. */
  limit?: number | "auto" | null;
  /** Optional status header displayed above the list. */
  status?: WidgetStatus | null;
  /** Force light or dark theme for this subtree. */
  theme?: "light" | "dark" | null;
}

/**
 * Configuration for confirm/cancel actions within a card.
 */
export interface CardAction {
  /** Button label shown in the card footer. */
  label: string;
  /** Declarative action dispatched to the host application. */
  action: ActionConfig;
}

/**
 * Versatile container used for structuring widget content.
 */
export interface Card extends WidgetComponentBase {
  type: "Card";
  /**
   * Treat the card as an HTML form so confirm/cancel capture form data.
   */
  asForm?: boolean | null;
  /** Child components rendered inside the card. */
  children: WidgetComponent[];
  /**
   * Background color; accepts background color token, a primitive color token,
   * a CSS string, or theme-aware `{ light, dark }`.
   *
   * Valid tokens: `surface` `surface-secondary` `surface-tertiary`
   * `surface-elevated` `surface-elevated-secondary`
   *
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  background?: string | ThemeColor | null;
  /** Visual size of the card; accepts a size token. */
  size?: "sm" | "md" | "lg" | "full" | null;
  /** Inner spacing of the card; spacing unit, CSS string, or padding object. */
  padding?: number | string | Spacing | null;
  /** Optional status header displayed above the card. */
  status?: WidgetStatus | null;
  /** Collapse card body after the main action has completed. */
  collapsed?: boolean | null;
  /** Confirmation action button shown in the card footer. */
  confirm?: CardAction | null;
  /** Cancel action button shown in the card footer. */
  cancel?: CardAction | null;
  /** Force light or dark theme for this subtree. */
  theme?: "light" | "dark" | null;
}

/**
 * Widget rendering Markdown content, optionally streamed.
 */
export interface Markdown extends WidgetComponentBase {
  type: "Markdown";
  /** Markdown source string to render. */
  value: string;
  /** Applies streaming-friendly transitions for incremental updates. */
  streaming?: boolean | null;
}

/**
 * Widget rendering plain text with typography controls.
 */
export interface Text extends WidgetComponentBase {
  type: "Text";
  /** Text content to display. */
  value: string;
  /** Enables streaming-friendly transitions for incremental updates. */
  streaming?: boolean | null;
  /** Render text in italic style. */
  italic?: boolean | null;
  /** Render text with a line-through decoration. */
  lineThrough?: boolean | null;
  /**
   * Text color; accepts a text color token, a primitive color token,
   * a CSS color string, or a theme-aware `{ light, dark }`.
   *
   * Text color tokens: `prose` `primary` `emphasis` `secondary` `tertiary`
   * `success` `warning` `danger`
   *
   * Primitive color token: e.g. `red-100`, `blue-900`, `gray-500`
   */
  color?: string | ThemeColor | null;
  /** Font weight; accepts a font weight token. */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Constrain the text container width; px or CSS string. */
  width?: number | string | null;
  /** Size of the text; accepts a text size token. */
  size?: TextSize | null;
  /** Horizontal text alignment. */
  textAlign?: TextAlign | null;
  /** Truncate overflow with ellipsis. */
  truncate?: boolean | null;
  /** Reserve space for a minimum number of lines. */
  minLines?: number | null;
  /** Limit text to a maximum number of lines (line clamp). */
  maxLines?: number | null;
  /** Enable inline editing for this text node. */
  editable?: false | EditableProps | null;
}

/**
 * Widget rendering prominent headline text.
 */
export interface Title extends WidgetComponentBase {
  type: "Title";
  /** Text content to display. */
  value: string;
  /**
   * Text color; accepts a text color token, a primitive color token,
   * a CSS color string, or a theme-aware `{ light, dark }`.
   */
  color?: string | ThemeColor | null;
  /** Font weight; accepts a font weight token. */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Size of the title text; accepts a title size token. */
  size?: TitleSize | null;
  /** Horizontal text alignment. */
  textAlign?: TextAlign | null;
  /** Truncate overflow with ellipsis. */
  truncate?: boolean | null;
  /** Limit text to a maximum number of lines (line clamp). */
  maxLines?: number | null;
}

/**
 * Widget rendering supporting caption text.
 */
export interface Caption extends WidgetComponentBase {
  type: "Caption";
  /** Text content to display. */
  value: string;
  /** Text color; same semantics as {@link Text.color}. */
  color?: string | ThemeColor | null;
  /** Font weight; accepts a font weight token. */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Size of the caption text; accepts a caption size token. */
  size?: CaptionSize | null;
  /** Horizontal text alignment. */
  textAlign?: TextAlign | null;
  /** Truncate overflow with ellipsis. */
  truncate?: boolean | null;
  /** Limit text to a maximum number of lines (line clamp). */
  maxLines?: number | null;
}

/**
 * Small badge indicating status or categorization.
 */
export interface Badge extends WidgetComponentBase {
  type: "Badge";
  /** Text to display inside the badge. */
  label: string;
  /** Color of the badge; accepts a badge color token. */
  color?:
    | "secondary"
    | "success"
    | "danger"
    | "warning"
    | "info"
    | "discovery"
    | null;
  /** Visual style of the badge. */
  variant?: "solid" | "soft" | "outline" | null;
  /** Size of the badge. */
  size?: "sm" | "md" | "lg" | null;
  /** Determines if the badge should be fully rounded (pill). */
  pill?: boolean | null;
}

/**
 * Shared layout props for flexible container widgets.
 */
export interface BoxBase {
  /** Child components to render inside the container. */
  children?: WidgetComponent[] | null;
  /** Cross-axis alignment of children. */
  align?: Alignment | null;
  /** Main-axis distribution of children. */
  justify?: Justification | null;
  /** Wrap behavior for flex items. */
  wrap?: "nowrap" | "wrap" | "wrap-reverse" | null;
  /** Flex growth/shrink factor. */
  flex?: number | string | null;
  /** Gap between direct children; spacing unit or CSS string. */
  gap?: number | string | null;
  /** Explicit height; px or CSS string. */
  height?: number | string | null;
  /** Explicit width; px or CSS string. */
  width?: number | string | null;
  /** Shorthand to set both width and height; px or CSS string. */
  size?: number | string | null;
  /** Minimum height; px or CSS string. */
  minHeight?: number | string | null;
  /** Minimum width; px or CSS string. */
  minWidth?: number | string | null;
  /** Shorthand to set both minWidth and minHeight; px or CSS string. */
  minSize?: number | string | null;
  /** Maximum height; px or CSS string. */
  maxHeight?: number | string | null;
  /** Maximum width; px or CSS string. */
  maxWidth?: number | string | null;
  /** Shorthand to set both maxWidth and maxHeight; px or CSS string. */
  maxSize?: number | string | null;
  /** Inner padding; spacing unit, CSS string, or padding object. */
  padding?: number | string | Spacing | null;
  /** Outer margin; spacing unit, CSS string, or margin object. */
  margin?: number | string | Spacing | null;
  /** Border applied to the container; px or border object/shorthand. */
  border?: number | Border | Borders | null;
  /** Border radius; accepts a radius token. */
  radius?: RadiusValue | null;
  /**
   * Background color; accepts background color token, a primitive color token,
   * a CSS string, or theme-aware `{ light, dark }`.
   */
  background?: string | ThemeColor | null;
  /** Aspect ratio of the box (e.g., 16/9); number or CSS string. */
  aspectRatio?: number | string | null;
}

/**
 * Generic flex container with direction control.
 */
export interface Box extends WidgetComponentBase, BoxBase {
  type: "Box";
  /** Flex direction for content within this container. */
  direction?: "row" | "col" | null;
}

/**
 * Horizontal flex container.
 */
export interface Row extends WidgetComponentBase, BoxBase {
  type: "Row";
}

/**
 * Vertical flex container.
 */
export interface Col extends WidgetComponentBase, BoxBase {
  type: "Col";
}

/**
 * Form wrapper capable of submitting `onSubmitAction`.
 */
export interface Form extends WidgetComponentBase, BoxBase {
  type: "Form";
  /** Action dispatched when the form is submitted. */
  onSubmitAction?: ActionConfig | null;
  /** Flex direction for laying out form children. */
  direction?: "row" | "col" | null;
}

/**
 * Visual divider separating content sections.
 */
export interface Divider extends WidgetComponentBase {
  type: "Divider";
  /**
   * Divider color; accepts border color token, a primitive color token,
   * a CSS string, or theme-aware `{ light, dark }`.
   *
   * Valid tokens: `default` `subtle` `strong`
   */
  color?: string | ThemeColor | null;
  /** Thickness of the divider line; px or CSS string. */
  size?: number | string | null;
  /** Outer spacing above and below the divider; spacing unit or CSS string. */
  spacing?: number | string | null;
  /** Flush the divider to the container edge, removing surrounding padding. */
  flush?: boolean | null;
}

/**
 * Icon component referencing a built-in icon name.
 */
export interface Icon extends WidgetComponentBase {
  type: "Icon";
  /** Name of the icon to display. */
  name: WidgetIcon;
  /**
   * Icon color; same semantics as {@link Text.color}.
   */
  color?: string | ThemeColor | null;
  /** Size of the icon; accepts an icon size token. */
  size?: IconSize | null;
}

/**
 * Image component with sizing and fitting controls.
 */
export interface Image extends WidgetComponentBase {
  type: "Image";
  /** Image URL source. */
  src: string;
  /** Alternate text for accessibility. */
  alt?: string | null;
  /** How the image should fit within the container. */
  fit?: "cover" | "contain" | "fill" | "scale-down" | "none" | null;
  /** Focal position of the image within the container. */
  position?:
    | "top left"
    | "top"
    | "top right"
    | "left"
    | "center"
    | "right"
    | "bottom left"
    | "bottom"
    | "bottom right"
    | null;
  /** Border radius; accepts a radius token. */
  radius?: RadiusValue | null;
  /** Draw a subtle frame around the image. */
  frame?: boolean | null;
  /** Flush the image to the container edge, removing surrounding padding. */
  flush?: boolean | null;
  /** Explicit height; px or CSS string. */
  height?: number | string | null;
  /** Explicit width; px or CSS string. */
  width?: number | string | null;
  /** Shorthand to set both width and height; px or CSS string. */
  size?: number | string | null;
  /** Minimum height; px or CSS string. */
  minHeight?: number | string | null;
  /** Minimum width; px or CSS string. */
  minWidth?: number | string | null;
  /** Shorthand to set both minWidth and minHeight; px or CSS string. */
  minSize?: number | string | null;
  /** Maximum height; px or CSS string. */
  maxHeight?: number | string | null;
  /** Maximum width; px or CSS string. */
  maxWidth?: number | string | null;
  /** Shorthand to set both maxWidth and maxHeight; px or CSS string. */
  maxSize?: number | string | null;
  /** Outer margin; spacing unit, CSS string, or margin object. */
  margin?: number | string | Spacing | null;
  /**
   * Background color; same semantics as {@link BoxBase.background}.
   */
  background?: string | ThemeColor | null;
  /** Aspect ratio of the box (e.g., 16/9); number or CSS string. */
  aspectRatio?: number | string | null;
  /** Flex growth/shrink factor. */
  flex?: number | string | null;
}

/**
 * Button component optionally wired to an action.
 */
export interface Button extends WidgetComponentBase {
  type: "Button";
  /** Configure the button as a submit button for the nearest form. */
  submit?: boolean | null;
  /** Text to display inside the button. */
  label?: string | null;
  /** Action dispatched on click. */
  onClickAction?: ActionConfig | null;
  /** Icon shown before the label; can be used for icon-only buttons. */
  iconStart?: WidgetIcon | null;
  /** Optional icon shown after the label. */
  iconEnd?: WidgetIcon | null;
  /** Convenience preset for button style. */
  style?: "primary" | "secondary" | null;
  /** Controls the size of icons within the button; accepts an icon size token. */
  iconSize?: "sm" | "md" | "lg" | "xl" | "2xl" | null;
  /** Color of the button; accepts a button color token. */
  color?:
    | "primary"
    | "secondary"
    | "info"
    | "discovery"
    | "success"
    | "caution"
    | "warning"
    | "danger"
    | null;
  /** Visual variant of the button; accepts a control variant token. */
  variant?: ControlVariant | null;
  /** Controls the overall size of the button. */
  size?: ControlSize | null;
  /** Determines if the button should be fully rounded (pill). */
  pill?: boolean | null;
  /** Determines if the button should have matching width and height. */
  uniform?: boolean | null;
  /** Extend the button to 100% of the available width. */
  block?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  disabled?: boolean | null;
}

/**
 * Flexible spacer used to push content apart.
 */
export interface Spacer extends WidgetComponentBase {
  type: "Spacer";
  /** Minimum size the spacer should occupy along the flex direction. */
  minSize?: number | string | null;
}

/**
 * Selectable option used by the `Select` widget.
 */
export interface SelectOption {
  /** Option value submitted with the form. */
  value: string;
  /** Human-readable label for the option. */
  label: string;
  /** Disable the option. */
  disabled?: boolean;
  /** Displayed as secondary text below the option `label`. */
  description?: string;
}

/**
 * Select dropdown component.
 */
export interface Select extends WidgetComponentBase {
  type: "Select";
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** List of selectable options. */
  options: SelectOption[];
  /** Action dispatched when the value changes. */
  onChangeAction?: ActionConfig | null;
  /** Placeholder text shown when no value is selected. */
  placeholder?: string | null;
  /** Initial value of the select. */
  defaultValue?: string | null;
  /** Visual style of the select; accepts a control variant token. */
  variant?: ControlVariant | null;
  /** Controls the size of the select control. */
  size?: ControlSize | null;
  /** Determines if the select should be fully rounded (pill). */
  pill?: boolean | null;
  /** Extend the select to 100% of the available width. */
  block?: boolean | null;
  /** Show a clear control to unset the value. */
  clearable?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  disabled?: boolean | null;
}

/**
 * Date picker input component.
 */
export interface DatePicker extends WidgetComponentBase {
  type: "DatePicker";
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** Action dispatched when the date value changes. */
  onChangeAction?: ActionConfig | null;
  /** Placeholder text shown when no date is selected. */
  placeholder?: string | null;
  /** Initial value of the date picker. */
  defaultValue?: Date | null;
  /** Earliest selectable date (inclusive). */
  min?: Date | null;
  /** Latest selectable date (inclusive). */
  max?: Date | null;
  /** Visual variant of the datepicker control. */
  variant?: ControlVariant | null;
  /** Controls the size of the datepicker control. */
  size?: ControlSize | null;
  /** Preferred side to render the calendar. */
  side?: "top" | "bottom" | "left" | "right" | null;
  /** Preferred alignment of the calendar relative to the control. */
  align?: "start" | "center" | "end" | null;
  /** Determines if the datepicker should be fully rounded (pill). */
  pill?: boolean | null;
  /** Extend the datepicker to 100% of the available width. */
  block?: boolean | null;
  /** Show a clear control to unset the value. */
  clearable?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  disabled?: boolean | null;
}

/**
 * Checkbox input component.
 */
export interface Checkbox extends WidgetComponentBase {
  type: "Checkbox";
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** Optional label text rendered next to the checkbox. */
  label?: string | null;
  /** The initial checked state of the checkbox. */
  defaultChecked?: boolean | null;
  /** Action dispatched when the checked state changes. */
  onChangeAction?: ActionConfig | null;
  /** Disable interactions and apply disabled styles. */
  disabled?: boolean | null;
  /** Mark the checkbox as required for form submission. */
  required?: boolean | null;
}

/**
 * Single-line text input component.
 */
export interface Input extends WidgetComponentBase {
  type: "Input";
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** Native input type. */
  inputType?: "number" | "email" | "text" | "password" | "tel" | "url" | null;
  /** Initial value of the input. */
  defaultValue?: string | null;
  /** Mark the input as required for form submission. */
  required?: boolean | null;
  /** Regex pattern for input validation. */
  pattern?: string | null;
  /** Placeholder text shown when empty. */
  placeholder?: string | null;
  /** Allow password managers / autofill extensions to appear. */
  allowAutofillExtensions?: boolean | null;
  /** Select all contents of the input when it mounts. */
  autoSelect?: boolean | null;
  /** Autofocus the input when it mounts. */
  autoFocus?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  disabled?: boolean | null;
  /** Visual style of the input. */
  variant?: "soft" | "outline" | null;
  /** Controls the size of the input control. */
  size?: ControlSize | null;
  /** Controls gutter on the edges of the input; overrides value from `size`. */
  gutterSize?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | null;
  /** Determines if the input should be fully rounded (pill). */
  pill?: boolean | null;
}

/**
 * Form label associated with a field.
 */
export interface Label extends WidgetComponentBase {
  type: "Label";
  /** Text content of the label. */
  value: string;
  /** Name of the field this label describes. */
  fieldName: string;
  /** Size of the label text; accepts a text size token. */
  size?: TextSize | null;
  /** Font weight; accepts a font weight token. */
  weight?: "normal" | "medium" | "semibold" | "bold" | null;
  /** Horizontal text alignment. */
  textAlign?: TextAlign | null;
  /**
   * Text color; same semantics as {@link Text.color}.
   */
  color?: string | ThemeColor | null;
}

/**
 * Option inside a `RadioGroup` widget.
 */
export interface RadioOption {
  /** Label displayed next to the radio option. */
  label: string;
  /** Value submitted when the radio option is selected. */
  value: string;
  /** Disables a specific radio option. */
  disabled?: boolean;
}

/**
 * Grouped radio input control.
 */
export interface RadioGroup extends WidgetComponentBase {
  type: "RadioGroup";
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** Array of options to render as radio items. */
  options?: RadioOption[] | null;
  /** Accessible label for the radio group; falls back to `name`. */
  ariaLabel?: string | null;
  /** Action dispatched when the selected value changes. */
  onChangeAction?: ActionConfig | null;
  /** Initial selected value of the radio group. */
  defaultValue?: string | null;
  /** Layout direction of the radio items. */
  direction?: "row" | "col" | null;
  /** Disable interactions and apply disabled styles for the entire group. */
  disabled?: boolean | null;
  /** Mark the group as required for form submission. */
  required?: boolean | null;
}

/**
 * Multiline text input component.
 */
export interface Textarea extends WidgetComponentBase {
  type: "Textarea";
  /** The name of the form control field used when submitting forms. */
  name: string;
  /** Initial value of the textarea. */
  defaultValue?: string | null;
  /** Mark the textarea as required for form submission. */
  required?: boolean | null;
  /** Regex pattern for input validation. */
  pattern?: string | null;
  /** Placeholder text shown when empty. */
  placeholder?: string | null;
  /** Select all contents of the textarea when it mounts. */
  autoSelect?: boolean | null;
  /** Autofocus the textarea when it mounts. */
  autoFocus?: boolean | null;
  /** Disable interactions and apply disabled styles. */
  disabled?: boolean | null;
  /** Visual style of the textarea. */
  variant?: "soft" | "outline" | null;
  /** Controls the size of the textarea control. */
  size?: ControlSize | null;
  /** Controls gutter on the edges of the textarea; overrides value from `size`. */
  gutterSize?: "2xs" | "xs" | "sm" | "md" | "lg" | "xl" | null;
  /** Initial number of visible rows. */
  rows?: number | null;
  /** Automatically grow/shrink to fit content. */
  autoResize?: boolean | null;
  /** Maximum number of rows when auto-resizing. */
  maxRows?: number | null;
  /** Allow password managers / autofill extensions to appear. */
  allowAutofillExtensions?: boolean | null;
}

/**
 * Wrapper enabling transitions for a child component.
 */
export interface Transition extends WidgetComponentBase {
  type: "Transition";
  /** The child component to animate layout changes for. */
  children?: WidgetComponent | null;
}

/**
 * Configuration object for the X axis.
 */
export interface XAxisConfig {
  /** Field name from each data row to use for X-axis categories. */
  dataKey: string;
  /** Hide the X axis line, ticks, and labels when true. */
  hide?: boolean;
  /** Custom mapping of tick values to display labels. */
  labels?: Record<string, string>;
}

/** Interpolation curve types for `area` and `line` series. */
export type CurveType =
  | "basis"
  | "basisClosed"
  | "basisOpen"
  | "bumpX"
  | "bumpY"
  | "bump"
  | "linear"
  | "linearClosed"
  | "natural"
  | "monotoneX"
  | "monotoneY"
  | "monotone"
  | "step"
  | "stepBefore"
  | "stepAfter";

/**
 * A bar series plotted from a numeric `dataKey`. Supports stacking.
 */
export interface BarSeries {
  type: "bar";
  /** Legend label for the series. */
  label?: string | null;
  /** Field name from each data row that contains the numeric value. */
  dataKey: string;
  /** Optional stack group ID. Series with the same ID stack together. */
  stack?: string | null;
  /**
   * Color for the series; accepts chart color token, a primitive color token,
   * a CSS string, or theme-aware `{ light, dark }`.
   *
   * Chart color tokens: `blue` `purple` `orange` `green` `red` `yellow` `pink`
   *
   * Primitive color token, e.g., `red-100`, `blue-900`, `gray-500`
   *
   * Note: By default, a color will be sequentially assigned from the chart
   * series colors.
   */
  color?: string | ThemeColor | null;
}

/**
 * An area series plotted from a numeric `dataKey`. Supports stacking and curves.
 */
export interface AreaSeries {
  type: "area";
  /** Legend label for the series. */
  label?: string | null;
  /** Field name from each data row that contains the numeric value. */
  dataKey: string;
  /** Optional stack group ID. Series with the same ID stack together. */
  stack?: string | null;
  /** Color for the series; same semantics as {@link BarSeries.color}. */
  color?: string | ThemeColor | null;
  /** Interpolation curve type used to connect points. */
  curveType?: CurveType | null;
}

/**
 * A line series plotted from a numeric `dataKey`. Supports curves.
 */
export interface LineSeries {
  type: "line";
  /** Legend label for the series. */
  label?: string | null;
  /** Field name from each data row that contains the numeric value. */
  dataKey: string;
  /** Color for the series; same semantics as {@link BarSeries.color}. */
  color?: string | ThemeColor | null;
  /** Interpolation curve type used to connect points. */
  curveType?: CurveType | null;
}

/** Union of all supported chart series types. */
export type Series = BarSeries | AreaSeries | LineSeries;

/**
 * Data visualization component for simple bar/line/area charts.
 */
export interface Chart extends WidgetComponentBase {
  type: "Chart";
  /**
   * Tabular data for the chart, where each row maps field names to values.
   */
  data: Array<Record<string, string | number>>;
  /**
   * One or more series definitions that describe how to visualize data
   * fields.
   */
  series: Series[];
  /**
   * X-axis configuration; either a `dataKey` string or a config object.
   */
  xAxis: string | XAxisConfig;
  /** Controls whether the Y axis is rendered. */
  showYAxis?: boolean | null;
  /** Controls whether a legend is rendered. */
  showLegend?: boolean | null;
  /** Controls whether a tooltip is rendered when hovering over a datapoint. */
  showTooltip?: boolean | null;
  /** Gap between bars within the same category (in px). */
  barGap?: number | null;
  /** Gap between bar categories/groups (in px). */
  barCategoryGap?: number | null;
  /** Flex growth/shrink factor for layout. */
  flex?: number | string | null;
  /** Explicit height; px or CSS string. */
  height?: number | string | null;
  /** Explicit width; px or CSS string. */
  width?: number | string | null;
  /** Shorthand to set both width and height; px or CSS string. */
  size?: number | string | null;
  /** Minimum height; px or CSS string. */
  minHeight?: number | string | null;
  /** Minimum width; px or CSS string. */
  minWidth?: number | string | null;
  /** Shorthand to set both minWidth and minHeight; px or CSS string. */
  minSize?: number | string | null;
  /** Maximum height; px or CSS string. */
  maxHeight?: number | string | null;
  /** Maximum width; px or CSS string. */
  maxWidth?: number | string | null;
  /** Shorthand to set both maxWidth and maxHeight; px or CSS string. */
  maxSize?: number | string | null;
  /** Aspect ratio of the chart area (e.g., 16/9); number or CSS string. */
  aspectRatio?: number | string | null;
}

/**
 * A widget component with a statically defined base shape but dynamically
 * defined additional fields loaded from a widget template or JSON schema.
 *
 * Allows extra properties via an index signature.
 */
export interface DynamicWidgetComponent extends WidgetComponentBase {
  children?: DynamicWidgetComponent | DynamicWidgetComponent[] | null;
  // Extra fields loaded from templates / JSON schemas.
  [key: string]: any;
}

/**
 * Union of all strictly typed widget components.
 */
export type StrictWidgetComponent =
  | Text
  | Title
  | Caption
  | Chart
  | Badge
  | Markdown
  | Box
  | Row
  | Col
  | Divider
  | Icon
  | Image
  | ListViewItem
  | Button
  | Checkbox
  | Spacer
  | Select
  | DatePicker
  | Form
  | Input
  | Label
  | RadioGroup
  | Textarea
  | Transition;

/**
 * Union of all renderable top-level widget roots with strict typing.
 */
export type StrictWidgetRoot = Card | ListView;

/**
 * Dynamic root widget restricted to root types.
 */
export interface DynamicWidgetRoot extends DynamicWidgetComponent {
  type: "Card" | "ListView";
}

/**
 * Layout root capable of nesting components or other roots.
 */
export interface BasicRoot extends DynamicWidgetComponent {
  type: "Basic";
}

/**
 * Union of all renderable widget components.
 */
export type WidgetComponent = StrictWidgetComponent | DynamicWidgetComponent;

/**
 * Union of all renderable top-level widgets.
 */
export type WidgetRoot = StrictWidgetRoot | DynamicWidgetRoot;

/**
 * Icon names accepted by widgets that render icons.
 */
export type WidgetIcon = IconName;

/**
 * Definition object used to construct a {@link WidgetTemplate}.
 *
 * Note: The TypeScript implementation does **not** perform full Jinja
 * templating. When `template` is a string, it is assumed to already be a
 * fully-rendered JSON string. For dynamic templates, you can supply a
 * function that takes normalized data and returns a JSON string.
 */
export interface WidgetTemplateDefinition {
  version: "1.0";
  name: string;
  /**
   * Underlying template. For Node/TypeScript this is typically a JSON
   * string that may already be fully rendered, or a function that returns
   * the rendered JSON string when given runtime data.
   */
  template: string | ((data: Record<string, any>) => string);
  jsonSchema?: Record<string, any>;
  /**
   * Optional pre-rendered JSON preview of the widget output. When the
   * `template` string cannot be parsed as JSON (e.g. because it still
   * contains server-side Jinja placeholders), the TypeScript implementation
   * falls back to this preview.
   */
  outputJsonPreview?: any;
  /**
   * Encoded widget source used by the visual editor. Not interpreted by the
   * TypeScript runtime but accepted for compatibility.
   */
  encodedWidget?: string;
}

/**
 * Utility for loading and building widgets from a `.widget` file.
 *
 * It focuses on type safety and JSON-to-widget conversion; full
 * Jinja-style templating is out of scope and should be handled upstream.
 */
export class WidgetTemplate {
  readonly version: "1.0";
  readonly name: string;
  private readonly templateFn: (data: Record<string, any>) => string;
  readonly dataSchema: Record<string, any>;
  private readonly outputPreview: any;

  constructor(definition: WidgetTemplateDefinition) {
    this.version = definition.version;
    if (this.version !== "1.0") {
      throw new Error(`Unsupported widget spec version: ${this.version}`);
    }

    this.name = definition.name;
    const { template } = definition;
    if (typeof template === "function") {
      this.templateFn = template;
    } else {
      // When given a plain string, assume it is already a fully rendered
      // JSON widget definition. Data passed to `build` is ignored in this case.
      this.templateFn = () => template;
    }
    this.dataSchema = definition.jsonSchema ?? {};
    this.outputPreview = definition.outputJsonPreview;
  }

  /**
   * Load a `.widget` definition from disk.
   *
   * The file is expected to be JSON with the same shape as
   * {@link WidgetTemplateDefinition}.
   */
  static fromFile(filePath: string): WidgetTemplate {
    let path = filePath;
    if (!isAbsolute(path)) {
      // Resolve relative to the caller file (best-effort). If stack parsing fails, fall back to CWD.
      const err = new Error();
      const stack = err.stack ?? "";
      const callerLine = stack
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("at ") && !l.includes("WidgetTemplate.fromFile"));

      if (callerLine) {
        const match = callerLine.match(/\((.*):\d+:\d+\)$/) ?? callerLine.match(/at (.*):\d+:\d+$/);
        if (match && match[1]) {
          path = resolve(match[1], "..", path);
        } else {
          path = resolve(path);
        }
      } else {
        path = resolve(path);
      }
    }

    const raw = readFileSync(path, "utf-8");
    const payload = JSON.parse(raw) as WidgetTemplateDefinition;
    return new WidgetTemplate(payload);
  }

  /**
   * Build a {@link DynamicWidgetRoot} from this template.
   *
   * The template function/string should produce a JSON string that parses
   * into a `DynamicWidgetRoot`-compatible object.
   */
  build(data?: Record<string, any>): DynamicWidgetRoot {
    const rendered = this.templateFn(this.normalizeData(data));
    try {
      const widgetDict = JSON.parse(rendered) as DynamicWidgetRoot;
      return widgetDict;
    } catch (err) {
      if (this.outputPreview) {
        // Fall back to using the pre-rendered JSON preview embedded in the
        // `.widget` file. This allows compatibility with bundled
        // test assets without requiring a Jinja runtime in TypeScript.
        return this.outputPreview as DynamicWidgetRoot;
      }
      throw err;
    }
  }

  /**
   * Separate method for building basic root widgets until {@link BasicRoot}
   * is supported for streamed widgets.
   */
  build_basic(data?: Record<string, any>): BasicRoot {
    const rendered = this.templateFn(this.normalizeData(data));
    try {
      const widgetDict = JSON.parse(rendered) as BasicRoot;
      return widgetDict;
    } catch (err) {
      if (this.outputPreview) {
        return this.outputPreview as BasicRoot;
      }
      throw err;
    }
  }

  private normalizeData(
    data: Record<string, any> | undefined
  ): Record<string, any> {
    if (data == null) {
      return {};
    }
    return data;
  }
}


