import { test, expect, describe } from "bun:test";
import { loadProjects } from "../../src/reader/projects.ts";

describe("loadProjects", () => {
  test("loads all *.json files in projects dir", async () => {
    const projects = await loadProjects("test/fixtures/export-min/projects");
    expect(projects).toHaveLength(1);
    expect(projects[0]!.uuid).toBe("proj-1");
    expect(projects[0]!.docs).toHaveLength(1);
  });

  test("returns empty array when projects dir missing", async () => {
    const projects = await loadProjects("test/fixtures/no-such-dir");
    expect(projects).toEqual([]);
  });

  test("skips non-json files", async () => {
    const projects = await loadProjects("test/fixtures/export-min/projects");
    expect(projects.every((p) => typeof p.uuid === "string")).toBe(true);
  });
});
