# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start development server
- `npm run lib` - Build library (runs lint, type check, and builds library)
- `npm run build` - Build app (runs lint, type check, and builds app)
- `npm run lint` - Run ESLint
- `npm run type:check` - Run TypeScript type checking without emitting
- `npm run cypress:open` - Open Cypress test runner GUI
- `npm run cypress:run` - Run Cypress tests headlessly
- `npm run docs:dev` - Start VitePress documentation server
- `npm run docs:build` - Build VitePress documentation
- `npm run release` - Run release script

To run a single Cypress test file: `npx cypress run --spec cypress/e2e/<test-file>.cy.ts`

## Git Hooks

Pre-commit hooks run `npm run lint` and `npm run type:check`. Commit message must follow Conventional Commits format: `feat:`, `fix:`, `docs:`, `refactor:`, etc.

## Architecture Overview

This is a canvas-based rich text editor built with TypeScript. The core architecture follows a modular, layered design:

### Core Components

**Editor Class** (`src/editor/index.ts`)
- Main entry point that orchestrates all subsystems
- Exposes public API via the `command` property (e.g., `editor.command.executeBold()`)
- Manages lifecycle through `destroy()` method

**Draw Class** (`src/editor/core/draw/Draw.ts`)
- Central rendering engine (~96KB) responsible for canvas drawing
- Manages pages, rows, elements, and cursor rendering
- Coordinates all particle types and frame elements

**Command Pattern** (`src/editor/core/command/`)
- `Command.ts`: Facade exposing all execute methods (e.g., `executeBold`, `executeUndo`)
- `CommandAdapt.ts`: Adapter that bridges commands to Draw context
- All commands follow `execute*` naming convention

### Element System

The editor uses a hierarchical element model defined in `src/editor/interface/Element.ts`:

**IElement** - Base interface for all content elements with:
- Basic properties: `id`, `type`, `value`, `extension`, `externalId`
- Style: `font`, `size`, `bold`, `color`, etc. (IElementStyle)
- Rules: `hide` (IElementRule)
- Groups: `groupIds` (IElementGroup)

**Element Types** (ElementType enum):
- Text particles: TextParticle, ListParticle, HyperlinkParticle, etc.
- Block particles: ImageParticle, TableParticle, LaTexParticle, etc.
- Control particles: CheckboxParticle, RadioParticle, etc.
- Frame elements: Margin, Background, PageNumber, etc.

### Directory Structure

```
src/editor/
├── core/
│   ├── draw/           # Rendering engine
│   │   ├── particle/    # Element rendering (text, image, table, latex, etc.)
│   │   ├── control/    # Control component rendering
│   │   ├── frame/       # Frame elements (margin, background, borders)
│   │   ├── richtext/    # Rich text decorations (underline, highlight)
│   │   └── interactive/ # Interactive features (search, graffiti)
│   ├── command/         # Command pattern implementation
│   ├── event/          # Canvas and global event handling
│   ├── observer/        # Mouse, selection, image observers
│   ├── worker/          # Web workers for async operations
│   └── [other subsystems]
├── interface/           # TypeScript interfaces (40+ files)
├── dataset/            # Enums and constants
└── utils/               # Utility functions
```

### Web Workers

Async operations use Web Workers managed by `WorkerManager.ts`:
- WordCountWorker - Count words in element list
- CatalogWorker - Generate document catalog/TOC
- GroupWorker - Extract group IDs from elements
- ValueWorker - Get document value asynchronously

### Event System

**EventBus** (`src/editor/core/event/eventbus/`) - Pub/sub system for editor events
**Listener** (`src/editor/core/listener/`) - Callback system for change notifications
**CanvasEvent** and **GlobalEvent** - Handle mouse, keyboard, and drag events

### Plugin System

Plugins extend functionality through `editor.use(plugin)` pattern. See `src/editor/core/plugin/Plugin.ts`.

## Key Patterns

**Command-Draw Separation**: Commands access Draw functionality through CommandAdapt, not directly. This prevents exposing internal Draw context to external consumers.

**Element Formatting**: Elements are formatted via `formatElementList()` utility which applies defaults and compensates missing properties.

**Zone-Based Layout**: Documents support header/main/footer zones managed through the Zone system.

**Position-Range Model**: Cursor positions and selections are tracked through Position and RangeManager classes.

**History Management**: Undo/redo functionality via HistoryManager with command history stack.

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文 review 沟通参考——话术模板、分级标注（必须修复/建议修改/仅供参考）、国内团队常见反模式应对。仅在用户显式 /chinese-code-review 时调用，不要根据上下文自动触发。
- **chinese-commit-conventions**: 中文 commit 与 changelog 配置参考——Conventional Commits 中文适配、commitlint/husky/commitizen 中文模板、conventional-changelog 中文配置。仅在用户显式 /chinese-commit-conventions 时调用，不要根据上下文自动触发。
- **chinese-documentation**: 中文文档排版参考——中英文空格、全半角标点、术语保留、链接格式、中文文案排版指北约定。仅在用户显式 /chinese-documentation 时调用，不要根据上下文自动触发。
- **chinese-git-workflow**: 国内 Git 平台配置参考——Gitee、Coding.net、极狐 GitLab、CNB 的 SSH/HTTPS/凭据/CI 接入差异与镜像同步配置。仅在用户显式 /chinese-git-workflow 时调用，不要根据上下文自动触发。
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发，或在执行实现计划之前使用——通过原生工具或 git worktree 回退机制确保隔离工作区存在
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->
