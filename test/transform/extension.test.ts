import { test, expect, describe } from "bun:test";
import {
  ensureExtension,
  extFromArtifact,
  hasExtension,
  sniffExtFromContent,
} from "../../src/transform/extension.ts";

describe("hasExtension", () => {
  test("true for note.md", () => expect(hasExtension("note.md")).toBe(true));
  test("true for note.tar.gz (last segment)", () => expect(hasExtension("a.tar.gz")).toBe(true));
  test("false for plain name", () => expect(hasExtension("Demo Code")).toBe(false));
  test("false for hidden dotfile-only", () => expect(hasExtension(".env")).toBe(false));
  test("false for empty", () => expect(hasExtension("")).toBe(false));
});

describe("ensureExtension", () => {
  test("keeps existing extension", () => {
    expect(ensureExtension("note.md", "txt")).toBe("note.md");
  });
  test("appends fallback when no extension", () => {
    expect(ensureExtension("Demo Code", "ts")).toBe("Demo Code.ts");
  });
  test("dotfiles like .env get the fallback", () => {
    expect(ensureExtension(".env", "txt")).toBe(".env.txt");
  });
});

describe("extFromArtifact", () => {
  test("text/markdown → md", () => {
    expect(extFromArtifact("text/markdown", "")).toBe("md");
  });
  test("vnd.ant.code with typescript → ts", () => {
    expect(extFromArtifact("application/vnd.ant.code", "typescript")).toBe("ts");
  });
  test("vnd.ant.code with gleam → gleam", () => {
    expect(extFromArtifact("application/vnd.ant.code", "gleam")).toBe("gleam");
  });
  test("vnd.ant.code with ocaml → ml", () => {
    expect(extFromArtifact("application/vnd.ant.code", "ocaml")).toBe("ml");
  });
  test("vnd.ant.code with sql → sql", () => {
    expect(extFromArtifact("application/vnd.ant.code", "sql")).toBe("sql");
  });
  test("vnd.ant.code with markdown → md", () => {
    expect(extFromArtifact("application/vnd.ant.code", "markdown")).toBe("md");
  });
  test("vnd.ant.code with python → py", () => {
    expect(extFromArtifact("application/vnd.ant.code", "python")).toBe("py");
  });
  test("vnd.ant.code with unknown language → txt", () => {
    expect(extFromArtifact("application/vnd.ant.code", "klingon")).toBe("txt");
  });
  test("vnd.ant.mermaid → mmd", () => {
    expect(extFromArtifact("application/vnd.ant.mermaid", "")).toBe("mmd");
  });
  test("vnd.ant.html → html", () => {
    expect(extFromArtifact("application/vnd.ant.html", "")).toBe("html");
  });
  test("vnd.ant.react → tsx", () => {
    expect(extFromArtifact("application/vnd.ant.react", "")).toBe("tsx");
  });
  test("missing type → txt", () => {
    expect(extFromArtifact("", "")).toBe("txt");
  });
});

describe("sniffExtFromContent", () => {
  test("# heading → md", () => {
    expect(sniffExtFromContent("# Hello\n\nbody")).toBe("md");
  });
  test("## heading → md", () => {
    expect(sniffExtFromContent("## section")).toBe("md");
  });
  test("defmodule → ex (Elixir)", () => {
    expect(sniffExtFromContent("defmodule Foo do\nend")).toBe("ex");
  });
  test("<!DOCTYPE html → html", () => {
    expect(sniffExtFromContent("<!DOCTYPE html>\n<html></html>")).toBe("html");
  });
  test("<html → html", () => {
    expect(sniffExtFromContent("<html><body></body></html>")).toBe("html");
  });
  test("#!/bin/bash → sh", () => {
    expect(sniffExtFromContent("#!/bin/bash\necho hi")).toBe("sh");
  });
  test("#!/usr/bin/env python → py", () => {
    expect(sniffExtFromContent("#!/usr/bin/env python\nprint(1)")).toBe("py");
  });
  test("plain text → txt", () => {
    expect(sniffExtFromContent("just some text")).toBe("txt");
  });
  test("empty → txt", () => {
    expect(sniffExtFromContent("")).toBe("txt");
  });
});
