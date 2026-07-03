# CGAO — Developer Architecture Reference

> 细粒度到每个文件的架构文档。面向维护者和贡献者。

---

## 宏观架构

```
cgao/  (37 files, ~2000 lines)
│
├── 插件注册层 (2 files)
│   ├── .claude-plugin/plugin.json   ← Claude Code 读取此文件发现插件
│   └── .mcp.json                    ← 声明 2 个 MCP 服务器
│
├── TypeScript 源码 (6 files, ~850 lines)
│   ├── src/index.ts                 ← 公共导出
│   ├── src/github/api.ts            ← GitHub REST API 封装
│   ├── src/mcp/tools.ts             ← 6 个智能 MCP 工具 (核心)
│   ├── src/mcp/standalone-server.ts ← MCP stdio 服务器入口
│   ├── src/agents/definitions.ts    ← 3 个专用 Agent 定义
│   └── src/cli/index.ts             ← CLI 入口 (cgao setup/status)
│
├── 技能层 — 6 个 Phase (12 files, ~800 lines)
│   ├── skills/scan/skill.md         ← Phase 1: 扫描 + 分类
│   ├── skills/evaluate/skill.md     ← Phase 2: 深度评估 + Go/No-Go
│   ├── skills/fix/skill.md          ← Phase 3: 计划 + 实现
│   ├── skills/pr-create/skill.md    ← Phase 4: 创建 PR
│   ├── skills/review/skill.md       ← Phase 5: 代码审查
│   ├── skills/monitor/skill.md      ← Phase 6: 监控合入
│   └── commands/*.md                ← 6 个懒加载 shim
│
├── Agent 提示词 (3 files, ~270 lines)
│   └── agents/*.md                  ← issue-triage, fix-planner, pr-reviewer
│
├── 基础设施 (5 files)
│   ├── hooks/hooks.json             ← SessionStart 工作流提醒
│   ├── scripts/build-mcp-server.mjs ← esbuild 打包
│   ├── bin/cgao.js                  ← CLI 入口 shell
│   ├── .gitignore
│   └── package.json + tsconfig.json
│
└── 构建产物 (committed for marketplace install)
    ├── dist/                        ← tsc 输出
    ├── bridge/mcp-server.cjs        ← esbuild bundle (~2MB)
    └── package-lock.json
```

---

## 插件注册层

### `.claude-plugin/plugin.json` (11 lines)

Claude Code 插件系统的**唯一入口**。Claude Code 读取此文件来发现插件的所有能力。

```jsonc
{
  "name": "cgao",
  "skills": ["./skills/scan/", "./skills/evaluate/", ...],  // 6 个 skill → /cgao:scan 等
  "mcpServers": "./.mcp.json",   // 指向 MCP 服务器配置
  "commands": "./commands/"      // 指向斜杠命令定义
}
```

**关键字段**：
| 字段 | 效果 |
|------|------|
| `skills` | 每个路径指向一个含 `skill.md` 的目录。Claude Code 将其注册为 `/cgao:<dirname>` |
| `mcpServers` | 指向 `.mcp.json`。Claude Code 在启动时 spawn 声明的子进程 |
| `commands` | 每个 `.md` 文件注册为一个斜杠命令。内容仅在用户调用时加载（懒加载） |

**设计意图**：skills 和 commands 都指向同一个技能，但 skills 在插件加载时注入系统提示词（体积较大），commands 在用户输入 `/cgao:xxx` 时按需加载（体积小，只是转发指令）。这就是 OMC 的"shim 模式"。

### `.mcp.json` (14 lines)

MCP 协议的服务声明。Claude Code 读取此文件，为每个条目 spawn 一个子进程。

```jsonc
{
  "mcpServers": {
    "github": {                             // → mcp__github__*
      "command": "npx",
      "args": ["-y", "@anthropic-ai/github-mcp-server"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PAT}" }
    },
    "cgao": {                               // → mcp__cgao__*
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/bridge/mcp-server.cjs"],
      "env": { "GITHUB_TOKEN": "${GITHUB_PAT}", "CGAO_STATE_DIR": "..." }
    }
  }
}
```

