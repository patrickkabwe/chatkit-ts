import { describe, expect, it } from "bun:test";
import {
  BaseStreamError,
  StreamError,
  CustomStreamError,
  ErrorCode,
  DEFAULT_STATUS,
  DEFAULT_ALLOW_RETRY
} from "../src/errors";

describe("BaseStreamError", () => {
  it("is an abstract base class", () => {
    // Can't instantiate directly, but we can test via subclasses
    expect(BaseStreamError).toBeDefined();
  });

  it("sets the error name correctly in subclasses", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR);
    expect(error.name).toBe("StreamError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BaseStreamError);
  });
});

describe("StreamError", () => {
  it("creates error with default allowRetry", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR);
    expect(error.code).toBe(ErrorCode.STREAM_ERROR);
    expect(error.statusCode).toBe(DEFAULT_STATUS[ErrorCode.STREAM_ERROR]);
    expect(error.allowRetry).toBe(DEFAULT_ALLOW_RETRY[ErrorCode.STREAM_ERROR]);
  });

  it("allows customizing allowRetry", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR, { allowRetry: false });
    expect(error.allowRetry).toBe(false);
  });

  it("allows setting allowRetry to true explicitly", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR, { allowRetry: true });
    expect(error.allowRetry).toBe(true);
  });

  it("handles null allowRetry option", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR, { allowRetry: null as any });
    expect(error.allowRetry).toBe(DEFAULT_ALLOW_RETRY[ErrorCode.STREAM_ERROR]);
  });

  it("handles undefined allowRetry option", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR, { allowRetry: undefined });
    expect(error.allowRetry).toBe(DEFAULT_ALLOW_RETRY[ErrorCode.STREAM_ERROR]);
  });

  it("uses default status code from DEFAULT_STATUS", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR);
    expect(error.statusCode).toBe(500);
  });

  it("is an instance of BaseStreamError", () => {
    const error = new StreamError(ErrorCode.STREAM_ERROR);
    expect(error).toBeInstanceOf(BaseStreamError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe("CustomStreamError", () => {
  it("creates error with message and default allowRetry", () => {
    const error = new CustomStreamError("Custom error message");
    expect(error.message).toBe("Custom error message");
    expect(error.allowRetry).toBe(false);
  });

  it("allows customizing allowRetry", () => {
    const error = new CustomStreamError("Custom error", { allowRetry: true });
    expect(error.message).toBe("Custom error");
    expect(error.allowRetry).toBe(true);
  });

  it("allows setting allowRetry to false explicitly", () => {
    const error = new CustomStreamError("Custom error", { allowRetry: false });
    expect(error.message).toBe("Custom error");
    expect(error.allowRetry).toBe(false);
  });

  it("is an instance of BaseStreamError", () => {
    const error = new CustomStreamError("Test error");
    expect(error).toBeInstanceOf(BaseStreamError);
    expect(error).toBeInstanceOf(Error);
  });

  it("sets the error name correctly", () => {
    const error = new CustomStreamError("Test error");
    expect(error.name).toBe("CustomStreamError");
  });
});

describe("ErrorCode enum", () => {
  it("has STREAM_ERROR code", () => {
    expect(ErrorCode.STREAM_ERROR).toBe("stream.error" as ErrorCode);
  });
});

describe("DEFAULT_STATUS", () => {
  it("maps STREAM_ERROR to 500", () => {
    expect(DEFAULT_STATUS[ErrorCode.STREAM_ERROR]).toBe(500);
  });
});

describe("DEFAULT_ALLOW_RETRY", () => {
  it("maps STREAM_ERROR to true", () => {
    expect(DEFAULT_ALLOW_RETRY[ErrorCode.STREAM_ERROR]).toBe(true);
  });
});

