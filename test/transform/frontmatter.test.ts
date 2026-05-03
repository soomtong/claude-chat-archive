import { test, expect, describe } from "bun:test";
import { toYamlFrontmatter } from "../../src/transform/frontmatter.ts";

describe("toYamlFrontmatter", () => {
  test("renders simple scalar fields", () => {
    const out = toYamlFrontmatter({
      uuid: "abc",
      title: "hello",
      message_count: 4,
    });
    expect(out).toBe(
      "---\nuuid: abc\ntitle: hello\nmessage_count: 4\n---\n",
    );
  });

  test("quotes strings containing colons", () => {
    const out = toYamlFrontmatter({ title: "name: with colon" });
    expect(out).toBe('---\ntitle: "name: with colon"\n---\n');
  });

  test("escapes embedded double quotes", () => {
    const out = toYamlFrontmatter({ title: 'has "quotes" inside' });
    expect(out).toBe('---\ntitle: "has \\"quotes\\" inside"\n---\n');
  });

  test("renders multiline string with literal block scalar", () => {
    const out = toYamlFrontmatter({ summary: "line1\nline2\nline3" });
    expect(out).toBe(
      "---\nsummary: |\n  line1\n  line2\n  line3\n---\n",
    );
  });

  test("renders array of strings inline", () => {
    const out = toYamlFrontmatter({ tags: ["claude-chat", "korean"] });
    expect(out).toBe("---\ntags: [claude-chat, korean]\n---\n");
  });

  test("renders boolean values", () => {
    const out = toYamlFrontmatter({ is_private: true, is_starter: false });
    expect(out).toBe("---\nis_private: true\nis_starter: false\n---\n");
  });

  test("omits null and undefined fields", () => {
    const out = toYamlFrontmatter({ a: "x", b: null, c: undefined, d: 1 });
    expect(out).toBe("---\na: x\nd: 1\n---\n");
  });

  test("omits empty string summary", () => {
    const out = toYamlFrontmatter({ uuid: "x", summary: "" });
    expect(out).toBe("---\nuuid: x\n---\n");
  });
});
