---
name: forge-soul
description: 灵魂锻造台。向导式创建自定义 Persona 与 Output Style，支持自然语言描述。
license: MIT
compatibility: node>=18
user-invocable: true
allowed-tools: Bash, Read, Write, Glob
argument-hint: <sub-command> [...]
aliases: fs, soulforge
---

# 灵魂锻造台

> 向导式创建自定义 Persona 与 Output Style —— Claude 逐步交互询问，最后调用脚本执行写盘与索引注册。

## 命令

```bash
node scripts/forge-soul.js list personas [--project-root <path>]
node scripts/forge-soul.js list styles [--project-root <path>]
node scripts/forge-soul.js validate persona <file>
node scripts/forge-soul.js validate style <file>
node scripts/forge-soul.js write persona <slug> <file> [--gender <male|female>] [--project-root <path>]
node scripts/forge-soul.js write style <slug> <file> [--targets <csv>] [--project-root <path>]
```

## 向导流程

Claude 在 `/forge-soul` 被调用时按如下步骤交互：

1. **询问创建范围**：同时创建 Persona + Output Style？还是只创建其中一个（另一个选用已有的）？
2. **询问内容来源**：用户用自然语言描述（Claude 格式化为项目格式），还是直接提供已写好的 `.md` 文件（仅做校验）？
3. **收集描述 → 生成**：若用户用自然语言，Claude 根据描述生成符合格式的 Persona / Style 内容并展示预览。
4. **询问部署位置**：写入项目目录（`config/personas/` + `output-styles/`），还是全局 `~/.claude/` 目录？
5. **确认元数据**：确认 slug、gender（Persona）、targets（Style）等信息。
6. **调用脚本写入**：调用 `forge-soul.js write` 子命令完成写盘与索引注册。

若用户选择已有 Persona 或 Style，需先调用 `forge-soul.js list` 列出可选项供用户挑选。

## 校验规则

### Persona

| 规则 | 模式 |
|------|------|
| 标题格式 `# {名号} · {代号} v{版本}` | `/^# .+ · .+ v\d+\.\d+/` |
| 元数据行含自称、称呼用户、语言 | `/自称.*称呼用户.*语言/s` |
| 运行时内核章节 | `/##\s+.*运行时内核/` |
| 铁律章节 | `/##\s+.*铁律/` |

### Output Style

| 规则 | 模式 |
|------|------|
| 标题以 `· 输出之道` 结尾 | `/· 输出之道\s*$/` |
| 输出骨架章节 | `/##\s+.*输出骨架/` |

## 触发条件

用户显式调用 `/forge-soul` | 提到想创建新的人格/风格/Persona/Style | 想要自定义 Agent 性格或输出风格
