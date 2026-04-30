---
name: soul
description: 灵魂殿。查看、创建、删除、切换自定义 Persona 与 Output Style，支持自然语言描述。
license: MIT
compatibility: node>=18
user-invocable: true
allowed-tools: Bash, Read, Write, Glob
argument-hint: <操作> [...]
aliases: persona, style
---

# 灵魂殿

> 人格与风格的完整生命周期管理 —— 查看、创建、切换、删除。

## 命令

```bash
node scripts/soul.js list personas [--project-root <path>]
node scripts/soul.js list styles [--project-root <path>]
node scripts/soul.js current [--target <name>] [--global]
node scripts/soul.js validate persona <file>
node scripts/soul.js validate style <file>
node scripts/soul.js create persona <slug> <file> [--gender <male|female>] [--project-root <path>]
node scripts/soul.js create style <slug> <file> [--targets <csv>] [--project-root <path>]
node scripts/soul.js apply persona <slug> [--global] [--targets <csv>]
node scripts/soul.js apply style <slug> [--global] [--targets <csv>]
node scripts/soul.js remove persona <slug> [--project-root <path>]
node scripts/soul.js remove style <slug> [--project-root <path>]
```

## 向导流程

Claude 在 `/soul` 被调用时按如下步骤交互：

1. **询问操作**：查看 / 创建 / 切换 / 删除？
2. **询问对象**：人格 / 风格 / 两者？
3. **分支执行**：
   - 查看 → 调 `soul.js list` 展示列表
   - 创建 → 同 forge-soul 向导（NL 描述 → 格式化 → 预览 → `create` 命令）
   - 切换 → 调 `soul.js list` 展示 → 用户选 → 问全局/项目 → `apply` 命令
   - 删除 → 调 `soul.js list` 展示（仅用户创建的非 builtin）→ 用户选 → `remove` 命令

若用户直接指定参数（如 `/soul switch persona gentle-mentor --global`），直接调对应命令，跳过向导。

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

用户显式调用 `/soul` | 提到想查看/创建/删除/切换人格或风格 | 提到 Persona / Style / 输出风格
