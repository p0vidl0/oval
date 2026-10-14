export type LogLevel = "debug" | "info" | "warn" | "error";

export function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function normalizeFieldValue(value: unknown): unknown {
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeFields(
  fields?: Record<string, unknown>,
): Record<string, unknown> {
  if (!fields) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = normalizeFieldValue(value);
  }
  return out;
}

/** Одна JSON-строка в stdout/stderr; не использует console. */
export function writeLog(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    msg,
    ...normalizeFields(fields),
  });
  const stream = level === "error" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export function log(
  level: LogLevel,
  msg: string,
  fields?: Record<string, unknown>,
): void {
  writeLog(level, msg, fields);
}

function fieldsFromConsoleArgs(args: unknown[]): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [index, arg] of args.entries()) {
    if (arg instanceof Error) {
      fields.error = serializeError(arg);
      continue;
    }
    if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
      for (const [key, value] of Object.entries(
        arg as Record<string, unknown>,
      )) {
        fields[key] = normalizeFieldValue(value);
      }
      continue;
    }
    fields[`arg${index}`] = normalizeFieldValue(arg);
  }
  return fields;
}

function logFromConsoleArgs(level: LogLevel, args: unknown[]): void {
  if (args.length === 0) {
    writeLog(level, "");
    return;
  }
  const first = args[0];
  if (typeof first === "string") {
    writeLog(level, first, fieldsFromConsoleArgs(args.slice(1)));
    return;
  }
  if (first instanceof Error) {
    writeLog(level, first.message, { error: serializeError(first) });
    return;
  }
  writeLog(level, String(first), fieldsFromConsoleArgs(args.slice(1)));
}

/** Подмена console.* на JSON (только Node runtime приложения). */
export function patchConsoleJsonLogging(): void {
  console.log = (...args: unknown[]) => logFromConsoleArgs("info", args);
  console.info = (...args: unknown[]) => logFromConsoleArgs("info", args);
  console.warn = (...args: unknown[]) => logFromConsoleArgs("warn", args);
  console.error = (...args: unknown[]) => logFromConsoleArgs("error", args);
  console.debug = (...args: unknown[]) => logFromConsoleArgs("debug", args);
}
