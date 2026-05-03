import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeProject } from "../../src/writer/project.ts";
import type { Config, ExportProject } from "../../src/types.ts";

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
  outDir = await mkdtemp(join(tmpdir(), "cca-proj-"));
});
afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

const projectNoDocs: ExportProject = {
  uuid: "p1",
  name: "프로그래밍 강의",
  description: "Course curriculum",
  is_private: true,
  is_starter_project: false,
  prompt_template: "",
  created_at: "2025-12-01T00:00:00Z",
  updated_at: "2025-12-01T00:00:00Z",
  creator: { uuid: "u", full_name: "soomtong" },
  docs: [],
};

const projectWithDocs: ExportProject = {
  ...projectNoDocs,
  uuid: "p2",
  name: "How to use Claude",
  docs: [
    { uuid: "d1", filename: "guide.md", content: "# Guide content" },
  ],
};

describe("writeProject", () => {
  test("project without docs writes single .md file", async () => {
    await writeProject(projectNoDocs, { ...cfg, inputDir: "/in", outputDir: outDir });
    const files = await readdir(join(outDir, "projects"));
    expect(files).toContain("프로그래밍 강의.md");
    const md = await readFile(join(outDir, "projects", "프로그래밍 강의.md"), "utf8");
    expect(md).toContain("type: project");
    expect(md).toContain("Course curriculum");
  });

  test("project with docs writes folder + README + docs/", async () => {
    await writeProject(projectWithDocs, { ...cfg, inputDir: "/in", outputDir: outDir });
    const folder = join(outDir, "projects", "How to use Claude");
    expect((await stat(folder)).isDirectory()).toBe(true);
    const readme = await readFile(join(folder, "README.md"), "utf8");
    expect(readme).toContain("type: project");
    const doc = await readFile(join(folder, "docs", "guide.md"), "utf8");
    expect(doc).toBe("# Guide content");
  });

  test("dry-run writes nothing", async () => {
    await writeProject(
      projectWithDocs,
      { ...cfg, inputDir: "/in", outputDir: outDir, dryRun: true },
    );
    await expect(readdir(join(outDir, "projects"))).rejects.toThrow();
  });
});
