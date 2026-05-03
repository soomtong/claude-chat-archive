import { test, expect, describe } from "bun:test";
import { parseConfig } from "../src/config.ts";

describe("parseConfig", () => {
  test("two positional args set inputDir and outputDir", () => {
    const cfg = parseConfig(["./export", "./out"]);
    expect(cfg.inputDir.endsWith("export")).toBe(true);
    expect(cfg.outputDir.endsWith("out")).toBe(true);
  });

  test("one positional arg defaults outputDir to <input>/output", () => {
    const cfg = parseConfig(["./export"]);
    expect(cfg.outputDir).toBe(`${cfg.inputDir}/output`);
  });

  test("default mode is standard", () => {
    const cfg = parseConfig(["./export"]);
    expect(cfg.mode).toBe("standard");
  });

  test("--mode full sets mode", () => {
    const cfg = parseConfig(["./export", "--mode", "full"]);
    expect(cfg.mode).toBe("full");
  });

  test("invalid mode throws", () => {
    expect(() => parseConfig(["./export", "--mode", "weird"])).toThrow(
      /mode must be/,
    );
  });

  test("--no-thinking flips includeThinking", () => {
    const cfg = parseConfig(["./export", "--no-thinking"]);
    expect(cfg.includeThinking).toBe(false);
  });

  test("--no-tools flips includeTools", () => {
    const cfg = parseConfig(["./export", "--no-tools"]);
    expect(cfg.includeTools).toBe(false);
  });

  test("--attachment-threshold parses int", () => {
    const cfg = parseConfig(["./export", "--attachment-threshold", "8192"]);
    expect(cfg.attachmentThreshold).toBe(8192);
  });

  test("negative attachment-threshold throws", () => {
    expect(() =>
      parseConfig(["./export", "--attachment-threshold", "-1"]),
    ).toThrow(/threshold/);
  });

  test("--scope chats", () => {
    const cfg = parseConfig(["./export", "--scope", "chats"]);
    expect(cfg.scope).toBe("chats");
  });

  test("--dry-run flag", () => {
    const cfg = parseConfig(["./export", "--dry-run"]);
    expect(cfg.dryRun).toBe(true);
  });

  test("zero positional args throws with usage hint", () => {
    expect(() => parseConfig([])).toThrow(/usage|input/i);
  });
});
