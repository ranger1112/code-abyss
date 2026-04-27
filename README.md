# Code Abyss

<div align="center">

*Persona-driven configuration system for Claude Code, Codex CLI, and Gemini CLI*

*为 Claude Code / Codex CLI / Gemini CLI 打造的人格驱动配置系统*

[![npm](https://img.shields.io/npm/v/code-abyss.svg)](https://www.npmjs.com/package/code-abyss)
[![CI](https://github.com/telagod/code-abyss/actions/workflows/ci.yml/badge.svg)](https://github.com/telagod/code-abyss/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-blue.svg)]()
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)]()

[English](#quick-start) | [中文](#快速开始)

</div>

Code Abyss installs a switchable persona + output style + engineering skill system into your AI coding CLI. One command configures persona rules, output styles, 21 domain skills, 6 slash commands, and 5 verification tools across Claude Code, Codex CLI, and Gemini CLI.

Code Abyss 为你的 AI 编程 CLI 注入可切换的人格 + 输出风格 + 工程技能体系。一条命令即可配置人格规则、输出风格、21 个领域技能、6 个斜杠命令和 5 个校验工具，覆盖 Claude Code、Codex CLI 和 Gemini CLI 三端。

## Quick Start

```bash
npx code-abyss                          # Interactive menu
npx code-abyss --target claude -y       # One-line install to ~/.claude/
npx code-abyss --target codex -y        # One-line install to ~/.codex/
npx code-abyss --target gemini -y       # One-line install to ~/.gemini/
```

## What It Does

Code Abyss is a three-layer configuration system:

| Layer | What | Where |
|-------|------|-------|
| Persona | Character identity, rules, execution chains | `config/personas/*.md` + `config/CLAUDE.md` |
| Output Style | Tone, formatting, response structure | `output-styles/*.md` + `index.json` |
| Skills | Domain knowledge + executable verification tools | `skills/**/*.md` + `scripts/*.js` |

The installer generates target-specific artifacts for each CLI:

| Target | Config | Skills | Style |
|--------|--------|--------|-------|
| Claude | `~/.claude/CLAUDE.md` + `settings.json` | `~/.claude/commands/*.md` + `~/.claude/skills/` | `settings.json.outputStyle` |
| Codex | `~/.codex/config.toml` + `AGENTS.md` | `~/.codex/skills/` + `~/.agents/skills/gstack/` | `~/.codex/AGENTS.md` |
| Gemini | `~/.gemini/GEMINI.md` + `settings.json` | `~/.gemini/commands/*.toml` + `~/.gemini/skills/` | `GEMINI.md` |

## Personas

5 switchable personas, each with a distinct character and interaction style:

| Slug | Name | Style |
|------|------|-------|
| `abyss` (default) | 邪修红尘仙 | Direct, security-first, no-nonsense |
| `scholar` | 文言小生 | Classical, methodical, scholarly |
| `elder-sister` | 知性大姐姐 | Warm, insightful, guiding |
| `junior-sister` | 古怪精灵小师妹 | Playful, sharp, energetic |
| `iron-dad` | 铁壁暖阳 | Firm, protective, structured |

Switch persona during install:

```bash
npx code-abyss --target claude --persona elder-sister -y
```

## Output Styles

5 output styles control tone and response formatting:

| Slug | Name | Best For |
|------|------|----------|
| `abyss-cultivator` (default) | 宿命深渊 | Immersive, high-tension delivery |
| `scholar-classic` | 墨渊书阁 | Formal, structured analysis |
| `elder-sister-gentle` | 星霜雅筑 | Gentle, step-by-step guidance |
| `junior-sister-spark` | 灵犀洞天 | Fast-paced, playful interaction |
| `iron-dad-warm` | 钢铁柔情 | Decisive, warm mentoring |

Switch style during install:

```bash
npx code-abyss --target claude --style scholar-classic -y
npx code-abyss --list-styles    # List all available styles
```

## Skills

21 skills across 14 domains, driven by `SKILL.md` frontmatter as single source of truth.

### Slash Commands (user-invocable)

| Command | Function |
|---------|----------|
| `/verify-security` | Scan code for security vulnerabilities and dangerous patterns |
| `/verify-module` | Check directory structure and documentation completeness |
| `/verify-change` | Analyze git changes, detect doc sync issues |
| `/verify-quality` | Detect complexity, naming, code quality issues |
| `/gen-docs` | Generate README.md and DESIGN.md scaffolds |
| `/frontend-design` | UI aesthetics, component patterns, UX guidance |

### Domain Knowledge (auto-loaded by context)

| Domain | Coverage |
|--------|----------|
| Security | Penetration testing, code audit, defense engineering, threat intelligence, vulnerability research |
| Architecture | API design, cloud-native, security architecture, messaging, caching |
| Development | Python, TypeScript, Go, Rust, Java, C++, Shell |
| DevOps | Git workflow, testing, database, observability, performance, cost optimization |
| Frontend | Component patterns, state management, UI aesthetics, 4 design system variants |
| Mobile | iOS/SwiftUI, Android/Compose, React Native, Flutter |
| AI | Agent development, LLM security, RAG systems, prompt engineering |
| Data Engineering | Pipeline orchestration, stream processing, data quality |
| Infrastructure | Kubernetes, GitOps, IaC (Terraform/Pulumi/CDK) |
| Orchestration | Multi-agent task decomposition and parallel coordination |

## Install Layout

```
~/.claude/                          ~/.codex/
├── CLAUDE.md        (persona)      ├── AGENTS.md       (persona + style)
├── output-styles/   (style files)  ├── instruction.md   (core instructions)
├── commands/*.md    (slash cmds)   ├── skills/          (domain skills)
├── skills/          (domain skills)├── bin/lib/          (runtime libs)
├── bin/lib/         (runtime libs) ├── config.toml      (recommended config)
├── settings.json    (config)       └── .sage-uninstall.js
└── .sage-uninstall.js
                                    ~/.agents/
~/.gemini/                          └── skills/gstack/   (gstack pack)
├── GEMINI.md        (persona + style)
├── commands/*.toml  (commands)
├── skills/          (domain skills)
├── settings.json    (config)
└── .sage-uninstall.js
```

All installed files are tracked in `.sage-backup/manifest.json`. Uninstall restores previous state.

## CLI Reference

```bash
# Install
npx code-abyss --target <claude|codex|gemini> [-y]
npx code-abyss --target claude --style <slug> --persona <slug> -y

# Uninstall
npx code-abyss --uninstall <claude|codex|gemini>

# Info
npx code-abyss --list-styles
npx code-abyss --help

# Verification tools (run directly)
node skills/tools/verify-security/scripts/security_scanner.js <path>
node skills/tools/verify-module/scripts/module_scanner.js <path>
node skills/tools/verify-change/scripts/change_analyzer.js --mode staged
node skills/tools/verify-quality/scripts/quality_checker.js <path>
node skills/tools/gen-docs/scripts/doc_generator.js <path>
```

## Pack System

Code Abyss supports installable packs for extending functionality per target CLI.

- `packs/abyss/manifest.json` — core pack: persona, styles, skills, runtime libs
- `packs/gstack/manifest.json` — pinned upstream gstack runtime (auto-installed for Codex)
- `.code-abyss/packs.lock.json` — project-level pack declarations with `required`/`optional`/`sources`

Pack management:

```bash
node bin/packs.js bootstrap              # Initialize packs.lock
node bin/packs.js bootstrap --apply-docs # Write pack docs into README/CONTRIBUTING
node bin/packs.js diff                   # Show lock vs template drift
node bin/packs.js vendor-pull <pack>     # Pull upstream into .code-abyss/vendor/
node bin/packs.js vendor-sync --check    # CI gate: verify vendor integrity
node bin/packs.js report summary         # View install reports
node bin/packs.js uninstall <pack>       # Remove pack artifacts
```

## Skill Registry

`skills/**/SKILL.md` frontmatter is the single source of truth. The shared registry (`bin/lib/skill-registry.js`) normalizes metadata and feeds it to the installer and runtime.

Required frontmatter:

```yaml
---
name: verify-quality          # kebab-case, unique
description: Code quality gate
user-invocable: true           # false = knowledge-only
allowed-tools: Bash, Read, Glob  # optional, default: Read
argument-hint: <path>          # optional
---
```

Generation chain:

1. Registry scans and validates all `skills/**/SKILL.md`
2. Filters `user-invocable: true` for command generation
3. Claude: renders `~/.claude/commands/*.md`
4. Codex: installs to `~/.codex/skills/`, discovered directly
5. Gemini: renders `~/.gemini/commands/*.toml`
6. Scripted skills execute via `skills/run_skill.js` (lock + spawn + exit code passthrough)
7. Knowledge skills load `SKILL.md` content directly

## Development

```bash
npm test                          # Jest test suite (218 tests)
npm run verify:skills             # Validate SKILL.md frontmatter contracts
node bin/install.js --help        # Installer CLI help
```

CI runs on Node 18/20/22 across Linux, macOS, and Windows:

- Unit tests + skill contract validation
- 4 verification tools (security, module, quality, change)
- Smoke install/uninstall for all 3 targets on all 3 platforms

## Uninstall

```bash
npx code-abyss --uninstall claude
npx code-abyss --uninstall codex
npx code-abyss --uninstall gemini
```

Backup script alternative:

```bash
node ~/.claude/.sage-uninstall.js
node ~/.codex/.sage-uninstall.js
node ~/.gemini/.sage-uninstall.js
```

Restores backed-up configuration and removes all installed files.

## License

[MIT](LICENSE)

---

## 快速开始

```bash
npx code-abyss                          # 交互式菜单
npx code-abyss --target claude -y       # 一键安装到 ~/.claude/
npx code-abyss --target codex -y        # 一键安装到 ~/.codex/
npx code-abyss --target gemini -y       # 一键安装到 ~/.gemini/
```

## 功能概述

Code Abyss 是一个三层配置系统：

| 层级 | 内容 | 位置 |
|------|------|------|
| 人格 | 角色身份、规则、执行链 | `config/personas/*.md` + `config/CLAUDE.md` |
| 输出风格 | 语气、格式、回复结构 | `output-styles/*.md` + `index.json` |
| 技能 | 领域知识 + 可执行校验工具 | `skills/**/*.md` + `scripts/*.js` |

安装器为每个 CLI 生成对应的产物：

| 目标 | 配置 | 技能 | 风格 |
|------|------|------|------|
| Claude | `~/.claude/CLAUDE.md` + `settings.json` | `~/.claude/commands/*.md` + `~/.claude/skills/` | `settings.json.outputStyle` |
| Codex | `~/.codex/config.toml` + `AGENTS.md` | `~/.codex/skills/` + `~/.agents/skills/gstack/` | `~/.codex/AGENTS.md` |
| Gemini | `~/.gemini/GEMINI.md` + `settings.json` | `~/.gemini/commands/*.toml` + `~/.gemini/skills/` | `GEMINI.md` |

## 人格系统

5 个可切换人格，各有独特的性格和交互风格：

| 标识 | 名称 | 风格特点 |
|------|------|----------|
| `abyss`（默认） | 邪修红尘仙 | 直接、安全优先、不废话 |
| `scholar` | 文言小生 | 古典、严谨、学者气质 |
| `elder-sister` | 知性大姐姐 | 温柔、洞察、引导式 |
| `junior-sister` | 古怪精灵小师妹 | 活泼、敏锐、跳脱 |
| `iron-dad` | 铁壁暖阳 | 果断、温暖、结构化 |

安装时切换人格：

```bash
npx code-abyss --target claude --persona elder-sister -y
```

## 输出风格

5 个输出风格控制语气和回复格式：

| 标识 | 名称 | 适用场景 |
|------|------|----------|
| `abyss-cultivator`（默认） | 宿命深渊 | 沉浸式、高张力输出 |
| `scholar-classic` | 墨渊书阁 | 正式、结构化分析 |
| `elder-sister-gentle` | 星霜雅筑 | 温柔、循序渐进引导 |
| `junior-sister-spark` | 灵犀洞天 | 快节奏、活泼互动 |
| `iron-dad-warm` | 钢铁柔情 | 果断、温暖指导 |

安装时切换风格：

```bash
npx code-abyss --target claude --style scholar-classic -y
npx code-abyss --list-styles    # 列出所有可用风格
```

## 技能体系

21 个技能覆盖 14 个领域，以 `SKILL.md` frontmatter 为单一事实源。

### 斜杠命令（可直接调用）

| 命令 | 功能 |
|------|------|
| `/verify-security` | 扫描代码安全漏洞和危险模式 |
| `/verify-module` | 检查目录结构和文档完整性 |
| `/verify-change` | 分析 Git 变更，检测文档同步问题 |
| `/verify-quality` | 检测复杂度、命名、代码质量问题 |
| `/gen-docs` | 自动生成 README.md 和 DESIGN.md 骨架 |
| `/frontend-design` | UI 美学、组件模式、UX 指导 |

### 领域知识（按上下文自动加载）

| 领域 | 覆盖范围 |
|------|----------|
| 安全 | 渗透测试、代码审计、防御工程、威胁情报、漏洞研究 |
| 架构 | API 设计、云原生、安全架构、消息队列、缓存策略 |
| 开发 | Python、TypeScript、Go、Rust、Java、C++、Shell |
| DevOps | Git 工作流、测试、数据库、可观测性、性能、成本优化 |
| 前端 | 组件模式、状态管理、UI 美学、4 种设计系统变体 |
| 移动端 | iOS/SwiftUI、Android/Compose、React Native、Flutter |
| AI | Agent 开发、LLM 安全、RAG 系统、Prompt 工程 |
| 数据工程 | 管道编排、流处理、数据质量 |
| 基础设施 | Kubernetes、GitOps、IaC（Terraform/Pulumi/CDK） |
| 协同 | 多 Agent 任务分解与并行编排 |

## 命令参考

```bash
# 安装
npx code-abyss --target <claude|codex|gemini> [-y]
npx code-abyss --target claude --style <slug> --persona <slug> -y

# 卸载
npx code-abyss --uninstall <claude|codex|gemini>

# 查看
npx code-abyss --list-styles
npx code-abyss --help
```

## 卸载

```bash
npx code-abyss --uninstall claude
npx code-abyss --uninstall codex
npx code-abyss --uninstall gemini
```

自动恢复备份的配置，清理所有安装文件。

## 许可证

[MIT](LICENSE)
