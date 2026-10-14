import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeError, writeLog } from "@/lib/log";

describe("writeLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes one JSON line to stdout with msg and fields", () => {
    const write = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    writeLog("info", "hello", { postId: "abc" });
    expect(write).toHaveBeenCalledOnce();
    const line = String(write.mock.calls[0]?.[0]).trimEnd();
    const parsed = JSON.parse(line) as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("hello");
    expect(parsed.postId).toBe("abc");
    expect(typeof parsed.time).toBe("string");
  });

  it("writes errors to stderr and serializes Error fields", () => {
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const err = new Error("boom");
    writeLog("error", "telegram_publish_done", { ok: false, error: err });
    const line = String(write.mock.calls[0]?.[0]).trimEnd();
    const parsed = JSON.parse(line) as {
      level: string;
      msg: string;
      ok: boolean;
      error: { name: string; message: string; stack?: string };
    };
    expect(parsed.level).toBe("error");
    expect(parsed.msg).toBe("telegram_publish_done");
    expect(parsed.ok).toBe(false);
    expect(parsed.error.message).toBe("boom");
    expect(parsed.error.name).toBe("Error");
  });
});

describe("serializeError", () => {
  it("includes name, message, stack", () => {
    const err = new TypeError("bad");
    const serialized = serializeError(err);
    expect(serialized.name).toBe("TypeError");
    expect(serialized.message).toBe("bad");
    expect(typeof serialized.stack).toBe("string");
  });
});
