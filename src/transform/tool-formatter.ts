import type { ExportContent } from "../types.ts";

type Formatter = (input: Record<string, unknown>) => string | null;

interface AskQuestion {
  type?: string;
  question?: string;
  options?: string[];
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asArray<T = unknown>(v: unknown): T[] | null {
  return Array.isArray(v) ? (v as T[]) : null;
}

function formatAskUserInput(input: Record<string, unknown>): string | null {
  const questions = asArray<AskQuestion>(input.questions);
  if (!questions || questions.length === 0) return null;

  const lines: string[] = ["> [!question]- 사용자에게 질문"];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    if (i > 0) lines.push(">");
    const text = asString(q.question) ?? "(질문 없음)";
    lines.push(`> **${text}**`);
    const options = asArray<string>(q.options);
    if (!options || options.length === 0) continue;

    if (q.type === "multi_select") {
      for (const opt of options) lines.push(`> - [ ] ${opt}`);
    } else {
      // single_select or unspecified: numbered list
      options.forEach((opt, idx) => lines.push(`> ${idx + 1}. ${opt}`));
    }
  }
  return lines.join("\n");
}

function formatWebSearch(input: Record<string, unknown>): string | null {
  const query = asString(input.query);
  if (!query) return null;
  return `🔍 검색: "${query}"`;
}

function formatWebFetch(input: Record<string, unknown>): string | null {
  const url = asString(input.url);
  if (!url) return null;
  return `🌐 가져오기: ${url}`;
}

function formatBash(input: Record<string, unknown>): string | null {
  const command = asString(input.command);
  if (!command) return null;
  const desc = asString(input.description);
  const header = desc ? `$ ${desc}` : "$ shell";
  return [header, "```bash", command, "```"].join("\n");
}

function formatPath(emoji: string) {
  return (input: Record<string, unknown>): string | null => {
    const path = asString(input.path);
    if (!path) return null;
    const desc = asString(input.description);
    return desc ? `${emoji} \`${path}\` — ${desc}` : `${emoji} \`${path}\``;
  };
}

function formatPresentFiles(input: Record<string, unknown>): string | null {
  const filepaths = asArray<string>(input.filepaths);
  if (!filepaths || filepaths.length === 0) return null;
  const list = filepaths.map((p) => `\`${p}\``).join(", ");
  return `📋 파일 표시: ${list}`;
}

function formatConversationSearch(input: Record<string, unknown>): string | null {
  const query = asString(input.query);
  if (!query) return null;
  return `🔎 이전 대화 검색: "${query}"`;
}

function formatRecentChats(input: Record<string, unknown>): string | null {
  const n = typeof input.n === "number" ? input.n : null;
  if (n === null) return null;
  return `📜 최근 ${n}개 대화 조회`;
}

function formatMemoryEdits(input: Record<string, unknown>): string | null {
  const command = asString(input.command);
  if (!command) return null;
  return `🧠 메모리: ${command}`;
}

const FORMATTERS: Record<string, Formatter> = {
  web_search: formatWebSearch,
  web_fetch: formatWebFetch,
  bash: formatBash,
  bash_tool: formatBash,
  view: formatPath("👁️"),
  str_replace: formatPath("✏️"),
  present_files: formatPresentFiles,
  conversation_search: formatConversationSearch,
  recent_chats: formatRecentChats,
  memory_user_edits: formatMemoryEdits,
};

export function formatKnownTool(content: ExportContent): string | null {
  const name = content.name ?? "";
  const input = (content.input as Record<string, unknown> | undefined) ?? {};

  if (/^ask_user_input(_v\d+)?$/.test(name)) {
    return formatAskUserInput(input);
  }

  const formatter = FORMATTERS[name];
  return formatter ? formatter(input) : null;
}
