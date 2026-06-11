# RSSH 项目技术文档

> 一个为 AI 运维而生的 SSH 客户端

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 架构设计](#2-架构设计)
- [3. 核心功能](#3-核心功能)
- [4. 技术栈](#4-技术栈)
- [5. 项目结构](#5-项目结构)
- [6. 核心模块详解](#6-核心模块详解)
- [7. 数据存储](#7-数据存储)
- [8. 安全机制](#8-安全机制)
- [9. 开发指南](#9-开发指南)
- [10. 构建与部署](#10-构建与部署)
- [11. 贡献指南](#11-贡献指南)

---

## 1. 项目概述

RSSH 是一款**跨平台 SSH 连接管理器**，集桌面 GUI、内置 CLI 和 AI 运维助手于一体。支持 macOS、Windows、Linux 和 Android 平台。

### 1.1 项目定位

- **核心理念**：为 AI 运维而生的 SSH 客户端
- **目标用户**：运维工程师、DevOps 工程师、系统管理员
- **核心价值**：将 AI 能力深度集成到 SSH 运维工作流中

### 1.2 核心亮点

| 特性 | 说明 |
|------|------|
| **AI 排查** | LLM 驱动的通用运维问题定位，每次工具调用都经过 shape validator、用户授权、本地脱敏三道关卡 |
| **命令块色条** | 零远端依赖，终端命令块自动按颜色分组 |
| **CLI 优先** | CLI 与 GUI 共享同一个数据库，任意终端 `rssh open prod` |
| **安全与同步** | 密钥进系统钥匙串，按凭据控制同步范围，加密备份到 GitHub |

### 1.3 支持平台

| 平台 | 支持状态 | 说明 |
|------|---------|------|
| macOS (Apple Silicon) | ✅ 完整支持 | .dmg 安装包 |
| macOS (Intel) | ✅ 完整支持 | .dmg 安装包 |
| Windows | ✅ 完整支持 | .msi / .exe 安装包 |
| Linux | ✅ 完整支持 | .deb / .rpm / .AppImage |
| Android | ✅ 完整支持 | .apk 安装包 |
| iOS | ⚠️ 自行打包 | 无开发者账号，需自行构建 |
| JetBrains IDE | ✅ 插件支持 | 通过 headless server 运行 |

---

## 2. 架构设计

### 2.1 整体架构

RSSH 采用 **Tauri v2** 框架，前端使用 **Svelte 5**，后端使用 **Rust**。整个系统由三个运行时共享同一个核心库：

```
┌─────────────────────────────────────────────────────────────┐
│                      rssh_lib (共享库)                        │
├─────────────┬─────────────────┬─────────────────────────────┤
│   桌面 GUI   │      CLI        │      Headless Server        │
│   (rssh)    │   (rssh-cli)    │      (rssh-server)          │
├─────────────┴─────────────────┴─────────────────────────────┤
│                      Tauri v2 框架                           │
├─────────────────────────────────────────────────────────────┤
│                      操作系统层                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 三种运行模式

#### 桌面 GUI (`rssh`)
- **入口文件**：`src-tauri/src/main.rs`
- **特点**：标准 Tauri 应用，完整的图形界面
- **功能**：所有功能均可使用

#### CLI (`rssh-cli`)
- **入口文件**：`src-tauri/src/bin/rssh/main.rs`
- **特点**：独立命令行工具，通过 `cli` feature flag 启用
- **共享**：与 GUI 共享数据库和密钥存储
- **通信**：通过 OSC 7337 转义序列与 GUI 内嵌终端通信

#### Headless Server (`rssh-server`)
- **入口文件**：`src-tauri/src/server_main.rs`
- **特点**：无头 WebSocket 服务器，嵌入构建好的前端
- **用途**：为 JetBrains IDE 插件提供服务
- **通信**：通过 WebSocket 提供 HTTP UI 和 IPC 通信

### 2.3 关键架构决策

| 决策 | 说明 |
|------|------|
| **CLI 与 GUI 共享数据库** | 统一数据源，`~/.rssh/rssh.db` |
| **CLI ↔ GUI 走 OSC 7337** | 不再造 IPC 通道，通过终端转义序列通信 |
| **SSH 操作专用线程** | russh 内部类型不是 `Send`，使用专用 OS 线程 + `current_thread` tokio runtime |
| **Tauri 事件命名规范** | `<domain>:<event>:<sessionId>` 避免多 tab 串话 |
| **State 所有权在前端** | `app.svelte.ts` 使用 Svelte 5 runes 管理状态 |
| **Secret 不进 DB 明文** | 通过 `SecretStore` 抽象层处理密钥 |

---

## 3. 核心功能

### 3.1 SSH 连接

- **认证方式**：密码、私钥、键盘交互、SSH Agent
- **跳板机支持**：多级跳板（最多 8 跳，带循环检测）
- **Host Key 验证**：TOFU（Trust On First Use）模式，交互式确认
- **Known Hosts**：兼容 OpenSSH 格式，共享 `~/.ssh/known_hosts`

### 3.2 终端仿真

- **引擎**：xterm.js 5.5.0
- **回滚**：10,000 行
- **高亮**：关键词高亮（ERROR/WARN/INFO/DEBUG 颜色编码）
- **搜索**：终端内容搜索
- **命令块**：自动检测命令块，颜色编码区分
- **图片显示**：支持终端内图片显示

### 3.3 SFTP 文件管理

- **浏览**：远程文件系统浏览
- **传输**：上传/下载，支持递归目录遍历
- **对话框**：桌面平台使用原生文件对话框

### 3.4 端口转发

- **类型**：本地转发、远程转发、动态转发
- **配置**：命名配置，可保存复用
- **统计**：实时字节/连接数统计

### 3.5 本地终端

- **PTY**：基于 `portable-pty` 的本地 shell
- **自动检测**：自动识别 zsh/bash/PowerShell
- **平台限制**：仅桌面平台，Android 不支持

### 3.6 串口控制台

- **协议**：基于 `serialport` crate
- **配置**：波特率、数据位、校验位、停止位、流控制
- **扩展**：Tabby 风格的输入/输出换行模式、本地回显、十六进制模式、登录脚本
- **平台限制**：仅桌面平台

### 3.7 AI 诊断

- **LLM 提供商**：Anthropic、OpenAI、DeepSeek、GLM（智谱 AI）
- **工具集**：
  - `run_command`：在远程主机执行命令
  - `load_skill`：加载诊断技能
  - `download_file`：下载文件进行分析
  - `analyze_locally`：本地分析
  - `match_file`：文件匹配
  - `patch_file`：文件修补
- **安全机制**：
  - Shape validator：验证工具调用格式
  - 用户授权：所有工具调用需用户确认
  - 本地脱敏：数据离开机器前进行清洗

### 3.8 会话录制

- **格式**：asciicast v2
- **回放**：变速回放
- **录制器**：支持多字节 UTF-8 处理

### 3.9 Profile 与凭据管理

- **存储**：SQLite 数据库
- **导入**：支持从 `~/.ssh/config` 导入
- **加密**：ChaCha20-Poly1305 信封加密

### 3.10 同步与备份

- **导出/导入**：加密配置导出/导入
- **GitHub 备份**：加密备份到用户自己的 GitHub 仓库
- **过滤**：按凭据控制同步范围（`save_to_remote` 标志）

### 3.11 代码片段

- **功能**：可复用的命令快捷键
- **快捷键**：Cmd+E

### 3.12 移动端支持

- **虚拟键盘栏**：Ctrl/Alt/方向键/Tab/Esc
- **安全区适配**：刘海屏、圆角屏
- **栈式导航**：移动端友好的导航方式
- **平台判断**：`app.isMobile`（UA 嗅探，启动时确定）

### 3.13 JetBrains IDE 插件

- **运行方式**：通过 headless server 在 JCEF 中运行
- **数据共享**：与桌面版共享 `~/.rssh` 数据目录
- **安装**：Settings → Plugins → Install Plugin from Disk

---

## 4. 技术栈

### 4.1 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Svelte | 5.x | UI 框架（使用 runes 语法） |
| TypeScript | 5.6+ | 类型安全 |
| Vite | 6.x | 构建工具 |
| xterm.js | 5.5.0 | 终端仿真 |
| CodeMirror | 6.x | 代码编辑器 |
| marked | 18.x | Markdown 渲染 |
| DOMPurify | 3.x | HTML 净化 |

### 4.2 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Rust | 2021 edition | 系统语言 |
| Tauri | 2.x | 桌面应用框架 |
| russh | 0.60.1 | SSH 客户端 |
| russh-sftp | 2.x | SFTP 支持 |
| rusqlite | 0.31 | SQLite 数据库 |
| tokio | 1.x | 异步运行时 |
| keyring | 3.x | 平台钥匙串 |
| portable-pty | 0.8 | PTY 支持 |
| serialport | 4.9.0 | 串口支持 |
| argon2 | 0.5 | 密钥派生 |
| chacha20poly1305 | 0.10 | AEAD 加密 |
| tree-sitter | 0.26.9 | 语法分析 |

### 4.3 开发工具

| 工具 | 用途 |
|------|------|
| Vitest | 单元测试 |
| cargo fmt | Rust 代码格式化 |
| cargo clippy | Rust 代码检查 |
| ESLint | TypeScript 代码检查 |

---

## 5. 项目结构

```
rssh/
├── src/                          # 前端源码（Svelte 5）
│   ├── main.ts                   # 入口文件
│   ├── App.svelte                # 根组件
│   ├── lib/
│   │   ├── stores/
│   │   │   └── app.svelte.ts     # 全局状态管理
│   │   ├── components/           # UI 组件
│   │   │   ├── AppShell.svelte   # 主外壳
│   │   │   ├── TerminalPane.svelte # 终端面板
│   │   │   ├── HomeScreen.svelte # 首页
│   │   │   ├── SftpBrowser.svelte # SFTP 浏览器
│   │   │   ├── ForwardPane.svelte # 端口转发
│   │   │   └── ...
│   │   ├── ai/                   # AI 诊断相关
│   │   │   ├── ChatPanel.svelte
│   │   │   ├── AuditPanel.svelte
│   │   │   └── store.svelte.ts
│   │   ├── osc/                  # OSC 处理
│   │   │   └── handler.ts
│   │   ├── keyboard/             # 键盘快捷键
│   │   │   ├── registry.ts
│   │   │   └── keymap.ts
│   │   ├── terminal/             # 终端扩展
│   │   │   ├── command-blocks.ts
│   │   │   ├── folds.ts
│   │   │   └── block-to-image.ts
│   │   ├── i18n/                 # 国际化
│   │   │   ├── index.svelte.ts
│   │   │   └── locales/
│   │   └── themes/               # 主题
│   └── styles/
│       └── global.css            # 设计令牌
│
├── src-tauri/                    # 后端源码（Rust）
│   ├── Cargo.toml                # Rust 依赖配置
│   ├── src/
│   │   ├── main.rs               # GUI 入口
│   │   ├── lib.rs                # 共享库入口
│   │   ├── server_main.rs        # Headless server 入口
│   │   ├── bin/
│   │   │   └── rssh/
│   │   │       └── main.rs       # CLI 入口
│   │   ├── state.rs              # AppState 全局状态
│   │   ├── error.rs              # 错误类型
│   │   ├── models.rs             # 领域模型
│   │   ├── emitter.rs            # 事件发射器
│   │   ├── ssh/                  # SSH 模块
│   │   │   ├── client.rs         # SSH 客户端
│   │   │   ├── auth.rs           # 认证
│   │   │   ├── bastion.rs        # 跳板机
│   │   │   ├── forward.rs        # 端口转发
│   │   │   ├── sftp.rs           # SFTP
│   │   │   ├── known_hosts.rs    # Host Key 管理
│   │   │   ├── config.rs         # SSH 配置解析
│   │   │   └── prompt.rs         # 交互式提示
│   │   ├── db/                   # 数据库模块
│   │   │   ├── mod.rs            # 数据库连接
│   │   │   ├── schema.rs         # 数据库 schema
│   │   │   └── ...               # CRUD 操作
│   │   ├── secret/               # 密钥管理
│   │   │   ├── mod.rs            # SecretStore trait
│   │   │   ├── hybrid_store.rs   # 混合存储
│   │   │   ├── master_key.rs     # 主密钥
│   │   │   ├── keyring_store.rs  # 钥匙串存储
│   │   │   └── crypto.rs         # 加密工具
│   │   ├── ai/                   # AI 诊断模块
│   │   │   ├── session.rs        # AI 会话
│   │   │   ├── llm/              # LLM 客户端
│   │   │   ├── tools.rs          # AI 工具
│   │   │   ├── sanitize.rs       # 数据脱敏
│   │   │   ├── redact_rules.rs   # 脱敏规则
│   │   │   ├── command_blacklist.rs # 命令黑名单
│   │   │   ├── audit.rs          # 审计日志
│   │   │   ├── prompts.rs        # 系统提示词
│   │   │   ├── skills.rs         # 诊断技能
│   │   │   ├── shell.rs          # Shell 检测
│   │   │   └── commands.rs       # Tauri 命令入口
│   │   ├── terminal/             # 终端模块
│   │   │   ├── pty.rs            # PTY 支持
│   │   │   ├── serial.rs         # 串口支持
│   │   │   └── recorder.rs       # 会话录制
│   │   ├── sync/                 # 同步模块
│   │   │   ├── github.rs         # GitHub 同步
│   │   │   └── ...               # 导出/导入
│   │   ├── commands/             # Tauri 命令
│   │   │   ├── profile.rs
│   │   │   ├── session.rs
│   │   │   ├── sftp.rs
│   │   │   ├── forward.rs
│   │   │   ├── pty.rs
│   │   │   ├── serial.rs
│   │   │   ├── settings.rs
│   │   │   ├── lifecycle.rs
│   │   │   ├── sync.rs
│   │   │   ├── cli.rs
│   │   │   ├── window.rs
│   │   │   ├── external.rs
│   │   │   ├── update.rs
│   │   │   ├── group.rs
│   │   │   └── mod.rs
│   │   └── server.rs             # Headless server
│   └── gen/
│       └── android/              # Android 构建文件
│
├── idea-plugin/                  # JetBrains IDE 插件
├── docs/                         # 文档
├── scripts/                      # 构建脚本
├── package.json                  # Node.js 依赖
├── vite.config.ts                # Vite 配置
├── svelte.config.js              # Svelte 配置
├── tsconfig.json                 # TypeScript 配置
├── AGENT.md                      # AI Agent 导航文档
├── CONTRIBUTING.md               # 贡献指南
└── README.md                     # 项目说明
```

---

## 6. 核心模块详解

### 6.1 SSH 模块 (`src-tauri/src/ssh/`)

#### 6.1.1 SSH 客户端 (`client.rs`)

- **底层库**：russh 0.60.1
- **线程模型**：专用 OS 线程 `rssh-ssh` + `current_thread` tokio runtime + `LocalSet`
- **核心类型**：
  - `SessionHandle`：会话句柄
  - `SessionCmd`：会话命令
- **跳板机**：`establish_via_chain` 支持多级跳转

#### 6.1.2 认证 (`auth.rs`)

支持的认证方式：
- 密码认证
- 私钥认证
- 键盘交互认证
- SSH Agent 认证

#### 6.1.3 跳板机 (`bastion.rs`)

- **解析逻辑**：从 `Profile.bastion_profile_id` 引用解析跳板链
- **循环检测**：防止无限循环
- **跳数限制**：最多 8 跳

#### 6.1.4 端口转发 (`forward.rs`)

- **类型**：本地、远程、动态
- **统计**：实时字节/连接数
- **配置**：命名配置，可保存复用

#### 6.1.5 SFTP (`sftp.rs`)

- **底层库**：russh-sftp
- **功能**：列表、上传、下载、mkdir、递归遍历

### 6.2 数据库模块 (`src-tauri/src/db/`)

#### 6.2.1 数据库连接 (`mod.rs`)

- **引擎**：rusqlite（bundled）
- **模式**：WAL（Write-Ahead Logging）
- **位置**：`~/.rssh/rssh.db`

#### 6.2.2 数据库 Schema (`schema.rs`)

版本化迁移系统，当前 16 个版本：

| 表名 | 用途 |
|------|------|
| `credentials` | 凭据存储 |
| `profiles` | SSH Profile |
| `settings` | 应用设置 |
| `forwards` | 端口转发配置 |
| `highlights` | 关键词高亮规则 |
| `groups` | 分组管理 |
| `secrets` | 加密密文 |
| `ai_skills` | AI 诊断技能 |
| `ai_redact_rules` | AI 脱敏规则 |
| `ai_command_blacklist` | AI 命令黑名单 |
| `serial_profiles` | 串口配置 |

### 6.3 密钥管理模块 (`src-tauri/src/secret/`)

#### 6.3.1 架构设计

```
┌─────────────────────────────────────────┐
│           SecretStore (trait)            │
├─────────────────────────────────────────┤
│           HybridStore                   │
│  ┌─────────────────────────────────┐   │
│  │  ChaCha20-Poly1305 AEAD 加密    │   │
│  │  32 字节主密钥                    │   │
│  └─────────────────────────────────┘   │
├───────────────┬─────────────────────────┤
│ KeyringMasterKey │   FileMasterKey      │
│ (平台钥匙串)    │   (文件存储)           │
├───────────────┴─────────────────────────┤
│           DB secrets 表                  │
└─────────────────────────────────────────┘
```

#### 6.3.2 主密钥管理

- **macOS**：macOS Keychain
- **Windows**：Windows Credential Manager
- **Linux**：Secret Service (GNOME Keyring / KWallet)
- **Android**：自动降级到文件存储

#### 6.3.3 加密算法

- **KDF**：Argon2id
- **AEAD**：ChaCha20-Poly1305
- **主密钥**：32 字节随机密钥

### 6.4 AI 诊断模块 (`src-tauri/src/ai/`)

#### 6.4.1 会话管理 (`session.rs`)

- **生命周期**：创建 → 对话 → 结束
- **对话循环**：用户输入 → LLM 响应 → 工具调用 → 结果返回

#### 6.4.2 LLM 客户端 (`llm/`)

| 提供商 | 说明 |
|--------|------|
| Anthropic | Claude 系列 |
| OpenAI | GPT 系列 |
| DeepSeek | DeepSeek 系列 |
| GLM | 智谱 AI |

#### 6.4.3 AI 工具 (`tools.rs`)

| 工具 | 功能 |
|------|------|
| `run_command` | 在远程主机执行命令 |
| `load_skill` | 加载诊断技能 |
| `download_file` | 下载文件进行分析 |
| `analyze_locally` | 本地分析 |
| `match_file` | 文件匹配 |
| `patch_file` | 文件修补 |

#### 6.4.4 安全机制

- **Shape validator**：验证工具调用格式
- **用户授权**：所有工具调用需用户确认
- **数据脱敏**：发送到 LLM 前进行清洗
- **命令黑名单**：阻止危险命令执行
- **输出截断**：防止过长输出

### 6.5 终端模块 (`src-tauri/src/terminal/`)

#### 6.5.1 PTY (`pty.rs`)

- **库**：portable-pty
- **平台限制**：仅桌面平台
- **Shell 检测**：自动识别 zsh/bash/PowerShell

#### 6.5.2 串口 (`serial.rs`)

- **库**：serialport
- **配置**：波特率、数据位、校验位、停止位、流控制
- **扩展**：Tabby 风格的输入/输出换行模式

#### 6.5.3 录制器 (`recorder.rs`)

- **格式**：asciicast v2
- **特点**：支持多字节 UTF-8 处理

### 6.6 同步模块 (`src-tauri/src/sync/`)

#### 6.6.1 GitHub 同步 (`github.rs`)

- **加密**：Argon2id + ChaCha20-Poly1305
- **过滤**：按凭据的 `save_to_remote` 标志控制
- **存储**：用户自己的 GitHub 仓库

### 6.7 前端状态管理 (`src/lib/stores/app.svelte.ts`)

#### 6.7.1 状态结构

- **tabs**：打开的标签页
- **profiles**：SSH Profile 列表
- **credentials**：凭据列表
- **forwards**：端口转发配置
- **groups**：分组
- **settings**：应用设置

#### 6.7.2 Svelte 5 Runes

使用 Svelte 5 的 runes 语法：
- `$state`：响应式状态
- `$derived`：派生状态
- `$effect`：副作用
- `$props`：组件属性

---

## 7. 数据存储

### 7.1 文件位置

| 文件 | 用途 |
|------|------|
| `~/.rssh/rssh.db` | SQLite 数据库 |
| `~/.rssh/snippets.json` | 代码片段 |
| `~/.rssh/master.key` | 文件主密钥（钥匙串不可用时） |
| `~/.ssh/known_hosts` | Host Key 存储（与 OpenSSH 共享） |

### 7.2 数据库表结构

详见 [6.2.2 数据库 Schema](#622-数据库-schema-schemars)

### 7.3 数据迁移

- **版本化迁移**：16 个版本的迁移脚本
- **迁移位置**：`src-tauri/src/db/schema.rs`
- **自动执行**：应用启动时自动检查并执行

---

## 8. 安全机制

### 8.1 密钥安全

- **存储**：平台钥匙串（macOS Keychain / Windows Credential Manager / Linux Secret Service）
- **加密**：ChaCha20-Poly1305 AEAD
- **密钥派生**：Argon2id
- **降级方案**：钥匙串不可用时使用文件存储

### 8.2 AI 安全

- **数据脱敏**：发送到 LLM 前进行清洗
  - 私有 IP 地址
  - Bearer Token
  - AWS 密钥
  - JWT Token
- **命令黑名单**：阻止危险命令执行
  - 破坏性命令
  - 写操作命令
  - 解释器命令
  - 延迟执行命令
  - 转发器命令
- **工具调用验证**：Shape validator 验证格式
- **用户授权**：所有工具调用需用户确认

### 8.3 通信安全

- **WebSocket**：headless server 使用 per-launch token 保护
- **OSC 7337**：CLI ↔ GUI 通信使用终端转义序列
- **GitHub 同步**：加密备份到用户自己的仓库

---

## 9. 开发指南

### 9.1 环境准备

#### 9.1.1 通用要求

- **Node.js** >= 20
- **Rust** stable（通过 [rustup](https://rustup.rs) 安装）
- **npm**（随 Node.js 安装）

#### 9.1.2 macOS

```bash
xcode-select --install
```

#### 9.1.3 Linux (Debian/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y \
    libgtk-3-dev libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev librsvg2-dev
```

#### 9.1.4 Windows

需要安装 Visual Studio Build Tools 并启用 C++ 工作负载。

#### 9.1.5 Android

- **JDK** 17（推荐 Eclipse Temurin）
- **Android SDK** + NDK
- **Rust targets**：
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi
  ```

### 9.2 开发命令

```bash
# 安装前端依赖
npm install

# 启动开发服务器（热重载前端 + Rust 后端）
npm run tauri dev

# 构建前端
npm run build

# Rust 类型检查
cd src-tauri && cargo check

# 运行测试
npm run test
```

### 9.3 代码规范

#### 9.3.1 Rust

- **格式化**：`cargo fmt`
- **检查**：`cargo clippy`
- **命名**：snake_case 函数与字段，PascalCase 类型

#### 9.3.2 TypeScript/Svelte

- **框架**：Svelte 5 runes（`$state` / `$derived` / `$effect` / `$props`）
- **事件**：`onclick={fn}`（不是 `on:click`）
- **命名**：camelCase 函数与变量，PascalCase 类型与组件
- **状态管理**：私有 `let _x = $state(...)` + 导出 getter 函数

#### 9.3.3 CSS

- 使用 `src/styles/global.css` 的设计令牌
- 使用现有的 `.neu-*` / `.btn*` 类
- 不要自定义十六进制颜色

#### 9.3.4 提交规范

- 提交信息解释 *为什么*，而不是 *做了什么*
- 一个 PR 一件事

---

## 10. 构建与部署

### 10.1 桌面构建

```bash
# 当前平台
npm run tauri build

# 指定目标平台
rustup target add x86_64-apple-darwin
npx tauri build --target x86_64-apple-darwin
```

输出位置：`src-tauri/target/release/bundle/`

### 10.2 捆绑 CLI

```bash
# 1. 构建 CLI
cd src-tauri
cargo build --release --features cli --bin rssh-cli

# 2. 暂存
mkdir -p bin
cp target/release/rssh-cli bin/    # Windows 用 rssh-cli.exe

# 3. 构建应用
cd ..
npx tauri build
```

### 10.3 Android 构建

```bash
# 初始化（首次）
npx tauri android init

# 开发
npx tauri android dev

# 发布 APK
npx tauri android build --apk
```

### 10.4 Headless Server 构建

```bash
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml --features server --bin rssh-server
```

### 10.5 JetBrains 插件构建

```bash
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml --features server --bin rssh-server
export RSSH_SERVER_BIN="$PWD/src-tauri/target/release/rssh-server"
cd idea-plugin && ./gradlew buildPlugin
```

### 10.6 发布流程

```bash
# 创建标签
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions 会自动构建所有平台并创建 draft release。

**制品命名规则**：`rssh-{version}-{os}-{arch}.{ext}`

版本号从 git 标签自动获取，无需手动更新 `tauri.conf.json` 或 `Cargo.toml`。

---

## 11. 贡献指南

### 11.1 开发流程

1. Fork 项目
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 提交更改：`git commit -m 'Add my feature'`
4. 推送分支：`git push origin feature/my-feature`
5. 创建 Pull Request

### 11.2 提交前检查清单

1. `npm run build` 通过
2. `cd src-tauri && cargo check` 通过
3. 改了 command？检查 `lib.rs` 的 `generate_handler!`
4. 改了事件名？前后端同步 grep `<domain>:`
5. 改了 schema？审 `db/schema.rs` migration + CLI 路径
6. 改了 UI？跑 dev 点过

### 11.3 PR 要求

- 一个 PR 一件事
- 不要顺手重构无关代码
- UI 改动跑 `npm run tauri dev` 实际点一遍
- 类型通过 ≠ 功能正确

### 11.4 代码审查要点

- **R1**：Tauri 事件命名必须是 `<domain>:<event>:<sessionId>`
- **R2**：CLI ↔ GUI 走 OSC 7337，不要造新 IPC
- **R3**：新增 `#[tauri::command]` 必须双注册
- **R4**：Tab 内根容器必须有 `flex:1; overflow-y:auto; min-height:0`
- **R5**：Secret 不进 DB 明文
- **R7**：Svelte 5 runes only
- **R8**：State 所有权在 `app.svelte.ts`
- **R9**：平台分支用 `cfg` / `app.isMobile`
- **R10**：新增功能必须显式考虑三端

---

## 附录 A：设计令牌

```css
:root {
  --bg: ...;          /* 背景色 */
  --accent: ...;      /* 强调色 */
  --raised: ...;      /* 凸起元素色 */
  --pressed: ...;     /* 按下状态色 */
}
```

详见 `src/styles/global.css`

## 附录 B：Tauri 事件命名规范

```
<domain>:<event>:<sessionId>
```

示例：
- `ssh:auth_prompt:{tabId}`
- `ssh:data:{tabId}`
- `ssh:exit:{tabId}`

## 附录 C：Tab ID 格式

| Tab type | 格式 | 示例 |
|----------|------|------|
| `home` | 字面量 `"home"` | `home` |
| `ssh` / `local` / `edit` | `"<type>:<uuid>"` | `ssh:550e8400-e29b-41d4-a716-446655440000` |
| `forward` | `"fwd:<forward_id>:<timestamp>"` | `fwd:123:1234567890` |

## 附录 D：错误处理

### Rust 端

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    // ...
}

type AppResult<T> = Result<T, AppError>;
```

命令返回 `AppError`，自动序列化成字符串。

### 前端

```typescript
try {
  await invoke('command_name');
} catch (e) {
  app.toast(errMsg(e));
}
```

无全局 error boundary，不要静默吞错。

---

*文档版本：v1.0*
*最后更新：2026-06-11*
*维护者：RSSH 团队*
