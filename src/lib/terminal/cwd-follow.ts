import type { ShellKind } from "../ai/types.ts";

const OSC_PREFIX = "\x1b]7337;cwd:";
const OSC_SUFFIX = "\x1b\\";

function posixHook(): string {
  return [
    "__rssh_emit_cwd(){ printf '\\033]7337;cwd:%s\\033\\\\' \"$PWD\"; }",
    "if [ -n \"${ZSH_VERSION-}\" ]; then",
    "  autoload -Uz add-zsh-hook 2>/dev/null || true",
    "  add-zsh-hook precmd __rssh_emit_cwd 2>/dev/null || true",
    "elif [ -n \"${BASH_VERSION-}\" ]; then",
    "  case \";${PROMPT_COMMAND-};\" in",
    "    *\";__rssh_emit_cwd;\"*) : ;;",
    "    *) PROMPT_COMMAND=\"__rssh_emit_cwd${PROMPT_COMMAND:+; $PROMPT_COMMAND}\" ;;",
    "  esac",
    "fi",
    "__rssh_emit_cwd",
  ].join("; ");
}

function powershellHook(): string {
  return [
    "function global:__rssh_emit_cwd { [Console]::Write([char]27 + ']7337;cwd:' + (Get-Location).Path + [char]27 + '\\') }",
    "if (Test-Path Function:\\prompt) {",
    "  $script:__rssh_prev_prompt = (Get-Item Function:\\prompt).ScriptBlock",
    "  function global:prompt { __rssh_emit_cwd; & $script:__rssh_prev_prompt }",
    "} else {",
    "  function global:prompt { __rssh_emit_cwd; \"PS $($executionContext.SessionState.Path.CurrentLocation)> \" }",
    "}",
    "__rssh_emit_cwd",
  ].join("; ");
}

/** Build a one-shot prompt hook that emits OSC 7337 cwd updates on every prompt.
 *  cmd.exe has no prompt hook that can execute commands, so it is intentionally unsupported. */
export function buildRemoteCwdHook(shell: ShellKind): string | null {
  switch (shell) {
    case "posix":
      return posixHook();
    case "powershell":
      return powershellHook();
    case "cmd":
      return null;
  }
}

/** Parse the payload inside `OSC 7337 ; cwd:<payload> ST`. */
export function parseRemoteCwdPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(trimmed).pathname);
    } catch {
      return null;
    }
  }
  return trimmed;
}

export function buildRemoteCwdOsc(path: string): string {
  return `${OSC_PREFIX}${path}${OSC_SUFFIX}`;
}
