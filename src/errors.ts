// Not a closed enum, new error codes can and will be added as needed
export enum ErrorCode {
  STREAM_ERROR = "stream.error",
}

export const DEFAULT_STATUS: Record<ErrorCode, number> = {
  [ErrorCode.STREAM_ERROR]: 500,
};

export const DEFAULT_ALLOW_RETRY: Record<ErrorCode, boolean> = {
  [ErrorCode.STREAM_ERROR]: true,
};

/**
 * Base class for stream errors.
 */
export abstract class BaseStreamError extends Error {
  abstract allowRetry: boolean;

  constructor(message?: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error with a specific error code that maps to a localized user-facing
 * error message.
 */
export class StreamError extends BaseStreamError {
  code: ErrorCode;
  statusCode: number;
  allowRetry: boolean;

  constructor(
    code: ErrorCode,
    options?: {
      allowRetry?: boolean | null;
    }
  ) {
    super();
    this.code = code;
    this.statusCode = DEFAULT_STATUS[code] ?? 500;
    this.allowRetry =
      options?.allowRetry !== null && options?.allowRetry !== undefined
        ? options.allowRetry
        : DEFAULT_ALLOW_RETRY[code] ?? false;
  }
}

/**
 * Error with a custom user-facing error message. The message should be
 * localized as needed before raising the error.
 */
export class CustomStreamError extends BaseStreamError {
  message: string;
  /** The user-facing error message to display. */
  allowRetry: boolean;

  constructor(
    message: string,
    options?: {
      allowRetry?: boolean;
    }
  ) {
    super(message);
    this.message = message;
    this.allowRetry = options?.allowRetry ?? false;
  }
}

