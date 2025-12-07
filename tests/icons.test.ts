import { describe, expect, it } from "vitest";
import { validateIconName } from "../src/icons";

describe("IconName", () => {
  it("accepts vendor icon names (prefixed with vendor:)", () => {
    validateIconName("vendor:icon-name");
    validateIconName("vendor:another-icon-name");
  });

  it("accepts some literal icon names", () => {
    validateIconName("book-open");
    validateIconName("phone");
    validateIconName("user");
  });

  it("rejects invalid icon names", () => {
    expect(() => validateIconName("invalid-icon")).toThrow();
    expect(() => validateIconName("")).toThrow();
    expect(() => validateIconName(123)).toThrow();
    expect(() => validateIconName(null)).toThrow();
  });
});


