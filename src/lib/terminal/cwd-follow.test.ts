import { describe, expect, it } from "vitest";
import { buildRemoteCwdHook, parseRemoteCwdPayload } from "./cwd-follow.ts";

describe("buildRemoteCwdHook", () => {
  it("builds a POSIX hook that emits cwd updates", () => {
    const hook = buildRemoteCwdHook("posix");
    expect(hook).toContain("__rssh_emit_cwd");
    expect(hook).toContain("PROMPT_COMMAND");
    expect(hook).toContain("add-zsh-hook");
  });

  it("builds a PowerShell hook that wraps prompt", () => {
    const hook = buildRemoteCwdHook("powershell");
    expect(hook).toContain("function global:prompt");
    expect(hook).toContain("__rssh_emit_cwd");
  });

  it("returns null for cmd.exe", () => {
    expect(buildRemoteCwdHook("cmd")).toBeNull();
  });
});

describe("parseRemoteCwdPayload", () => {
  it("passes through raw paths and decodes file URIs", () => {
    expect(parseRemoteCwdPayload("/root/projects")).toBe("/root/projects");
    expect(parseRemoteCwdPayload("file:///root/projects")).toBe("/root/projects");
  });
});