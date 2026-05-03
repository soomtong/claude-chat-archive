import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeExternalAttachment } from "../../src/writer/attachment.ts";

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "cca-att-"));
});
afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("writeExternalAttachment", () => {
  test("creates <attachments>/<chat-uuid>/<filename>", async () => {
    await writeExternalAttachment(baseDir, "chat-uuid", "note.txt", "hello");
    const path = join(baseDir, "chat-uuid", "note.txt");
    expect(await readFile(path, "utf8")).toBe("hello");
  });

  test("creates parent directories if missing", async () => {
    await writeExternalAttachment(baseDir, "deep-uuid", "x.txt", "data");
    const path = join(baseDir, "deep-uuid", "x.txt");
    expect(await readFile(path, "utf8")).toBe("data");
  });

  test("sanitizes filename to neutralize path traversal", async () => {
    await writeExternalAttachment(baseDir, "uuid", "../escape.txt", "x");
    // sanitizeFilename replaces "/" with "_", so result is .._escape.txt within uuid/
    const path = join(baseDir, "uuid", ".._escape.txt");
    expect(await readFile(path, "utf8")).toBe("x");
  });

  test("sanitizes chat-uuid containing slashes", async () => {
    await writeExternalAttachment(baseDir, "a/b", "f.txt", "y");
    const path = join(baseDir, "a_b", "f.txt");
    expect(await readFile(path, "utf8")).toBe("y");
  });
});