**两个 MCP 服务器的分工**：
| 服务器 | 工具数 | 职责 |
|--------|--------|------|
| `github` (官方) | 90+ | 原始 GitHub API：issues、PRs、reviews、actions... |
| `cgao` (自定义) | 6 | 智能层：分类、分析、计划、质量检查、合并就绪、状态追踪 |

**关键细节**：`${CLAUDE_PLUGIN_ROOT}` 是 Claude Code 在启动子进程时注入的环境变量，指向插件的安装目录。这样 `bridge/mcp-server.cjs` 无论安装在哪个路径都能被找到。

---

## TypeScript 源码层

### `src/index.ts` (9 lines)

公共 API 导出。供 SDK 编程使用（非插件模式）。

```typescript
export { tools } from './mcp/tools.js';
export { getAgentDefinitions, ... } from './agents/definitions.js';
export { resolveRepo, getIssue, ... } from './github/api.js';
```

### `src/github/api.ts` (90 lines)

GitHub REST API 的轻量封装。**注意：这不是 MCP 工具的直接实现，而是 MCP 工具调用的底层函数。**

```
调用链:
  Agent → mcp__cgao__cgao_triage_issue
       → src/mcp/tools.ts: handler()
       → src/github/api.ts: getIssue() / ghFetch()
       → https://api.github.com
```

**核心设计**：

```typescript
// Token 解析优先级：env GITHUB_TOKEN → env GITHUB_PAT → gh auth token
export function resolveToken(): string { ... }

// 通用 fetch 包装，自动附 token 和版本头
async function ghFetch<T>(path: string, opts = {}): Promise<T> { ... }

// Issue 操作
export async function getIssue(owner, repo, num): Promise<GHIssue> { ... }
export async function listIssues(owner, repo, opts): Promise<GHIssue[]> { ... }
export async function addComment(owner, repo, num, body) { ... }

// PR 操作
export async function getPR(owner, repo, num): Promise<GHPR> { ... }
export async function listPRs(owner, repo, opts): Promise<GHPR[]> { ... }
export async function getPRStatus(owner, repo, ref) { ... }
export async function getPRChecks(owner, repo, ref) { ... }
export async function listReviews(owner, repo, num) { ... }

// Repo 解析：从 git remote 自动推断 owner/repo
export function resolveRepo(): { owner: string; repo: string } { ... }
```

**类型定义**：`GHIssue` 和 `GHPR` 接口只包含 CGAO 需要的字段，而非完整的 GitHub API 响应。

**与官方 GitHub MCP 的关系**：官方 MCP 工具（`mcp__github__*`）处理 Agent 直接调用的 API 操作（如 `create_pull_request`）。CGAO 的 API 层（`src/github/api.ts`）在自定义 MCP 工具中使用，用于**读取数据来支撑智能分析**（如 triage 时读取 issue 内容，merge check 时聚合多个 API 的结果）。

### `src/mcp/tools.ts` (511 lines) — 核心

CGAO 的核心价值所在。定义 6 个 MCP 工具，每个工具封装了 GitHub 工作流的一个智能环节。

**工具架构**：
```typescript
interface ToolDef {
  name: string;              // MCP 工具名 → mcp__cgao__<name>
  description: string;       // 给 Agent 看的说明
  schema: Record;            // JSON Schema 参数定义
  handler: (args) => Promise<{ content, isError? }>;
}
```

**逐个工具分析**：

#### `cgao_triage_issue` (~120 lines)

```
输入:  issue_number
输出:  classification, severity, scope, actionable, recommendation
```

**分类启发式规则**（不依赖 AI，纯代码逻辑）：
- 检测 label (bug/enhancement/feature) + title/body 关键词
- `isBug`: labels 含 "bug" || title/body 含 "broken/error/crash/fail/regression"
- `isFeature`: labels 含 "enhancement/feature" || title 含 "feature request/add support"
- `isQuestion`: title 含 "how do i/how to/what is" && !isBug
- `hasRepro`: body 含 "steps to reproduce/reproduction"

