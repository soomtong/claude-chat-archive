import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archive } from "../src/index.ts";

let outDir: string;
beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), "cca-int-"));
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe("archive (full pipeline)", () => {
  test("converts fixture export end-to-end", async () => {
    const stats = await archive({
      inputDir: "test/fixtures/export-min",
      outputDir: outDir,
      mode: "standard",
      includeThinking: true,
      includeTools: true,
      attachmentThreshold: 4096,
      scope: "all",
      dryRun: false,
    });
    expect(stats.chatsWritten).toBe(1);
    expect(stats.projectsWritten).toBe(1);
    const chats = await readdir(join(outDir, "chats"));
    expect(chats).toHaveLength(1);
    const projects = await readdir(join(outDir, "projects"));
    expect(projects.length).toBeGreaterThan(0);
  });

  test("scope=chats skips projects", async () => {
    const stats = await archive({
      inputDir: "test/fixtures/export-min",
      outputDir: outDir,
      mode: "minimal",
      includeThinking: true,
      includeTools: true,
      attachmentThreshold: 4096,
      scope: "chats",
      dryRun: false,
    });
    expect(stats.projectsWritten).toBe(0);
    await expect(readdir(join(outDir, "projects"))).rejects.toThrow();
  });

  test("dry-run reports stats but writes nothing", async () => {
    const stats = await archive({
      inputDir: "test/fixtures/export-min",
      outputDir: outDir,
      mode: "standard",
      includeThinking: true,
      includeTools: true,
      attachmentThreshold: 4096,
      scope: "all",
      dryRun: true,
    });
    expect(stats.chatsWritten).toBe(1);
    await expect(readdir(join(outDir, "chats"))).rejects.toThrow();
  });
});
