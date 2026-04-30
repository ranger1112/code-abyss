# soul — 人格与输出风格全生命周期管理

## 概述

`soul` 是 `user-invocable: true` 的 scripted skill，统一管理 Persona 与 Output Style 的查看、创建、删除、切换。合并原 `forge-soul`（创建）与未实现的 `soul-swap`（切换）两个 skill 的能力。

## 核心流程

```
/soul
  → [1] 操作：查看 / 创建 / 切换 / 删除
  → [2] 对象：人格 / 风格 / 两者
  → [3] 分支执行
```

## 职责划分

| 层 | 负责 | 文件 |
|----|------|------|
| AI 驱动层 | 向导对话、NL 格式化、预览展示 | `SKILL.md` |
| 确定性层 | 格式校验、索引操作、运行时文件改写 | `scripts/soul.js` |

## 脚本子命令

```bash
node scripts/soul.js list personas [--project-root <path>]
node scripts/soul.js list styles [--project-root <path>]
node scripts/soul.js current [--target <name>] [--global]
node scripts/soul.js validate persona <file>
node scripts/soul.js validate style <file>
node scripts/soul.js create persona <slug> <file> [--gender m|f] [--project-root <path>]
node scripts/soul.js create style <slug> <file> [--targets a,b] [--project-root <path>]
node scripts/soul.js apply persona <slug> [--global] [--targets a,b]
node scripts/soul.js apply style <slug> [--global] [--targets a,b]
node scripts/soul.js remove persona <slug> [--project-root <path>]
node scripts/soul.js remove style <slug> [--project-root <path>]
```

## 各子命令逻辑

### list

1. 读 index.json
2. 标注 `[默认]`、`[当前全局]`（读 `~/.claude/settings.json` 比对）
3. JSON 数组输出

### current

1. 项目级：读 index.json 找 `default: true`
2. 全局：读 `~/.claude/settings.json` 的 `outputStyle` 和 `CLAUDE.md` 反查 persona
3. 按 target 分别输出

### apply — 项目级

1. 校验 slug 存在
2. 目标条目 `default` → `true`，其余 `false`
3. 原子写入 index.json
4. 提示需重装生效

### apply — 全局

1. 校验 slug 存在
2. Persona：从项目读 `.md` → 覆写 `~/.claude/CLAUDE.md` 等
3. Style：更新 `~/.claude/settings.json` 的 `outputStyle`
4. 已有 Codex/Gemini/OpenClaw 目录则同步更新

### remove

1. 读 index.json
2. 拒绝 `builtin: true` 的条目
3. 拒绝唯一的 default 条目
4. 从数组移除，原子写入 index.json，保留 .md 文件

## builtin 保护

| 条目来源 | `builtin` | 可删？ |
|----------|-----------|--------|
| 系统预置 | `true` | 否 |
| 用户创建 | `false` 或无此字段 | 是 |

现有 index.json 补上 `"builtin": true`。

## Persona 校验规则

| # | 规则 |
|---|------|
| 1 | 首行 `# {名号} · {代号} v{版本}` |
| 2 | 含 `**自称**：` `**称呼用户**：` `**语言**：` 三要素 |
| 3 | 至少包含「运行时内核」「铁律」板块 |
| 4 | slug 为 kebab-case，文件 `.md` 结尾 |

## Output Style 校验规则

| # | 规则 |
|---|------|
| 1 | 标题 `# {中文名} · 输出之道` |
| 2 | 至少包含「输出骨架」板块 |
| 3 | slug kebab-case，与已有不重复 |

## 文件结构

```
skills/tools/soul/
├── SKILL.md
└── scripts/
    └── soul.js

test/
└── soul.test.js
```

## 测试

仅测脚本确定性行为，~50 用例：

| Suite | 内容 |
|-------|------|
| validate | Persona/Style 校验 |
| list | 列出+标记 default+builtin |
| current | 当前激活检测 |
| apply 项目级 | 改 index.json default、拒绝无效 slug |
| apply 全局 | 写 settings.json / CLAUDE.md |
| remove | 删条目、拒绝 builtin、拒绝唯一 default |
| CLI 错误 | 无参、缺文件、非法命令 |

## 实现步骤

1. 改现有 index.json 补 `builtin: true`
2. 删除 `skills/tools/forge-soul/` 目录
3. 创建 `skills/tools/soul/SKILL.md`
4. 实现 `soul.js`（validate + list + current + create + apply + remove）
5. 写 `test/soul.test.js`
6. 更新 `test/install-smoke.test.js`、`test/install-generation.test.js`、`test/install-registry.test.js` 的 `forge-soul` → `soul` 引用
7. `npm run verify:skills` + `npm test` 全绿