**严重性推断**：
- `critical`: 涉及 security/vulnerability/xss/sql injection/auth/data leak
- `high`: 涉及 crash/segfault/deadlock/race condition/memory leak
- 默认: `medium`

**范围估算**（基于 body 中文件引用数量）：
- `large`: >5 个文件引用 || 含 "architecture/restructure"
- `medium`: 2-5 个文件
- `small`: 有文件引用 || 含 "simple/minor/one line"

**输出持久化**：调用 `writeState("triage-<N>", result)` 保存到 `.cgao/triage-<N>.json`。

#### `cgao_analyze_codebase` (~100 lines)

```
输入:  issue_number, search_terms[]
输出:  extracted_terms, findings[{term, matches, files}], 
       related_commits, project_structure, suggested_starting_points
```

**工作流**：
1. 从 issue body 中提取搜索词：文件名模式匹配、函数名模式匹配、错误消息匹配
2. 对每个搜索词（最多 10 个），用 `grep -rl` 在本地代码库搜索（限制 5 个匹配）
3. `git log --grep` 搜索关联提交
4. 扫描项目目录结构（src/lib/app/components...）

**为什么不能用官方 MCP**：这些操作需要本地文件系统访问——grep、git log、目录扫描。GitHub API 无法读取本地文件。

#### `cgao_plan_fix` (~70 lines)

```
输入:  issue_number, fix_approach, affected_files[]
输出:  steps[{order, description, files, complexity, test_strategy}],
       pre_checks[], post_checks[]
```

**前置依赖**：加载 triage 和 analysis 结果（`readState()`）。

**生成的步骤**：
1. 核心修改步骤（如果提供了 affected_files）
2. 测试步骤
3. 文档步骤（仅当 issue 是 feature 时）

**持久化**：`writeState("plan-<N>", plan)`。

#### `cgao_assess_pr_quality` (~130 lines)

```
输入:  pr_number? (可选), branch?, base?
输出:  checks[{check, status(PASS/WARN/FAIL), detail}],
       ready_for_pr, check_summary
```

**6 项自动化检查**（纯 git 命令，不依赖外部服务）：
1. **branch**: 当前不在 main/master 上？
2. **up_to_date**: `git rev-list base..HEAD --count`
3. **diff_size**: `git diff --stat` → 文件数 > 20 告警
4. **unrelated_files**: 检查 `package-lock.json/.env/node_modules/.DS_Store`
5. **commit_quality**: 检查 conventional commits 格式 + issue 引用
6. **tests**: 是否包含 test/spec/__tests__ 文件变更

**设计意图**：在代码 push 之前捕获问题。不是替代 CI——是 CI 之前的本地门禁。

#### `cgao_check_merge_readiness` (~110 lines)

```
输入:  pr_number
输出:  status(READY/BLOCKED), blockers[], warnings[], 
       ci_state, reviews{approved, changes_requested},
       mergeable, recommended_action
```

**聚合分析**（4+ API 调用）：
1. `getPR()` → 基础信息 + mergeable
2. `getPRStatus()` → CI 状态 (pending/success/failure)
3. `getPRChecks()` → 具体 check run 状态
4. `listReviews()` → 审批和变更请求计数
5. 额外检测：已合并？已关闭？草稿？

**推荐动作映射**：
- `ready` → "MERGE"
- `changes_requested` → "FIX_AND_PUSH"
- `failed_checks` → "FIX_TESTS"
- `pending` → "WAIT"

#### `cgao_workflow_state` (~60 lines)

```
输入:  action(get/set/list), issue_number?, phase?, pr_number?
输出:  当前工作流状态对象
```

**持久化层**：以 JSON 文件存储在 `.cgao/` 目录。

**状态结构**：
```json
{
  "issue_number": 42,
  "phase": "evaluated",
  "pr_number": 142,
  "phases": {
    "triaged": "2026-07-04T10:00:00Z",
    "evaluated": "2026-07-04T10:15:00Z"
  }
}
```

**设计意图**：6 个 phase 的 skill 是独立的，通过此工具传递状态——Scan 写入 triage 结果，Evaluate 读取它，Fix 读取评估结果并写入计划，依此类推。

