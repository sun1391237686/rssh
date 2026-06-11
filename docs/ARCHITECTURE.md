# RSSH 架构设计文档

> 可视化架构图与数据流说明

---

## 1. 系统整体架构

```mermaid
graph TB
    subgraph "用户界面层"
        GUI[桌面 GUI<br/>rssh]
        CLI[命令行<br/>rssh-cli]
        IDEA[JetBrains 插件]
    end

    subgraph "通信层"
        OSC[OSC 7337<br/>终端转义序列]
        WS[WebSocket<br/>Headless Server]
        IPC[Tauri IPC<br/>进程内通信]
    end

    subgraph "核心库 rssh_lib"
        subgraph "SSH 模块"
            CLIENT[SSH Client<br/>russh]
            AUTH[认证模块]
            BASTION[跳板机]
            FORWARD[端口转发]
            SFTP_CLIENT[SFTP]
        end

        subgraph "终端模块"
            PTY[PTY<br/>portable-pty]
            SERIAL[串口<br/>serialport]
            RECORDER[录制器<br/>asciicast v2]
        end

        subgraph "AI 模块"
            SESSION[AI 会话]
            LLM[LLM 客户端]
            TOOLS[AI 工具]
            SANITIZE[数据脱敏]
        end

        subgraph "数据层"
            DB[(SQLite<br/>rusqlite)]
            SECRET[SecretStore<br/>密钥管理]
            SYNC[同步模块]
        end

        subgraph "命令层"
            CMDS[Tauri Commands<br/>80+ 命令]
        end
    end

    subgraph "外部服务"
        SSH_SRV[SSH 服务器]
        LLM_API[LLM API<br/>Anthropic/OpenAI/DeepSeek/GLM]
        GH[GitHub<br/>备份仓库]
    end

    GUI --> IPC
    CLI --> OSC
    IDEA --> WS

    IPC --> CMDS
    OSC --> CMDS
    WS --> CMDS

    CMDS --> CLIENT
    CMDS --> SESSION
    CMDS --> DB
    CMDS --> SECRET

    CLIENT --> AUTH
    CLIENT --> BASTION
    CLIENT --> FORWARD
    CLIENT --> SFTP_CLIENT

    SESSION --> LLM
    SESSION --> TOOLS
    SESSION --> SANITIZE

    CLIENT --> SSH_SRV
    LLM --> LLM_API
    SYNC --> GH

    DB --> SECRET
```

---

## 2. 前端架构

```mermaid
graph TB
    subgraph "Svelte 5 前端"
        MAIN[main.ts<br/>入口文件]
        APP[App.svelte<br/>根组件]

        subgraph "状态管理"
            STORE[app.svelte.ts<br/>全局状态]
            AI_STORE[ai/store.svelte.ts<br/>AI 状态]
        end

        subgraph "核心组件"
            SHELL[AppShell.svelte<br/>主外壳]
            TERM[TerminalPane.svelte<br/>终端面板]
            HOME[HomeScreen.svelte<br/>首页]
            SFTP[SftpBrowser.svelte<br/>SFTP 浏览器]
            FWD[ForwardPane.svelte<br/>端口转发]
        end

        subgraph "AI 组件"
            CHAT[ChatPanel.svelte<br/>AI 对话]
            AUDIT[AuditPanel.svelte<br/>审计日志]
        end

        subgraph "工具模块"
            IPC_SHIM[ipc-shim.ts<br/>IPC 适配器]
            OSC_H[osc/handler.ts<br/>OSC 处理器]
            KB[keyboard/<br/>快捷键]
            I18N[i18n/<br/>国际化]
            THEMES[themes/<br/>主题]
        end
    end

    MAIN --> APP
    APP --> SHELL
    APP --> STORE

    SHELL --> TERM
    SHELL --> HOME
    SHELL --> SFTP
    SHELL --> FWD
    SHELL --> CHAT

    TERM --> STORE
    SFTP --> STORE
    FWD --> STORE
    CHAT --> AI_STORE

    MAIN --> IPC_SHIM
    TERM --> OSC_H
    SHELL --> KB
    APP --> I18N
    APP --> THEMES
```

---

## 3. 后端架构

