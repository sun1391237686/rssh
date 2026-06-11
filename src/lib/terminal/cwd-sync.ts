/**
 * 终端目录同步器 — 拦截 cd 命令，自动执行 pwd 获取真实路径（类似 FinalShell）。
 *
 * 工作原理：
 * 1. 监听终端输出，识别 cd/pushd/popd 命令
 * 2. 等待命令执行完成（检测到 prompt）
 * 3. 后台通过独立 SSH exec channel 执行 pwd 获取真实路径
 * 4. 同步给 SFTP 浏览器
 */

/** 目录同步器配置 */
export interface CwdSyncConfig {
  /** 是否启用目录同步 */
  enabled: boolean;
  /** 目录变化回调 */
  onCwdChange: (cwd: string) => void;
}

/** 同步器状态 */
enum SyncState {
  /** 空闲状态 */
  IDLE,
  /** 已检测到 cd 命令，等待执行完成 */
  WAITING_CD,
}

/**
 * 创建目录同步器实例。
 * 返回清理函数。
 */

/**
 * 创建目录同步器实例。
 * 返回清理函数。
 */
export function createCwdSync(config: CwdSyncConfig): {
  /** 处理用户输入 */
  handleInput: (data: string) => void;
  /** 处理终端输出 */
  handleOutput: (text: string) => void;
  /** 清理资源 */
  dispose: () => void;
  /** 配置中的 onCwdChange */
  onCwdChange: (cwd: string) => void;
} {
  let state = SyncState.IDLE;
  let pendingCommand = "";
  let pendingCdCommand = "";  // 保存 cd 命令的内容
  let currentCwd = "";  // 记录当前目录，避免重复同步

  // 常见的 prompt 结尾模式
  const PROMPT_PATTERNS = [
    /\$\s*$/,          // user@host:dir$
    /#\s*$/,           // [user@host dir]#
    />\s*$/,           // PS C:\Users\user>
  ];

  /**
   * 检测文本是否包含 prompt（命令执行完成的信号）。
   */
  function hasPrompt(text: string): boolean {
    // 移除 ANSI 转义序列
    const cleaned = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
    // 检查是否匹配任何 prompt 模式
    return PROMPT_PATTERNS.some(pattern => pattern.test(cleaned));
  }

  /**
   * 检测输入是否是 cd 类命令。
   * 返回命令类型，如果不是则返回 null。
   */
  function detectCdCommand(input: string): "cd" | "pushd" | "popd" | null {
    const trimmed = input.trim();

    // 跳过空命令
    if (!trimmed) return null;

    // 跳过包含管道符、重定向符的复合命令
    if (/[|><]/.test(trimmed)) return null;

    // 检测 cd 命令
    if (/^cd\s/.test(trimmed) || trimmed === "cd") return "cd";

    // 检测 pushd 命令
    if (/^pushd\s/.test(trimmed) || trimmed === "pushd") return "pushd";

    // 检测 popd 命令
    if (/^popd\s*$/.test(trimmed)) return "popd";

    return null;
  }

  /**
   * 处理用户输入。
   * 当检测到 cd 类命令时，设置状态为等待。
   */
  function handleInput(data: string) {
    // 不再依赖输入事件，改为从输出中检测 cd 命令
    return;
  }

  /**
   * 处理终端输出。
   * 当 cd 命令执行完成后，发送 pwd 命令。
   * 当 pwd 命令返回结果后，解析并同步目录。
   */
  function handleOutput(text: string) {
    if (!config.enabled) return;

    // 移除 ANSI 转义序列后检查
    const cleaned = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

    // 从输出中检测 cd 命令回显
    if (state === SyncState.IDLE) {
      console.log("[cwd-sync] Checking output for cd command:", cleaned);
      // 检测 cd 命令回显（格式：cd xxx 或 cd）
      const cdMatch = cleaned.match(/\bcd\b\s*(.*)?$/m);
      if (cdMatch) {
        console.log("[cwd-sync] Detected cd command in output:", cdMatch[0]);
        pendingCdCommand = cdMatch[0];  // 保存 cd 命令
        state = SyncState.WAITING_CD;
      }
    }

    switch (state) {
      case SyncState.WAITING_CD:
        console.log("[cwd-sync] Waiting for cd command to complete, cleaned:", cleaned);
        // 等待 cd 命令执行完成（检测到 prompt）
        if (hasPrompt(cleaned)) {
          console.log("[cwd-sync] Prompt detected after cd");
          // cd 命令执行完成，解析 cd 命令的参数
          state = SyncState.IDLE;

          // 从保存的 cd 命令中解析目标目录
          const cdMatch = pendingCdCommand.match(/\bcd\s+(.+?)$/);
          console.log("[cwd-sync] cdMatch:", cdMatch);
          if (cdMatch) {
            let targetDir = cdMatch[1].trim();
            console.log("[cwd-sync] targetDir:", targetDir);

            // 处理特殊路径
            if (targetDir === "~") {
              targetDir = "/root";  // 或者从环境变量获取 home 目录
            } else if (targetDir.startsWith("~/")) {
              targetDir = "/root" + targetDir.slice(1);
            } else if (targetDir === "-") {
              // cd - 返回上一个目录，暂时不处理
              console.log("[cwd-sync] cd - detected, skipping");
              return;
            }

            console.log("[cwd-sync] Final targetDir:", targetDir, "currentCwd:", currentCwd);
            // 只有目录变化时才同步
            if (targetDir && targetDir !== currentCwd) {
              console.log("[cwd-sync] Directory changed, syncing:", targetDir);
              currentCwd = targetDir;
              config.onCwdChange(targetDir);
            } else {
              console.log("[cwd-sync] Directory unchanged, skipping sync");
            }
          }
          pendingCdCommand = "";  // 清空保存的命令
        }
        break;

      case SyncState.IDLE:
        // 空闲状态，不做任何处理
        break;
    }
  }

  /**
   * 清理资源。
   */
  function dispose() {
    state = SyncState.IDLE;
    pendingCommand = "";
    pendingCdCommand = "";
    currentCwd = "";
  }

  return {
    handleInput,
    handleOutput,
    dispose,
    onCwdChange: config.onCwdChange,
  };
}