### `src/mcp/standalone-server.ts` (40 lines)

MCP 协议的 stdio 传输层。一个薄壳，将工具注册表暴露为 MCP 服务器。

```
Claude Code                     CGAO MCP Server
    │                               │
    │   spawn node bridge/mcp-server.cjs
    ├──────────────────────────────►│
    │                               │ server.connect(StdioServerTransport)
    │  JSON-RPC: tools/list         │
    ├──────────────────────────────►│ → return tools[].name/description/schema
    │                               │
    │  JSON-RPC: tools/call         │
    │  {name:"cgao_triage_issue",   │
    │   arguments:{issue_number:42}}│
    ├──────────────────────────────►│ → tool.handler(args) → return content
```

**生命周期**：
1. Claude Code spawn `node bridge/mcp-server.cjs`（插件启动时）
2. MCP Server 启动，等待 stdin
3. 每个工具调用通过 JSON-RPC 到达
4. Claude Code 关闭时 SIGTERM → 3 秒强制退出

### `src/agents/definitions.ts` (122 lines)

3 个专用 Agent 的定义和注册表。

**Agent 配置结构**：
```typescript
interface AgentConfig {
  name: string;        // Agent 标识符
  description: string; // 给主 Agent 看的简短说明
  prompt: string;      // 完整系统提示词
  model: 'haiku' | 'sonnet' | 'opus';  // 推荐模型
}
```

**Prompt 加载逻辑**：
```typescript
function loadPrompt(name: string): string {
  // 1. 尝试加载 agents/<name>.md（插件目录）
  // 2. 尝试加载 <cwd>/agents/<name>.md（项目目录，允许覆盖）
  // 3. 回退到代码内嵌的 FALLBACK_PROMPTS
}
```

**三个 Agent**：

| Agent | 模型 | 触发时机 | 提示词文件 |
|-------|------|---------|-----------|
| `issue-triage` | Sonnet | `/cgao:scan`, `/cgao:evaluate` | `agents/issue-triage.md` |
| `fix-planner` | Opus | `/cgao:fix` (计划阶段) | `agents/fix-planner.md` |
| `pr-reviewer` | Opus | `/cgao:review` | `agents/pr-reviewer.md` |

**设计意图**：
- Sonnet 用于分类/评估（任务明确、需要速度快）
- Opus 用于计划和审查（需要深度推理）
- Agent 提示词可被项目覆盖（`<cwd>/agents/<name>.md` 优先于插件内置的）

### `src/cli/index.ts` (75 lines)

轻量 CLI 工具。基于 Commander.js，提供 `cgao` 命令。

```bash
cgao setup     # 检查前置条件：gh CLI、GitHub token、官方 MCP 注册
cgao status    # 显示 CGAO 工作流状态（活跃工作流数、triage 数、plan 数）
cgao help      # 显示帮助
```

**不是核心功能**：CLI 只是诊断/辅助工具。核心工作流通过 Claude Code 的 skill 系统运行。

---

## 技能层（Skills）

### 总体结构

每个 skill 目录包含一个 `skill.md`，由 `.claude-plugin/plugin.json` 注册：

```
skills/<name>/skill.md  →  /cgao:<name>    (Claude Code 自动注册)
commands/<name>.md      →  /cgao:<name>    (懒加载 shim，内容更短)
```

**Skills vs Commands 的区别**（同 OMC 模式）：
- **Skills**：插件加载时注入系统提示词，Agent 一直能看到技能的存在
- **Commands**：用户输入斜杠命令时按需加载，内容是"去读 skills/<name>/skill.md"

### `skills/scan/skill.md` (81 lines)

Phase 1: 问题发现和分类。

**工具链**：
```
mcp__github__search_issues → mcp__cgao__cgao_triage_issue → 分类报告
```

**输出**：按优先级排序的 Actionable Issues 表 + Skipped Issues 表。

**关键决策规则**：
- 不调用 `cgao_triage_issue` 就不能标记为 fix
- 全低严重性时建议扩大搜索范围
- 不确定的标记为人工审查