```mermaid
graph TB
    subgraph "Rust 后端"
        subgraph "入口点"
            MAIN[main.rs<br/>GUI 入口]
            LIB[lib.rs<br/>共享库入口]
            SERVER[server_main.rs<br/>Server 入口]
            CLI_BIN[bin/rssh.rs<br/>CLI 入口]
        end

        subgraph "核心模块"
            STATE[state.rs<br/>AppState]
            ERROR[error.rs<br/>AppError]
            MODELS[models.rs<br/>领域模型]
            EMITTER[emitter.rs<br/>事件发射器]
        end

        subgraph "SSH 模块"
            SSH_CLIENT[ssh/client.rs<br/>SSH 客户端]
            SSH_AUTH[ssh/auth.rs<br/>认证]
            SSH_BASTION[ssh/bastion.rs<br/>跳板机]
            SSH_FORWARD[ssh/forward.rs<br/>端口转发]
            SSH_SFTP[ssh/sftp.rs<br/>SFTP]
            SSH_KNOWN[ssh/known_hosts.rs<br/>Host Key]
            SSH_CONFIG[ssh/config.rs<br/>配置解析]
            SSH_PROMPT[ssh/prompt.rs<br/>交互提示]
        end

        subgraph "数据库模块"
            DB_MOD[db/mod.rs<br/>连接管理]
            DB_SCHEMA[db/schema.rs<br/>Schema 迁移]
            DB_CRUD[db/*.rs<br/>CRUD 操作]
        end

        subgraph "密钥管理"
            SECRET_MOD[secret/mod.rs<br/>SecretStore trait]
            SECRET_HYBRID[secret/hybrid_store.rs<br/>混合存储]
            SECRET_MASTER[secret/master_key.rs<br/>主密钥]
            SECRET_KEYRING[secret/keyring_store.rs<br/>钥匙串]
            SECRET_CRYPTO[secret/crypto.rs<br/>加密工具]
        end

        subgraph "AI 模块"
            AI_SESSION[ai/session.rs<br/>会话管理]
            AI_LLM[ai/llm/<br/>LLM 客户端]
            AI_TOOLS[ai/tools.rs<br/>AI 工具]
            AI_SANITIZE[ai/sanitize.rs<br/>数据脱敏]
            AI_REDACT[ai/redact_rules.rs<br/>脱敏规则]
            AI_BLACKLIST[ai/command_blacklist.rs<br/>命令黑名单]
            AI_AUDIT[ai/audit.rs<br/>审计日志]
            AI_PROMPTS[ai/prompts.rs<br/>系统提示词]
            AI_SKILLS[ai/skills.rs<br/>诊断技能]
            AI_SHELL[ai/shell.rs<br/>Shell 检测]
        end

        subgraph "终端模块"
            TERM_PTY[terminal/pty.rs<br/>PTY]
            TERM_SERIAL[terminal/serial.rs<br/>串口]
            TERM_REC[terminal/recorder.rs<br/>录制器]
        end

        subgraph "同步模块"
            SYNC_GH[sync/github.rs<br/>GitHub 同步]
            SYNC_EXPORT[sync/export.rs<br/>导出]
            SYNC_IMPORT[sync/import.rs<br/>导入]
        end

        subgraph "命令模块"
            CMD_PROFILE[commands/profile.rs]
            CMD_SESSION[commands/session.rs]
            CMD_SFTP[commands/sftp.rs]
            CMD_FORWARD[commands/forward.rs]
            CMD_PTY[commands/pty.rs]
            CMD_SERIAL[commands/serial.rs]
            CMD_SETTINGS[commands/settings.rs]
            CMD_LIFECYCLE[commands/lifecycle.rs]
            CMD_SYNC[commands/sync.rs]
            CMD_CLI[commands/cli.rs]
            CMD_WINDOW[commands/window.rs]
            CMD_EXTERNAL[commands/external.rs]
            CMD_UPDATE[commands/update.rs]
            CMD_GROUP[commands/group.rs]
        end
    end

    MAIN --> LIB
    SERVER --> LIB
    CLI_BIN --> LIB

    LIB --> STATE
    LIB --> ERROR
    LIB --> MODELS
    LIB --> EMITTER

    STATE --> DB_MOD
    STATE --> SECRET_MOD
    STATE --> SSH_CLIENT

    SSH_CLIENT --> SSH_AUTH
    SSH_CLIENT --> SSH_BASTION
    SSH_CLIENT --> SSH_FORWARD
    SSH_CLIENT --> SSH_SFTP
    SSH_CLIENT --> SSH_KNOWN
    SSH_CLIENT --> SSH_CONFIG
    SSH_CLIENT --> SSH_PROMPT

    DB_MOD --> DB_SCHEMA
    DB_MOD --> DB_CRUD

    SECRET_MOD --> SECRET_HYBRID
    SECRET_HYBRID --> SECRET_MASTER
    SECRET_HYBRID --> SECRET_CRYPTO
    SECRET_MASTER --> SECRET_KEYRING

    AI_SESSION --> AI_LLM
    AI_SESSION --> AI_TOOLS
    AI_SESSION --> AI_SANITIZE
    AI_SESSION --> AI_AUDIT
    AI_SESSION --> AI_PROMPTS
    AI_SESSION --> AI_SKILLS
    AI_SESSION --> AI_SHELL
    AI_SANITIZE --> AI_REDACT
    AI_SANITIZE --> AI_BLACKLIST

    CMD_SESSION --> SSH_CLIENT
    CMD_SFTP --> SSH_SFTP
    CMD_FORWARD --> SSH_FORWARD
    CMD_PTY --> TERM_PTY
    CMD_SERIAL --> TERM_SERIAL
    CMD_SYNC --> SYNC_GH
    CMD_PROFILE --> DB_CRUD
    CMD_SETTINGS --> DB_CRUD
```

