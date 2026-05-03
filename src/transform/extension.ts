const LANGUAGE_TO_EXT: Record<string, string> = {
  typescript: "ts",
  ts: "ts",
  tsx: "tsx",
  javascript: "js",
  js: "js",
  jsx: "jsx",
  python: "py",
  py: "py",
  ruby: "rb",
  rust: "rs",
  go: "go",
  java: "java",
  kotlin: "kt",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  csharp: "cs",
  "c#": "cs",
  haskell: "hs",
  ocaml: "ml",
  elixir: "ex",
  erlang: "erl",
  gleam: "gleam",
  elm: "elm",
  clojure: "clj",
  scala: "scala",
  dart: "dart",
  zig: "zig",
  nim: "nim",
  julia: "jl",
  lua: "lua",
  r: "r",
  php: "php",
  perl: "pl",
  shell: "sh",
  bash: "sh",
  zsh: "sh",
  fish: "fish",
  vim: "vim",
  sql: "sql",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  json: "json",
  xml: "xml",
  markdown: "md",
  md: "md",
  mermaid: "mmd",
  dockerfile: "dockerfile",
  graphql: "graphql",
  protobuf: "proto",
  proto: "proto",
};

const ARTIFACT_TYPE_TO_EXT: Record<string, string> = {
  "text/markdown": "md",
  "text/html": "html",
  "image/svg+xml": "svg",
  "application/vnd.ant.markdown": "md",
  "application/vnd.ant.html": "html",
  "application/vnd.ant.react": "tsx",
  "application/vnd.ant.mermaid": "mmd",
  "application/vnd.ant.svg": "svg",
};

export function hasExtension(name: string): boolean {
  if (!name) return false;
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return false; // empty or starts with dot (.env etc.)
  const ext = name.slice(idx + 1);
  return ext.length > 0 && !ext.includes("/") && !ext.includes("\\");
}

export function ensureExtension(name: string, fallbackExt: string): string {
  if (hasExtension(name)) return name;
  return `${name}.${fallbackExt}`;
}

export function extFromArtifact(type: string, language: string): string {
  if (type === "application/vnd.ant.code") {
    const lang = language.toLowerCase();
    return LANGUAGE_TO_EXT[lang] ?? "txt";
  }
  return ARTIFACT_TYPE_TO_EXT[type] ?? "txt";
}

export function sniffExtFromContent(content: string): string {
  const trimmed = content.trimStart();
  if (trimmed.length === 0) return "txt";

  if (trimmed.startsWith("#!/")) {
    const firstLine = trimmed.split("\n")[0]!;
    if (/python/.test(firstLine)) return "py";
    if (/node/.test(firstLine)) return "js";
    if (/ruby/.test(firstLine)) return "rb";
    if (/(bash|sh|zsh)\b/.test(firstLine)) return "sh";
    return "sh";
  }
  if (/^<!DOCTYPE\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return "html";
  if (/^<\?xml/i.test(trimmed)) return "xml";
  if (/^defmodule\s+/.test(trimmed)) return "ex";
  if (/^(import|export|const|let|var|function)\s+/.test(trimmed)) return "js";
  if (/^def\s+/.test(trimmed)) return "py";
  if (/^#{1,6}\s/.test(trimmed)) return "md";

  return "txt";
}
