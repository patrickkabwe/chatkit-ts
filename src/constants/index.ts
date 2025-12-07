import type { Handler, LoadingBehavior } from "../types";

// Server constants
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_ERROR_MESSAGE =
  "An error occurred when generating a response.";

// Type constants
export const DEFAULT_HANDLER: Handler = "server";
export const DEFAULT_LOADING_BEHAVIOR: LoadingBehavior = "auto";
