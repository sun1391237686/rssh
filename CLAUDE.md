# CLAUDE.md — RSSH 项目指南

> 本文件为 AI 助手提供项目上下文和工作规范。与代码冲突时以代码为准。

---

## 项目概述

RSSH 是一个跨平台 SSH 连接管理器，集桌面 GUI、内置 CLI 和 AI 运维助手于一体。

- **技术栈**：Tauri v2 + Svelte 5 (runes) + Rust
- **支持平台**：macOS、Windows、Linux、Android、JetBrains IDE
- **核心理念**：为 AI 运维而生的 SSH 客户端

---

## 三种运行模式

| 模式 | 入口文件 | 说明 |
|------|---------|------|
| 桌面 GUI | `src-tauri/src/main.rs` | 标准 Tauri 应用 |
| CLI | `src-tauri/src/bin/rssh/main.rs` | 需 `--features cli` |
| Headless Server | `src-tauri/src/server_main.rs` | 需 `--features server`，为 JetBrains 插件服务 |

三者共享 `rssh_lib` 库（`src-tauri/src/lib.rs`）。

---

## 关键规则

### R1. Tauri 事件命名：`<domain>:<event>:<sessionId>`

```bash
rg 'emit\(' src-tauri/src   # 查看现有事件格式
```

### R2. CLI ↔ GUI 走 OSC 7337

不要新建 IPC 通道，通过终端转义序列通信。

```bash
rg 'OSC_RSSH_ID|7337' src src-tauri/src/bin
```

### R3. 新增 `#[tauri::command]` 必须双注册

在 `commands/*.rs` 写函数 + `src-tauri/src/lib.rs` 的 `generate_handler!` 宏注册。

```bash
rg 'generate_handler!' src-tauri/src/lib.rs
```

### R4. Tab 内根容器三件套

```css
flex: 1;
overflow-y: auto;
min-height: 0;
```

### R5. Secret 不进 DB 明文

走 `SecretStore`（`src-tauri/src/secret/`）。

```bash
rg 'secret_store|SecretStore' src-tauri/src
```

### R6. Svelte 5 runes only

使用 `$state` / `$derived` / `$effect` / `$props`，事件用 `onclick={fn}`。

禁止：`$:` / `export let` / `on:click`

### R7. State 所有权在 `app.svelte.ts`

私有 `let _x = $state(...)` + 导出 getter 函数。不要导出裸 `$state` 对象。

### R8. 平台分支用 `cfg` / `app.isMobile`

Rust 端：`#[cfg(target_os = "android")]`
前端：`app.isMobile`（UA 嗅探，顶层 const）

### R9. 新增功能必须显式考虑三端

- 桌面 GUI：默认目标
- 移动 GUI：`app.isMobile` 路径
- CLI：`src-tauri/src/bin/rssh.rs`

---

## 项目结构

```
src/                          # 前端（Svelte 5）
  lib/
    stores/app.svelte.ts      # 全局状态
    components/               # UI 组件
    ai/                       # AI 诊断相关
    osc/handler.ts            # OSC 处理
    keyboard/                 # 快捷键
    i18n/                     # 国际化
  styles/global.css           # 设计令牌

src-tauri/                    # 后端（Rust）
  src/
    main.rs                   # GUI 入口
    lib.rs                    # 共享库入口
    state.rs                  # AppState
    error.rs                  # 错误类型
    models.rs                 # 领域模型
    ssh/                      # SSH 模块
    db/                       # 数据库
    secret/                   # 密钥管理
    ai/                       # AI 诊断
    terminal/                 # PTY/串口/录制
    commands/                 # Tauri 命令
    sync/                     # 同步模块
```

---

## 常用命令

```bash
# 开发
npm install                   # 安装前端依赖
npm run tauri dev             # 启动开发服务器

# 构建
npm run build                 # 构建前端
cd src-tauri && cargo check   # Rust 类型检查
npm run tauri build           # 构建桌面应用

# 测试
npm run test                  # 运行前端测试

# 代码检查
cargo fmt                     # Rust 格式化
cargo clippy                  # Rust 检查
```

---

## 数据存储

| 文件 | 用途 |
|------|------|
| `~/.rssh/rssh.db` | SQLite 数据库 |
| `~/.rssh/snippets.json` | 代码片段 |
| `~/.rssh/master.key` | 文件主密钥（钥匙串不可用时） |
| `~/.ssh/known_hosts` | Host Key 存储（与 OpenSSH 共享） |

---

## 安全机制

- **密钥存储**：平台钥匙串（macOS Keychain / Windows Credential Manager / Linux Secret Service）
- **加密算法**：Argon2id (KDF) + ChaCha20-Poly1305 (AEAD)
- **AI 安全**：数据脱敏、命令黑名单、工具调用验证、用户授权

---

## 代码规范

### Rust
- 命名：snake_case 函数/字段，PascalCase 类型
- 错误处理：`AppError` enum + `AppResult<T>`

### TypeScript/Svelte
- 命名：camelCase 函数/变量，PascalCase 类型/组件
- State getter：动词短语 `tabs()` `activeTab()`，不带 `get` 前缀
- 错误消息：中文，面向用户

### CSS
- 使用 `src/styles/global.css` 的设计令牌
- 使用现有的 `.neu-*` / `.btn*` 类
- 不要自定义十六进制颜色

---

## 常见陷阱

1. **多窗口 `reconcile_sessions`**：克隆窗口必须跳过，否则会杀掉父窗口的 session
2. **Linux CLI shadow GUI**：`/usr/local/bin/rssh` 会 shadow `/usr/bin/rssh`
3. **Highlight 注入是 stateful lexer**：必须保留已有 ANSI 序列
4. **Keyboard-interactive auth**：走 oneshot channel，Tab 关闭要清 waiter
5. **CLI 直接读写 DB**：改表结构时同时审 CLI 路径
6. **Tauri command 改名是破坏性变更**：前端 `invoke("name")` 字符串硬编码

---

## 提交前检查清单

1. `npm run build` 通过
2. `cd src-tauri && cargo check` 通过
3. 改了 command？检查 `lib.rs` 的 `generate_handler!`
4. 改了事件名？前后端同步 grep `<domain>:`
5. 改了 schema？审 `db/schema.rs` migration + CLI 路径
6. 改了 UI？跑 `npm run tauri dev` 实际点过

---

## 禁止事项

- 创建分析/计划文档（用完即删）
- 起新 IPC 通道
- 在组件里建跨页全局状态
- 把 secret 写 DB 明文
- 用 `--no-verify` 跳 hook
- 复制 AGENT.md 行号字面量进代码

---

## 相关文档

- [AGENT.md](AGENT.md) — 详细导航文档
- [CONTRIBUTING.md](CONTRIBUTING.md) — 贡献指南
- [README.md](README.md) — 项目说明
- [docs/PROJECT_DOC.md](docs/PROJECT_DOC.md) — 完整技术文档
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 架构设计图