---

## 4. 数据流

### 4.1 SSH 连接流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant CMD as Tauri Command
    participant SSH as SSH Client
    participant AUTH as 认证模块
    participant REMOTE as 远程服务器

    U->>FE: 点击连接
    FE->>CMD: invoke("ssh_connect", profile)
    CMD->>SSH: 建立连接
    SSH->>REMOTE: TCP 连接
    REMOTE-->>SSH: 服务器公钥

    alt 首次连接
        SSH->>FE: emit("ssh:host_key_prompt", ...)
        FE->>U: 显示 Host Key 确认
        U->>FE: 确认
        FE->>CMD: invoke("ssh_host_key_accept")
        CMD->>SSH: 保存 Host Key
    end

    SSH->>AUTH: 开始认证

    alt 密码认证
        AUTH->>FE: emit("ssh:auth_prompt", ...)
        FE->>U: 显示密码输入
        U->>FE: 输入密码
        FE->>CMD: invoke("ssh_auth_respond")
        CMD->>AUTH: 发送密码
    else 私钥认证
        AUTH->>CMD: 读取私钥
        CMD->>AUTH: 提供私钥
    end

    AUTH->>REMOTE: 认证请求
    REMOTE-->>AUTH: 认证结果
    AUTH-->>SSH: 认证成功
    SSH->>FE: emit("ssh:connected", ...)
    FE->>U: 显示终端
```

### 4.2 AI 诊断流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant CMD as Tauri Command
    participant AI as AI Session
    participant LLM as LLM API
    participant SSH as SSH Session
    participant SANITIZE as 数据脱敏

    U->>FE: 输入问题
    FE->>CMD: invoke("ai_chat", message)
    CMD->>AI: 创建/继续会话
    AI->>SANITIZE: 脱敏用户输入
    SANITIZE-->>AI: 脱敏后文本
    AI->>LLM: 发送请求

    LLM-->>AI: 响应（含工具调用）

    alt 工具调用: run_command
        AI->>FE: emit("ai:tool_call", ...)
        FE->>U: 显示命令确认
        U->>FE: 确认执行
        FE->>CMD: invoke("ai_tool_confirm")
        CMD->>SSH: 执行命令
        SSH-->>CMD: 命令输出
        CMD->>SANITIZE: 脱敏输出
        SANITIZE-->>AI: 脱敏后输出
        AI->>LLM: 发送工具结果
    end

    LLM-->>AI: 最终响应
    AI->>FE: emit("ai:response", ...)
    FE->>U: 显示响应
```

### 4.3 CLI ↔ GUI 通信流程

```mermaid
sequenceDiagram
    participant CLI as rssh-cli
    participant TERM as 内嵌终端
    participant XTERM as xterm.js
    participant OSC as OSC Handler
    participant STORE as app.svelte.ts

    CLI->>TERM: 输出 OSC 7337 序列
    TERM->>XTERM: 终端数据流
    XTERM->>OSC: 解析 OSC 序列
    OSC->>STORE: 调用 store 方法
    STORE-->>OSC: 执行结果
    OSC->>XTERM: 更新 UI
```

---

## 5. 安全架构

```mermaid
graph TB
    subgraph "密钥存储"
        direction TB
        KC_MAC[macOS Keychain]
        KC_WIN[Windows Credential Manager]
        KC_LINUX[Linux Secret Service]
        KC_FILE[文件存储<br/>master.key]
    end

    subgraph "加密层"
        direction TB
        ARGON2[Argon2id<br/>密钥派生]
        CHACHA[ChaCha20-Poly1305<br/>AEAD 加密]
    end

    subgraph "数据存储"
        direction TB
        DB[(SQLite<br/>secrets 表)]
        CONFIG[配置文件]
    end

    subgraph "AI 安全"
        direction TB
        VALIDATOR[Shape Validator<br/>格式验证]
        APPROVAL[用户授权<br/>工具调用确认]
        REDACT[数据脱敏<br/>敏感信息清洗]
        BLACKLIST[命令黑名单<br/>危险命令拦截]
        TRUNCATE[输出截断<br/>防止过长]
    end

    KC_MAC --> CHACHA
    KC_WIN --> CHACHA
    KC_LINUX --> CHACHA
    KC_FILE --> CHACHA
    ARGON2 --> CHACHA
    CHACHA --> DB

    VALIDATOR --> APPROVAL
    APPROVAL --> REDACT
    REDACT --> BLACKLIST
    BLACKLIST --> TRUNCATE
```

