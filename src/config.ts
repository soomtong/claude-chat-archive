import { parseArgs } from "node:util";
import { resolve } from "node:path";
import type { Config, ContentMode, Scope } from "./types.ts";

const VALID_MODES: ContentMode[] = ["minimal", "standard", "full"];
const VALID_SCOPES: Scope[] = ["all", "chats", "projects"];

export function parseConfig(argv: string[]): Config {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      mode: { type: "string", default: "standard" },
      "no-thinking": { type: "boolean", default: false },
      "no-tools": { type: "boolean", default: false },
      "attachment-threshold": { type: "string", default: "4096" },
      scope: { type: "string", default: "all" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
  });

  if (positionals.length === 0) {
    throw new Error(
      "usage: claude-chat-archive <input-dir> [output-dir] [options]",
    );
  }

  const mode = values.mode as ContentMode;
  if (!VALID_MODES.includes(mode)) {
    throw new Error(`mode must be one of: ${VALID_MODES.join(", ")}`);
  }

  const scope = values.scope as Scope;
  if (!VALID_SCOPES.includes(scope)) {
    throw new Error(`scope must be one of: ${VALID_SCOPES.join(", ")}`);
  }

  const threshold = Number.parseInt(
    values["attachment-threshold"] as string,
    10,
  );
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error("attachment-threshold must be a non-negative integer");
  }

  const inputDir = resolve(positionals[0]!);
  const outputDir = positionals[1]
    ? resolve(positionals[1])
    : `${inputDir}/output`;

  return {
    inputDir,
    outputDir,
    mode,
    includeThinking: !values["no-thinking"],
    includeTools: !values["no-tools"],
    attachmentThreshold: threshold,
    scope,
    dryRun: Boolean(values["dry-run"]),
  };
}

export const HELP_TEXT = `claude-chat-archive — convert Claude.ai export to markdown

Usage:
  claude-chat-archive <input-dir> [output-dir] [options]

Arguments:
  input-dir              Folder containing conversations.json and projects/
  output-dir             Output folder (default: <input-dir>/output)

Options:
  --mode <m>             Content detail: minimal | standard | full (default: standard)
  --no-thinking          Omit assistant thinking content
  --no-tools             Omit tool_use / tool_result content
  --attachment-threshold <bytes>
                         Inline attachments smaller than this (default: 4096)
  --scope <s>            What to convert: all | chats | projects (default: all)
  --dry-run              Print stats without writing
  -h, --help             Show this help
  -v, --version          Show version
`;
