import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Config, ExportProject } from "../types.ts";
import { sanitizeFilename } from "../transform/filename.ts";
import { toYamlFrontmatter } from "../transform/frontmatter.ts";

function projectFrontmatter(p: ExportProject): string {
  return toYamlFrontmatter({
    uuid: p.uuid,
    type: "project",
    name: p.name,
    created: p.created_at,
    updated: p.updated_at,
    is_private: p.is_private,
    is_starter_project: p.is_starter_project,
    creator: p.creator?.full_name,
    docs_count: p.docs.length,
  });
}

function projectBody(p: ExportProject): string {
  const parts: string[] = [`# ${p.name}`];
  if (p.description?.trim()) {
    parts.push(`## Description\n\n${p.description}`);
  }
  if (p.prompt_template?.trim()) {
    parts.push(`## Prompt Template\n\n${p.prompt_template}`);
  } else {
    parts.push(`## Prompt Template\n\n(empty)`);
  }
  return parts.join("\n\n");
}

export async function writeProject(p: ExportProject, cfg: Config): Promise<void> {
  if (cfg.dryRun) return;

  const projectsDir = join(cfg.outputDir, "projects");
  const safeName = sanitizeFilename(p.name);
  const fm = projectFrontmatter(p);
  const body = projectBody(p);
  const document = `${fm}\n${body}\n`;

  if (p.docs.length === 0) {
    await mkdir(projectsDir, { recursive: true });
    await writeFile(join(projectsDir, `${safeName}.md`), document, "utf8");
    return;
  }

  const folder = join(projectsDir, safeName);
  const docsDir = join(folder, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(join(folder, "README.md"), document, "utf8");
  for (const d of p.docs) {
    const safeFilename = sanitizeFilename(d.filename || `${d.uuid}.md`);
    await writeFile(join(docsDir, safeFilename), d.content, "utf8");
  }
}
