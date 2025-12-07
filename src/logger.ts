type LogLevelName = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";

const LEVELS: Record<LogLevelName, number> = {
  DEBUG: 10,
  INFO: 20,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50
};

const LOGGER_NAME = "chatkit";

const envLevel = (process.env.LOG_LEVEL ?? "").toUpperCase() as LogLevelName | "";
const currentLevelValue =
  envLevel && envLevel in LEVELS ? LEVELS[envLevel as LogLevelName] : LEVELS.WARNING;

function shouldLog(level: LogLevelName): boolean {
  return LEVELS[level] >= currentLevelValue;
}

function log(level: LogLevelName, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} - ${LOGGER_NAME} - ${level} -`;

  switch (level) {
    case "DEBUG":
      console.debug(prefix, ...args);
      break;
    case "INFO":
      console.info(prefix, ...args);
      break;
    case "WARNING":
      console.warn(prefix, ...args);
      break;
    case "ERROR":
    case "CRITICAL":
      console.error(prefix, ...args);
      break;
    default:
      console.log(prefix, ...args);
  }
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  warning: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  critical: (...args: unknown[]) => void;
}

export const logger: Logger = {
  debug: (...args: unknown[]) => log("DEBUG", ...args),
  info: (...args: unknown[]) => log("INFO", ...args),
  warn: (...args: unknown[]) => log("WARNING", ...args),
  warning: (...args: unknown[]) => log("WARNING", ...args),
  error: (...args: unknown[]) => log("ERROR", ...args),
  critical: (...args: unknown[]) => log("CRITICAL", ...args)
};