### `skills/evaluate/skill.md` (102 lines)

Phase 2: 深度评估 + 强制门禁。

**工具链**：
```
mcp__github__get_issue → mcp__cgao__cgao_triage_issue → mcp__cgao__cgao_analyze_codebase → Go/No-Go → mcp__cgao__cgao_workflow_state
```

**Go/No-Go 决策矩阵**：
- GO: bug/feature + severity ≥ medium + scope ≠ large + 方法明确 + 无外部依赖
- NO-GO: 外部访问不可用 / scope 过大 / 需要架构决策超越 issue 范围 / 会破坏现有功能

**设计意图**：这是"不写一行代码"之前必须通过的检查点。

### `skills/fix/skill.md` (129 lines)

Phase 3: 计划 + 实现。

**Agent 链**：`fix-planner` (Opus) → `executor` (Sonnet/Opus)

**工具链**：
```
mcp__cgao__cgao_workflow_state (验证前序) → mcp__cgao__cgao_plan_fix → 实现 → mcp__cgao__cgao_assess_pr_quality
```

**前序条件**：必须先通过 evaluate 且返回 GO。

### `skills/pr-create/skill.md` (135 lines)

Phase 4: PR 创建。

**工具链**：
```
mcp__cgao__cgao_assess_pr_quality (最终门禁) → PR 描述生成 → mcp__github__create_pull_request → mcp__cgao__cgao_workflow_state
```

**质量门禁**：`cgao_assess_pr_quality` 的所有 FAIL 项必须在 PR 创建前修复。

### `skills/review/skill.md` (150 lines)

Phase 5: 多维度代码审查。

**Agent 链**：`pr-reviewer` (Opus) 进行 7 维度分析。

**审查维度**：
1. Correctness — 修好了吗？边界情况？
2. Security — 注入、认证、密钥
3. Performance — N+1、分配、阻塞
4. Maintainability — 命名、函数大小、模式
5. Testing — 覆盖、边界、回归保护
6. Regression Risk — 调用者、隐式依赖
7. Consistency — 项目约定、一致性

**决策矩阵**：
- APPROVE: 无 CRITICAL 或 HIGH
- REQUEST_CHANGES: 有 CRITICAL 或 ≥3 HIGH
- COMMENT: 只有 MEDIUM/LOW

### `skills/monitor/skill.md` (143 lines)

Phase 6: 合入监控。

**工具链**：
```
mcp__cgao__cgao_check_merge_readiness → 分析阻塞 → 状态 dashboard → 建议动作
```

**状态转换状态机**：
```
PR Opened → CI Running → CI Passed → Reviews In → Approved → MERGED
               │              │             │
               └→ FAILED      └→ FIX NEEDED └→ CHANGES REQUESTED
                     │              │             │
                     └→ Fix & Push ─┘             └→ Fix & Push
```

---

## Agent 提示词层

三个 `.md` 文件，定义了 CGAO 专用 Agent 的系统提示词。这些文件在 `.claude-plugin/plugin.json` 中没有直接引用（Agent 是 OMC 的概念，CGAO 复用了这种模式），而是通过 `src/agents/definitions.ts` 中的 `loadPrompt()` 加载。

### `agents/issue-triage.md` (56 lines)

Issue triage Agent 的操作规范。

**核心流程**：读取 issue → 分类 → 评估严重性 → 估算范围 → 决策。

**输出格式**：标准化的 Markdown triage 报告。

### `agents/fix-planner.md` (84 lines)

Fix planner Agent 的操作规范。

**核心流程**：理解问题 → 识别接触点 → 排序列出变更 → 估算复杂度 → 界定测试策略 → 风险评估。

**关键规则**：指定文件路径必须精确——不能写"src 下某个文件"。不能不包含测试。

### `agents/pr-reviewer.md` (129 lines)

PR reviewer Agent 的操作规范。

**核心流程**：阅读 diff → 7 维度分析 → 严重性评分 → 结构化输出。

**每个严重性级别的决策指南**：不仅定义了问题，还定义了严重性阈值和审批标准。

