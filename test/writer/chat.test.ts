import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeChat } from "../../src/writer/chat.ts";
import type { Config, ExportConversation } from "../../src/types.ts";

let outDir: string;
const cfg: Omit<Config, "inputDir" | "outputDir"> = {
  mode: "standard",
  includeThinking: true,
  includeTools: true,
  attachmentThreshold: 4096,
  scope: "all",
  dryRun: false,
};

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "cca-chat-"));
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

const conv: ExportConversation = {
  uuid: "c1-uuid-aaaa-bbbb",
  name: "Test chat",
  summary: "summary text",
  created_at: "2026-02-01T00:00:00Z",
  updated_at: "2026-02-01T00:01:00Z",
  account: { uuid: "x" },
  chat_messages: [
    {
      uuid: "m1",
      text: "hi",
      sender: "human",
      created_at: "2026-02-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      content: [{ type: "text", text: "hi" }],
      attachments: [],
      files: [],
      parent_message_uuid: "00000000-0000-4000-8000-000000000000",
    },
    {
      uuid: "m2",
      text: "hello",
      sender: "assistant",
      created_at: "2026-02-01T00:01:00Z",
      updated_at: "2026-02-01T00:01:00Z",
      content: [{ type: "text", text: "hello" }],
      attachments: [],
      files: [],
      parent_message_uuid: "m1",
    },
  ],
};

describe("writeChat", () => {
  test("writes chat md with frontmatter and both messages", async () => {
    const used = new Set<string>();
    await writeChat(conv, { ...cfg, inputDir: "/in", outputDir: outDir }, used);
    const files = await readdir(join(outDir, "chats"));
    expect(files).toContain("2026-02-01 Test chat.md");
    const md = await readFile(join(outDir, "chats", "2026-02-01 Test chat.md"), "utf8");
    expect(md).toContain("uuid: c1-uuid-aaaa-bbbb");
    expect(md).toContain("title: Test chat");
    expect(md).toContain("# Test chat");
    expect(md).toContain("👤 User");
    expect(md).toContain("🤖 Claude");
  });

  test("dry-run writes nothing", async () => {
    const used = new Set<string>();
    await writeChat(
      conv,
      { ...cfg, inputDir: "/in", outputDir: outDir, dryRun: true },
      used,
    );
    await expect(readdir(join(outDir, "chats"))).rejects.toThrow();
  });

  test("returns stats counts", async () => {
    const used = new Set<string>();
    const stats = await writeChat(
      conv,
      { ...cfg, inputDir: "/in", outputDir: outDir },
      used,
    );
    expect(stats.inline).toBe(0);
    expect(stats.external).toBe(0);
    expect(stats.missing).toBe(0);
  });
});
