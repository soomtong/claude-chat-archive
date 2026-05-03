import { test, expect, describe } from "bun:test";
import { loadConversations } from "../../src/reader/conversations.ts";

describe("loadConversations", () => {
  test("loads valid conversations.json", async () => {
    const convs = await loadConversations(
      "test/fixtures/export-min/conversations.json",
    );
    expect(convs).toHaveLength(1);
    expect(convs[0]!.uuid).toBe("conv-1");
    expect(convs[0]!.chat_messages).toHaveLength(1);
  });

  test("throws clear error when file missing", async () => {
    await expect(
      loadConversations("test/fixtures/does-not-exist.json"),
    ).rejects.toThrow(/conversations\.json/);
  });

  test("throws on invalid JSON", async () => {
    await expect(
      loadConversations("test/fixtures/export-min/conversations.json.invalid"),
    ).rejects.toThrow();
  });
});
