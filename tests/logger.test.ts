import { describe, expect, it } from "bun:test";
import { logger } from "../src/logger";

describe("logger", () => {
  it("exposes all required methods", () => {
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.warning).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.critical).toBe("function");
  });

  it("warn and warning both exist and are functions", () => {
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.warning).toBe("function");
  });

  it("can call all logger methods without errors", () => {
    expect(() => logger.debug("debug message")).not.toThrow();
    expect(() => logger.info("info message")).not.toThrow();
    expect(() => logger.warning("warning message")).not.toThrow();
    expect(() => logger.warn("warn message")).not.toThrow();
    expect(() => logger.error("error message")).not.toThrow();
    expect(() => logger.critical("critical message")).not.toThrow();
  });

  it("handles multiple arguments", () => {
    expect(() => logger.error("error", { code: 500 }, "additional")).not.toThrow();
  });

  it("handles no arguments", () => {
    expect(() => logger.info()).not.toThrow();
  });
});
