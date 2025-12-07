/**
 * Vendor icon names must be prefixed with "vendor:".
 */
export type VendorIconName = `vendor:${string}`;

/**
 * Valid literal icon names.
 */
const LITERAL_ICON_NAMES = [
  "agent",
  "analytics",
  "atom",
  "batch",
  "bolt",
  "book-open",
  "book-closed",
  "book-clock",
  "bug",
  "calendar",
  "chart",
  "check",
  "check-circle",
  "check-circle-filled",
  "chevron-left",
  "chevron-right",
  "circle-question",
  "compass",
  "confetti",
  "cube",
  "desktop",
  "document",
  "dot",
  "dots-horizontal",
  "dots-vertical",
  "empty-circle",
  "external-link",
  "globe",
  "keys",
  "lab",
  "images",
  "info",
  "lifesaver",
  "lightbulb",
  "mail",
  "map-pin",
  "maps",
  "mobile",
  "name",
  "notebook",
  "notebook-pencil",
  "page-blank",
  "phone",
  "play",
  "plus",
  "profile",
  "profile-card",
  "reload",
  "star",
  "star-filled",
  "search",
  "sparkle",
  "sparkle-double",
  "square-code",
  "square-image",
  "square-text",
  "suitcase",
  "settings-slider",
  "user",
  "wreath",
  "write",
  "write-alt",
  "write-alt2",
] as const;

/**
 * Icon name can be either a literal icon name or a vendor icon name.
 */
export type IconName =
  | (typeof LITERAL_ICON_NAMES)[number]
  | VendorIconName;

/**
 * Runtime validator for IconName that mirrors Pydantic's validation.
 * Throws an error if the value is not a valid icon name.
 */
export function validateIconName(value: unknown): asserts value is IconName {
  if (typeof value !== "string") {
    throw new Error(`IconName must be a string, got ${typeof value}`);
  }

  // Check if it's a vendor icon
  if (value.startsWith("vendor:")) {
    return;
  }

  // Check if it's a literal icon name
  if ((LITERAL_ICON_NAMES as readonly string[]).includes(value)) {
    return;
  }

  throw new Error(`Invalid icon name: ${value}`);
}

