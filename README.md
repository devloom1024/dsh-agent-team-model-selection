# dsh-agent-team-model-selection

[![test](https://github.com/devloom1024/dsh-agent-team-model-selection/actions/workflows/test.yml/badge.svg)](https://github.com/devloom1024/dsh-agent-team-model-selection/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Agent Teams 扩展插件：创建成员时指定 LLM 路由（provider / model / reasoning effort），提供模型目录查询工具，支持“自动 / 固定路由”两种模式，并在 **设置 → Agent Teams 模型** 页面提供图形化配置。

本插件替换官方实验包 `@deepseek-ai/dsh-experimental-tool-agent-team` 的注册行（两者注册相同的九个 Team 工具名），并保持其余 Team 能力不变。

**English** — A DeepSeek Harness (DSH) plugin that lets the Team Lead choose a teammate's LLM provider, model, and reasoning effort at spawn time. It replaces the shipped Agent Teams tool plugin (its `tool-agent-team` row is intentionally disabled), adds a `list_team_models` discovery tool, reports each member's route in `list_agents`, and ships a Settings page with two route modes: automatic (follow the Lead, optional whitelist) and fixed route (rejects spawn route parameters). Install from a DSH session with `plugin_manager({ action: "install_bundle", target: "devloom1024/dsh-agent-team-model-selection" })`.

## 两种模式

| 模式 | `modelSelection.mode` | 行为 |
|---|---|---|
| **自动**（默认） | `inherit` | 不传路由参数时沿用 Lead 当前路由（之后 Lead 切换模型也继续跟随）；仍可传 `provider`、`model`、`reasoning_effort` 为单个成员指定路由；可开启白名单，开启后成员的实际路由必须落在白名单内（含继承） |
| **固定路由** | `fixed` | 所有新成员统一使用配置的路由；`spawn_teammate` 一旦带任何路由参数就报错 |

两种模式的设置菜单不同：

| 设置菜单 | 自动 | 固定路由 |
|---|---|---|
| 路由模式选择 | ✓ | ✓ |
| 固定路由：提供方 / 模型 / 思考等级 | — | ✓ |
| 成员可用路由白名单（开关 + 路由列表，约束成员实际路由） | ✓ | — |

规则细节：

- 自动模式下，**白名单约束成员的实际路由**：显式传入的 provider/model 必须在名单内；只传 `reasoning_effort`、或不传参数继承 Lead 路由时，解析出的实际路由也必须在名单内，否则拒绝创建并提示可用的路由。
- 父路由未知（无法与白名单比对）时，受限模式下也拒绝继承，要求显式传白名单内的路由。
- 自动模式下，显式传入 provider/model 但未给 effort 时，不继承 Lead 的思考等级，交给该模型解析默认值。
- 固定模式不使用白名单；固定路由由管理员直接配置，只校验提供方/模型是否存在。
- 路由在创建成员前通过 LLM 运行时（`resolveCallConfig`）校验。

## 提供的能力

| 工具 | 变化 |
|---|---|
| `spawn_teammate` | 新增可选参数 `provider`、`model`、`reasoning_effort`，仅自动模式可用；只影响新成员，Lead 自己的会话路由不变 |
| `list_team_models` | 新增：无参数列 provider，传 `provider` 列模型，传 `provider`+`model` 列推理强度 |
| `list_agents` | 每行新增 `llm` 字段，报告该成员实际使用的 provider / model / reasoningEffort |
| 其余 Team 工具 | 与官方版本一致（`send_message`、`wait_agent`、`interrupt_agent`、`team_task_*`） |

## 设置页

安装后打开 **设置（Settings）→ Agent Teams 模型**（导航项 id `agent-team-models`，位置在 Agent Presets 之后）。

| 控件 | 字段 | 显示条件 |
|---|---|---|
| 路由模式：自动 / 固定路由 | `modelSelection.mode` | 始终 |
| 提供方 / 模型 / 思考等级 | `provider` / `model` / `reasoningEffort` | 固定路由模式 |
| 限制成员可用的路由 + 路由清单 | `allowedModels` | 自动模式 |

页面行为：只读部署禁用控件；开启“限制”但未勾选任何路由时，保存保持禁用并在开关下方直接提示；保存失败保留草稿并提示；其他页面抢先修改过设置时提示冲突；思考等级按所选模型动态列出；已保存但当前不可用的路由仍可移除；关闭“限制”会保留现有草稿（不写入空列表）。

也可以直接改 **profile 的 `cordis.patch.yml`**（`config` 整体替换，需写全字段）：

```yaml
- id: tool-agent-team-model-selection
  name: dsh-agent-team-model-selection
  config:
    interrupt: true
    freshProvider: spawn
    forkProvider: fork
    modelSelection:
      mode: inherit                    # inherit（自动）| fixed（固定路由）
      provider: magpie-anthropic       # 仅 fixed 使用
      model: zcode/GLM-5.3-Flash       # 仅 fixed 使用
      reasoningEffort: high            # 仅 fixed 使用；留空 = 模型默认
      allowedModels:                   # 仅 inherit 使用；空数组 = 不限制
        - provider: magpie-anthropic
          model: zcode/GLM-5.3-Flash
```

旧的 `allowModelOverride` 字段不再使用（旧配置里出现会被忽略，设置页也不再显示）。

## 安装与验证

### 从 GitHub 安装（推荐）

```js
plugin_manager({ action: "install_bundle", target: "devloom1024/dsh-agent-team-model-selection" })
```

`target` 使用 pnpm/GitHub 的 `owner/repo` 简写；需要固定提交或分支时可传完整 GitHub URL。

### 从本地 checkout 安装

```js
plugin_manager({ action: "install_bundle", target: "<本目录绝对路径>" })
```

安装后用 `cordis_inspect_query` 或下一轮工具列表确认 `spawn_teammate` 出现新参数、`list_team_models` 存在；在设置页确认两种模式的菜单不同并可保存；再让 Lead 创建成员，观察返回的 `llm` 字段及成员 session 的 `request/header` 中 `config.provider`/`config.model`。

插件同时声明 host 与 client 两半。首次安装后如果设置页没有出现，刷新一次页面；极端情况下（同一 Host 进程中先安装过没有 `dsh.client` 的旧版本）重启一次 DSH 应用。

### 本机验证记录（v0.7.0）

| 场景 | 结果 |
|---|---|
| 自动模式 + 显式路由 `magpie-anthropic` / `zcode/GLM-5.3-Flash` / `high` | 成员返回 `model` 与 `llm` 均为该路由；session `request/header.config` = `{"provider":"magpie-anthropic","model":"zcode/GLM-5.3-Flash","reasoningEffort":"high"}` |
| 设置写入：自动 → 固定路由 | `settings.describe()` 与运行中策略同步变为 `fixed`；无需重启 |
| 固定路由模式 + 不传参数 | 成员使用配置路由，session header 与配置一致 |
| 固定路由模式 + 传 `provider`/`model` | 工具报错：`fixed-route mode does not accept spawn route parameters` |
| 设置写入：固定路由 → 自动 | describe 与运行中策略恢复 `inherit`；profile 补丁无残留覆盖行 |
| 自动模式 + 开启白名单 + 不传参数、Lead 路由不在名单 | 工具报错（`the inherited Lead route ... is not allowed`），不会创建成员 |
| 自动模式 + 开启白名单 + 只传 `reasoning_effort`、继承路由不在名单 | 工具报错（`cannot apply reasoning_effort ...`） |
| 设置页 | Client `settings.section` occupants 含 `agent-team-models`（order 25，active）；两种模式字段互补；开启限制但未勾选路由时开关下方直接提示 |
| 行 Config schema | 五个字段带 `x-cordis.volatile`，构成设置表单 |
| 单元测试 / 页面离线渲染 | 16 个单元测试通过；页面 harness 验证自动模式白名单校验、固定模式字段切换与保存生成的 4 条 volatile 字段写入 |

未做视觉验证：桌面 GUI 的浏览器会话需要应用启动时打印的鉴权 URL，按验证规范未获取/复用该凭据，因此没有截图；页面以 Client Slot 注册与离线渲染为准。

## 仓库结构

| 路径 | 用途 |
|---|---|
| `index.js` | Host 半：Team 工具注册、路由策略、`startActivation` 激活接缝 |
| `client.js` | 浏览器半：**设置 → Agent Teams 模型** 页面 |
| `lib/model-selection.js` | 纯路由策略与模型目录格式化 |
| `lib/tool.js` | 无依赖的工具定义与参数校验 |
| `lib/vendor/` | 内置 `schemastery` / `cosmokit`（MIT，见 `THIRD_PARTY_NOTICES.md`） |
| `cordis.patch.yml` | Bundle patch：停用官方 `tool-agent-team` 行并插入本插件行 |
| `test/` | `node:test` 单元测试 |
| `.github/workflows/test.yml` | GitHub Actions：Node 22 / 24 跑单元测试 |
| `CHANGELOG.md` | 版本变更记录 |
| `CONTRIBUTING.md` | 开发、测试与安装说明 |
| `THIRD_PARTY_NOTICES.md` | 第三方代码归属与许可证 |

## 许可证与第三方

本项目使用 MIT 许可证，见 [LICENSE](LICENSE)。

内置的 `schemastery` 与 `cosmokit` 同为 MIT（Copyright (c) 2021-present Shigma），许可证副本位于 `lib/vendor/LICENSE.*`，来源、版本与改动说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 实现说明与限制

- 官方 `agentTeam.spawnTeammate` 不向子智能体运行时传递每成员路由。插件在 `ctx.subagents.startActivation` 这一创建接缝上合并本次 spawn 的 `agentOptions`（值走 `AsyncLocalStorage` 随创建调用传递），等价于在 Team 域里补上 `request.agentOptions`。
- 该 seam 对“插件热重载后残留旧钩子”做了防护：路由存储挂在 `globalThis` 的稳定符号上，所有模块代际共用；重装时会识别并替换旧代际的钩子，避免出现“换路由静默失效”。插件卸载时恢复原始 `startActivation`。
- 设置页依赖 Host 设置命名空间：行必须导出带 volatile 字段的 `Config`。插件内置 `lib/vendor/schemastery.js` 与 `lib/vendor/cosmokit.js`（MIT，见同目录 LICENSE 文件），`~standard` 与 volatile ref 协议与宿主共享，因此设置写入可热更新运行中的配置，无需重启或重载插件。
- 成员重启后的路由恢复依赖其 session 的 `request/header` 记录；首次请求前主机重启的成员不保证保留路由。
- 官方包升级后如果 `spawnTeammate` 原生支持路由，应优先使用原生能力，并移除此插件。
- 若插件激活失败，`plugin_manager` 会报告行状态；可用 `remove_bundle` 移除以恢复官方 Team 工具行。
