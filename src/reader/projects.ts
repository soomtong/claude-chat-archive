import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExportProject } from "../types.ts";

export async function loadProjects(dir: string): Promise<ExportProject[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const projects: ExportProject[] = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    const raw = await readFile(join(dir, name), "utf8");
    projects.push(JSON.parse(raw) as ExportProject);
  }
  return projects;
}
