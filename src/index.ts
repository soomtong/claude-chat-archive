import { join } from "node:path";
import type { Config, RunStats } from "./types.ts";
import { loadConversations } from "./reader/conversations.ts";
import { loadProjects } from "./reader/projects.ts";
import { writeChat } from "./writer/chat.ts";
import { writeProject } from "./writer/project.ts";

export type { Config, RunStats } from "./types.ts";

export async function archive(cfg: Config): Promise<RunStats> {
  const stats: RunStats = {
    chatsTotal: 0,
    chatsWritten: 0,
    chatsSkipped: 0,
    projectsTotal: 0,
    projectsWritten: 0,
    attachmentsInline: 0,
    attachmentsExternal: 0,
    attachmentsMissing: 0,
  };

  const used = new Set<string>();

  if (cfg.scope !== "projects") {
    const convs = await loadConversations(join(cfg.inputDir, "conversations.json"));
    stats.chatsTotal = convs.length;
    for (const c of convs) {
      try {
        const r = await writeChat(c, cfg, used);
        stats.chatsWritten += 1;
        stats.attachmentsInline += r.inline;
        stats.attachmentsExternal += r.external;
        stats.attachmentsMissing += r.missing;
      } catch (err) {
        stats.chatsSkipped += 1;
        process.stderr.write(`[skip] chat ${c.uuid}: ${(err as Error).message}\n`);
      }
    }
  }

  if (cfg.scope !== "chats") {
    const projects = await loadProjects(join(cfg.inputDir, "projects"));
    stats.projectsTotal = projects.length;
    for (const p of projects) {
      try {
        await writeProject(p, cfg);
        stats.projectsWritten += 1;
      } catch (err) {
        process.stderr.write(`[skip] project ${p.uuid}: ${(err as Error).message}\n`);
      }
    }
  }

  return stats;
}
