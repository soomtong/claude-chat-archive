import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeCreatedFile } from "../../src/writer/created.ts";

let baseDir: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), "cca-created-"));
});
afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true });
});

describe("writeCreatedFile", () => {
  test("writes file under <created>/<chat-uuid>/<name>", async () => {
    const used = new Set<string>();
    const name = await writeCreatedFile(baseDir, "uuid-1", "note.md", "hello", used);
    expect(name).toBe("note.md");
    expect(await readFile(join(baseDir, "uuid-1", "note.md"), "utf8")).toBe("hello");
  });

  test("appends suffix on collision within same chat", async () => {
    const used = new Set<string>();
    await writeCreatedFile(baseDir, "uuid-1", "note.md", "v1", used);
    const name = await writeCreatedFile(baseDir, "uuid-1", "note.md", "v2", used);
    expect(name).toBe("note-2.md");
    const files = await readdir(join(baseDir, "uuid-1"));
    expect(files.sort()).toEqual(["note-2.md", "note.md"]);
    expect(await readFile(join(baseDir, "uuid-1", "note-2.md"), "utf8")).toBe("v2");
  });

  test("does not collide across different chats", async () => {
    const used = new Set<string>();
    await writeCreatedFile(baseDir, "uuid-1", "note.md", "a", used);
    const name = await writeCreatedFile(baseDir, "uuid-2", "note.md", "b", used);
    expect(name).toBe("note.md");
  });

  test("appends suffix without extension when no dot", async () => {
    const used = new Set<string>();
    await writeCreatedFile(baseDir, "uuid-1", "Demo Code", "v1", used);
    const name = await writeCreatedFile(baseDir, "uuid-1", "Demo Code", "v2", used);
    expect(name).toBe("Demo Code-2");
  });
});