---

## 6. 平台适配架构

```mermaid
graph TB
    subgraph "编译时平台分支"
        direction LR
        CFG_MAC["#[cfg(target_os = 'macos')]"]
        CFG_WIN["#[cfg(target_os = 'windows')]"]
        CFG_LINUX["#[cfg(target_os = 'linux')]"]
        CFG_ANDROID["#[cfg(target_os = 'android')]"]
    end

    subgraph "运行时平台分支"
        direction LR
        IS_MOBILE["app.isMobile<br/>UA 嗅探"]
        IS_DESKTOP["!app.isMobile"]
    end

    subgraph "功能矩阵"
        direction TB
        SSH_FEAT[SSH 连接<br/>全平台]
        PTY_FEAT[本地终端<br/>桌面 only]
        SERIAL_FEAT[串口<br/>桌面 only]
        KEYCHAIN_FEAT[钥匙串<br/>桌面 only]
        MOBILE_KB[虚拟键盘<br/>移动端 only]
    end

    CFG_MAC --> KEYCHAIN_FEAT
    CFG_WIN --> KEYCHAIN_FEAT
    CFG_LINUX --> KEYCHAIN_FEAT
    CFG_ANDROID -.->|降级| KEYCHAIN_FEAT

    IS_DESKTOP --> PTY_FEAT
    IS_DESKTOP --> SERIAL_FEAT
    IS_MOBILE --> MOBILE_KB
```

---

## 7. 事件系统架构

```mermaid
graph LR
    subgraph "事件命名规范"
        DOMAIN["domain<br/>ssh/sftp/ai/..."]
        EVENT["event<br/>data/exit/prompt/..."]
        SESSION_ID["sessionId<br/>tab UUID"]
    end

    subgraph "事件发射"
        TAURI_EMIT["Host::Tauri<br/>app.emit()"]
        WS_EMIT["Host::Headless<br/>ws push"]
    end

    subgraph "事件监听"
        FE_LISTEN["前端 listen()"]
        FE_HANDLE["事件处理"]
    end

    DOMAIN --> EVENT --> SESSION_ID
    SESSION_ID --> TAURI_EMIT
    SESSION_ID --> WS_EMIT
    TAURI_EMIT --> FE_LISTEN
    WS_EMIT --> FE_LISTEN
    FE_LISTEN --> FE_HANDLE
```

---

## 8. Tab 管理架构

```mermaid
graph TB
    subgraph "Tab 类型"
        HOME_TAB["home<br/>固定，不可关闭"]
        SSH_TAB["ssh:uuid"]
        LOCAL_TAB["local:uuid"]
        EDIT_TAB["edit:uuid"]
        FWD_TAB["fwd:id:timestamp"]
    end

    subgraph "Tab 状态"
        TABS["_tabs: Tab[]<br/>$state"]
        ACTIVE["_activeTabId: string<br/>$state"]
    end

    subgraph "Tab 操作"
        OPEN["openTab()"]
        CLOSE["closeTab()"]
        SWITCH["switchTab()"]
        CLONE["openTabInNewWindow()"]
    end

    subgraph "Tab 渲染"
        APP_SHELL["AppShell.svelte"]
        DISPATCH["tab.type === ?"]
        TERM_PANE["TerminalPane"]
        HOME_PANE["HomeScreen"]
        SFTP_PANE["SftpBrowser"]
        FWD_PANE["ForwardPane"]
    end

    HOME_TAB --> TABS
    SSH_TAB --> TABS
    LOCAL_TAB --> TABS
    EDIT_TAB --> TABS
    FWD_TAB --> TABS

    OPEN --> TABS
    CLOSE --> TABS
    SWITCH --> ACTIVE

    TABS --> APP_SHELL
    ACTIVE --> APP_SHELL
    APP_SHELL --> DISPATCH
    DISPATCH --> TERM_PANE
    DISPATCH --> HOME_PANE
    DISPATCH --> SFTP_PANE
    DISPATCH --> FWD_PANE
```

---

*文档版本：v1.0*
*最后更新：2026-06-11*
