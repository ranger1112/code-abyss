# forge-soul — 向导式 Persona / Output Style 创建工具

## 概述

`forge-soul` 是一个 `user-invocable: true` 的 scripted skill，通过向导式对话指导用户创建自定义 Persona 与 Output Style。用户在自然语言描述与直接提供内容之间自由选择，AI 负责格式化，脚本负责校验与写盘。

## 核心流程

```
/forge-soul
  → [1] 创建范围（Persona+Style / 只 Persona / 只 Style）
  → [2] 内容来源（自然语言描述 / 直接提供）
  → [3] 输出位置（项目目录 / ~/.claude/）
  → [4] 预览 → 确认 → 写入 → 收口
```

## 职责划分

| 层 | 负责 | 文件 |
|----|------|------|
| AI 驱动层 | 向导对话、NL 格式化、预览展示 | `SKILL.md` |
| 确定性层 | 格式校验、查重 slug、写文件、更新 index.json | `scripts/forge-soul.js` |

## 脚本子命令

```bash
node scripts/forge-soul.js list personas          # 列出已有 Persona
node scripts/forge-soul.js list styles            # 列出已有 Style
node scripts/forge-soul.js validate persona <file> # 校验 Persona 格式
node scripts/forge-soul.js validate style <file>  # 校验 Style 格式
node scripts/forge-soul.js write persona <slug> <file> [--gender m|f] [--project-root /path]
node scripts/forge-soul.js write style <slug> <file> [--targets a,b] [--project-root /path]
```

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

## index.json 更新

- 新条目 `default: false`（不可设置为默认）
- Style 默认 targets 全平台 `["claude", "codex", "gemini", "openclaw"]`，用户可裁剪
- Persona 询问 gender（male/female）

## 文件结构

```
skills/tools/forge-soul/
├── SKILL.md
└── scripts/
    └── forge-soul.js

test/
└── forge-soul.test.js
```

## 测试

只测脚本确定性行为：list、validate 合法/非法、write 正确路径与 index.json 更新、slug 重复。

## 实现步骤

1. 创建 `SKILL.md` → `npm run verify:skills`
2. 实现 `forge-soul.js`（list / validate）
3. 实现 `write` 子命令
4. 写 `test/forge-soul.test.js`
5. 端到端验证