---

## 基础设施层

### `hooks/hooks.json` (17 lines)

SessionStart hook，在 Claude Code 启动时运行。检查 `.cgao/` 目录是否有活跃工作流，有则注入提醒消息。

**设计意图**：让用户在打开 Claude Code 时立即想起"我有未完成的 CGAO 工作流"。

### `scripts/build-mcp-server.mjs` (46 lines)

esbuild 打包脚本。将 `src/mcp/standalone-server.ts` 和所有依赖（`tools.ts`, `api.ts`, `@modelcontextprotocol/sdk`）打包为单文件 `bridge/mcp-server.cjs`。

**为什么需要打包**：MCP 服务器作为独立子进程运行。它必须是一个自包含文件，不能依赖 `node_modules/`。

**关键配置**：
- `platform: 'node'`, `target: 'node20'` — 目标 Node.js 20+
- `format: 'cjs'` — CommonJS 格式（stdio 兼容性最好）
- `external: ['fs', 'path', ...]` — Node 内置模块不打包
- `banner` — 注入 npm 全局路径解析（解决原生模块找不到的问题）

### `bin/cgao.js` (2 lines)

npm bin 入口。`package.json` 中 `"bin": { "cgao": "bin/cgao.js" }` 使 npm 在全局安装时创建 `cgao` 命令。

```
/usr/local/bin/cgao → .../cgao/bin/cgao.js → import '../dist/cli/index.js'
```

### `.gitignore` (3 lines)

只排除 `node_modules/` 和 TypeScript 增量编译缓存。构建产物（`dist/` 和 `bridge/`）**必须提交**，因为 marketplace 安装不会运行构建。

---

## 数据流全景

```
用户输入 /cgao:scan "label:bug"
        │
        ▼
┌─────────────────────────────────────────────┐
│ Claude Code 加载 commands/scan.md            │
│ → 转发到 skills/scan/skill.md                │
│ → Skill 指令注入 Agent 上下文                 │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│ Agent 按 skill 步骤执行                       │
│                                             │
│ Step 1: mcp__github__search_issues          │
│   → 官方 MCP Server (npx @anthropic-ai/...)  │
│   → GitHub API → 返回 issue 列表             │
│                                             │
│ Step 2: mcp__cgao__cgao_triage_issue (#42)  │
│   → CGAO MCP Server (node bridge/mcp-server) │
│   → src/mcp/tools.ts: triage 逻辑            │
│   → src/github/api.ts: getIssue() → 分类     │
│   → 写入 .cgao/triage-42.json               │
│   → 返回分类结果                              │
│                                             │
│ Step 3: Agent 汇总所有 issue 的分类结果        │
│   → 生成优先排序报告                          │
└─────────────────────────────────────────────┘
```

---

## 关键设计决策

### 1. 为什么是 6 个独立的 Skill 而不是 1 个？

每个 phase 需要不同 Agent、不同工具链、不同决策逻辑。6 个独立 skill = 6 个可组合的模块。用户可以只跑 review 而不跑 scan。这也是 OMC 的多 Agent 理念——不要让一个 Agent 做所有事。

### 2. 为什么自定义 MCP 工具被设计为"智能层"而非"包装层"？

官方 GitHub MCP 做了正确的设计——一个工具 = 一个 API 端点。CGAO 的自定义工具做"聚合 + 智能"：triaging 需要分类启发式，codebase analysis 需要本地文件系统，merge readiness 需要跨 4 个 API 查询。这些是官方工具做不到的。

### 3. 为什么状态用 JSON 文件而不是 SQLite？

降低依赖（不需要 better-sqlite3）、人类可读（`.cgao/` 可以手动检查）、零配置。OMC 对于复杂查询用 SQLite，简单状态用 JSON。CGAO 的状态查询足够简单（按 issue number 精确查找），JSON 足够。

### 4. 为什么构建产物要提交？

Marketplace 安装 = `git clone` + 读取配置文件。不会运行 `npm install` 或 `npm run build`。所以 `bridge/mcp-server.cjs` 和 `dist/` 必须预先构建并提交。
