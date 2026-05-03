#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseConfig, HELP_TEXT } from "./config.ts";
import { archive } from "./index.ts";

async function readVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const pkg = JSON.parse(await readFile(join(here, "..", "package.json"), "utf8"));
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write(`${await readVersion()}\n`);
    return 0;
  }

  let cfg;
  try {
    cfg = parseConfig(argv);
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.stderr.write(HELP_TEXT);
    return 2;
  }

  process.stdout.write(`Reading export from: ${cfg.inputDir}\n`);
  process.stdout.write(`Writing archive to:  ${cfg.outputDir}\n`);
  if (cfg.dryRun) process.stdout.write("(dry-run mode — no files will be written)\n");

  try {
    const stats = await archive(cfg);
    process.stdout.write(
      `\nDone. chats: ${stats.chatsWritten}/${stats.chatsTotal} ` +
        `(${stats.chatsSkipped} skipped), ` +
        `projects: ${stats.projectsWritten}/${stats.projectsTotal}, ` +
        `attachments: ${stats.attachmentsInline} inline, ` +
        `${stats.attachmentsExternal} external, ` +
        `${stats.attachmentsMissing} missing, ` +
        `created files: ${stats.createdFilesWritten}\n`,
    );
    return 0;
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code));
