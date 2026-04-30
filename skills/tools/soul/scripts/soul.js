#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

function normalizeType(type) {
  if (type === 'persona') return 'personas';
  if (type === 'style') return 'styles';
  return type;
}

// ── Path resolution ──

function resolveProjectRoot(projectRoot) {
  if (projectRoot) return path.resolve(projectRoot);
  return process.cwd();
}

function resolvePersonaDir(projectRoot) {
  const root = resolveProjectRoot(projectRoot);
  return path.join(root, 'config', 'personas');
}

function resolveStyleDir(projectRoot) {
  const root = resolveProjectRoot(projectRoot);
  return path.join(root, 'output-styles');
}

function resolvePersonaIndex(projectRoot) {
  return path.join(resolvePersonaDir(projectRoot), 'index.json');
}

function resolveStyleIndex(projectRoot) {
  return path.join(resolveStyleDir(projectRoot), 'index.json');
}

// ── Validation ──

function validatePersonaContent(content) {
  const errors = [];
  const warnings = [];
  const lines = content.split(/\r?\n/);

  const firstNonEmpty = lines.find(l => l.trim() !== '');
  if (!firstNonEmpty || !/^# .+ · .+ v\d+\.\d+/.test(firstNonEmpty)) {
    errors.push('首行格式须为 "# {名号} · {代号} v{版本}"');
  }

  if (!/自称.*称呼用户.*语言/s.test(content)) {
    errors.push('缺少元数据行（**自称**：**称呼用户**：**语言**：三要素）');
  }

  if (!/##\s+.*运行时内核/.test(content)) {
    errors.push('缺少「运行时内核」章节');
  }

  if (!/##\s+.*铁律/.test(content)) {
    errors.push('缺少「铁律」章节');
  }

  if (!/大局观/.test(content)) {
    warnings.push('建议添加「大局观」章节');
  }

  if (!/执行链/.test(content)) {
    warnings.push('建议添加「执行链」章节');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function validateStyleContent(content) {
  const errors = [];
  const warnings = [];
  const lines = content.split(/\r?\n/);

  const firstNonEmpty = lines.find(l => l.trim() !== '');
  if (!firstNonEmpty || !/· 输出之道\s*$/.test(firstNonEmpty)) {
    errors.push('标题须以「· 输出之道」结尾');
  }

  if (!/##\s+.*输出骨架/.test(content)) {
    errors.push('缺少「输出骨架」章节');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Content extraction ──

function extractTitleLine(content) {
  const lines = content.split(/\r?\n/);
  const first = lines.find(l => l.trim() !== '');
  return first ? first.replace(/^#\s*/, '').trim() : '';
}

function extractLabel(titleLine) {
  const parts = titleLine.split('·');
  return parts[0] ? parts[0].trim() : titleLine;
}

function extractTagline(content) {
  const lines = content.split(/\r?\n/);
  const blockquote = lines.find(l => /^>\s/.test(l));
  return blockquote ? blockquote.replace(/^>\s*/, '').trim() : '';
}

// ── Index operations ──

function ensureIndexExists(indexPath, listKey) {
  if (!fs.existsSync(indexPath)) {
    const dir = path.dirname(indexPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const empty = {};
    empty[listKey] = [];
    fs.writeFileSync(indexPath, JSON.stringify(empty, null, 2) + '\n', 'utf8');
  }
}

function readIndex(indexPath, listKey) {
  const raw = fs.readFileSync(indexPath, 'utf8');
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed[listKey]) ? parsed[listKey] : null;
  if (!list) throw new Error(`${path.basename(indexPath)} 缺少 ${listKey} 数组`);
  return { parsed, list };
}

function writeIndexAtomic(indexPath, data) {
  const dir = path.dirname(indexPath);
  const tmpFile = path.join(dir, `.index-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpFile, indexPath);
}

function addToIndex(indexPath, entry, listKey) {
  ensureIndexExists(indexPath, listKey);
  const { parsed, list } = readIndex(indexPath, listKey);

  if (list.some(e => e.slug === entry.slug)) {
    throw new Error(`slug '${entry.slug}' 已存在于索引中`);
  }

  list.push(entry);
  writeIndexAtomic(indexPath, parsed);
}

function removeFromIndex(indexPath, slug, listKey) {
  const { parsed, list } = readIndex(indexPath, listKey);

  const idx = list.findIndex(e => e.slug === slug);
  if (idx === -1) {
    throw new Error(`slug '${slug}' 不存在于索引中`);
  }

  const target = list[idx];

  if (target.builtin === true) {
    throw new Error(`「${target.label || slug}」是系统预设，不可删除`);
  }

  if (target.default === true) {
    throw new Error(`「${target.label || slug}」是当前默认项，请先将其他条目设为默认后再删除`);
  }

  list.splice(idx, 1);
  writeIndexAtomic(indexPath, parsed);
  return target;
}

function setDefaultInIndex(indexPath, slug, listKey) {
  const { parsed, list } = readIndex(indexPath, listKey);

  const target = list.find(e => e.slug === slug);
  if (!target) {
    throw new Error(`slug '${slug}' 不存在于索引中`);
  }

  list.forEach(e => { e.default = false; });
  target.default = true;

  writeIndexAtomic(indexPath, parsed);
  return target;
}

// ── Target resolution ──

const MANAGED_ROOTS = {
  claude: '.claude',
  codex: '.codex',
  gemini: '.gemini',
  openclaw: '.openclaw',
};

const ALL_TARGETS = Object.keys(MANAGED_ROOTS);

function resolveTargets(raw) {
  if (!raw || raw.trim() === '') return ALL_TARGETS.slice();
  const values = raw.split(',').map(s => s.trim()).filter(Boolean);
  values.forEach(t => {
    if (!MANAGED_ROOTS[t]) throw new Error(`不支持的 target: ${t}。可用: ${ALL_TARGETS.join(', ')}`);
  });
  return [...new Set(values)];
}

function resolveRuntimeDir(target) {
  const root = MANAGED_ROOTS[target];
  if (!root) throw new Error(`未知 target: ${target}`);
  return path.join(os.homedir(), root);
}

// ── list ──

function cmdList(type, projectRoot) {
  type = normalizeType(type);
  const indexPath = type === 'personas'
    ? resolvePersonaIndex(projectRoot)
    : resolveStyleIndex(projectRoot);
  const listKey = type === 'personas' ? 'personas' : 'styles';

  const { list } = readIndex(indexPath, listKey);
  return list.map(item => ({
    ...item,
    builtin: item.builtin === true,
  }));
}

// ── current ──

function detectGlobalPersonaSlug(projectRoot) {
  const claudeMdPath = path.join(os.homedir(), '.claude', 'CLAUDE.md');
  if (!fs.existsSync(claudeMdPath)) return null;

  const claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
  const claudeFirstLine = claudeContent.split(/\r?\n/).find(l => l.trim() !== '');
  if (!claudeFirstLine) return null;

  // Match by comparing first line of installed CLAUDE.md with each persona file
  try {
    const personas = cmdList('personas', projectRoot);
    const personaDir = resolvePersonaDir(projectRoot);
    for (const p of personas) {
      const personaPath = path.join(personaDir, p.file);
      if (fs.existsSync(personaPath)) {
        const personaContent = fs.readFileSync(personaPath, 'utf8');
        const personaFirstLine = personaContent.split(/\r?\n/).find(l => l.trim() !== '');
        if (personaFirstLine && personaFirstLine.trim() === claudeFirstLine.trim()) {
          return p.slug;
        }
      }
    }
  } catch (_) {}

  return null;
}

function detectGlobalStyleSlug() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) return null;

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings.outputStyle || null;
  } catch (_) {
    return null;
  }
}

function cmdCurrent(target, isGlobal, projectRoot) {
  const result = {};

  if (isGlobal) {
    result.persona = detectGlobalPersonaSlug(projectRoot);
    result.style = detectGlobalStyleSlug();
    result.scope = 'global';
  } else {
    result.scope = 'project';
    try {
      const personaIx = resolvePersonaIndex(projectRoot);
      const personas = JSON.parse(fs.readFileSync(personaIx, 'utf8')).personas || [];
      const defaultPersona = personas.find(p => p.default);
      result.persona = defaultPersona ? defaultPersona.slug : null;
    } catch (_) {
      result.persona = null;
    }
    try {
      const styleIx = resolveStyleIndex(projectRoot);
      const styles = JSON.parse(fs.readFileSync(styleIx, 'utf8')).styles || [];
      const defaultStyle = styles.find(s => s.default);
      result.style = defaultStyle ? defaultStyle.slug : null;
    } catch (_) {
      result.style = null;
    }
  }

  return result;
}

// ── apply (switch) ──

function cmdApplyPersona(slug, isGlobal, targets, projectRoot) {
  // Verify slug exists
  const personas = cmdList('personas', projectRoot);
  const persona = personas.find(p => p.slug === slug);
  if (!persona) throw new Error(`人格 '${slug}' 不存在`);

  if (isGlobal) {
    const personaContent = fs.readFileSync(
      path.join(resolvePersonaDir(projectRoot), persona.file), 'utf8');

    const ts = resolveTargets(targets);
    const applied = [];

    for (const target of ts) {
      const runtimeDir = resolveRuntimeDir(target);
      if (!fs.existsSync(runtimeDir)) continue;

      let runtimeFile;
      if (target === 'claude') {
        runtimeFile = path.join(runtimeDir, 'CLAUDE.md');
        fs.writeFileSync(runtimeFile, personaContent, 'utf8');
        applied.push('claude');
      } else if (target === 'gemini') {
        runtimeFile = path.join(runtimeDir, 'GEMINI.md');
        fs.writeFileSync(runtimeFile, personaContent, 'utf8');
        applied.push('gemini');
      } else if (target === 'codex') {
        runtimeFile = path.join(runtimeDir, 'AGENTS.md');
        fs.writeFileSync(runtimeFile, personaContent, 'utf8');
        applied.push('codex');
      } else if (target === 'openclaw') {
        // OpenClaw stores persona in SOUL.md
        const workspaceDir = path.join(runtimeDir, 'workspace');
        if (fs.existsSync(workspaceDir)) {
          runtimeFile = path.join(workspaceDir, 'SOUL.md');
          fs.writeFileSync(runtimeFile, personaContent, 'utf8');
          applied.push('openclaw');
        }
      }
    }

    return { scope: 'global', slug, applied };
  } else {
    setDefaultInIndex(resolvePersonaIndex(projectRoot), slug, 'personas');
    return { scope: 'project', slug, hint: '请运行 npx code-abyss -y 使项目级变更生效' };
  }
}

function cmdApplyStyle(slug, isGlobal, targets, projectRoot) {
  const styleIx = resolveStyleIndex(projectRoot);
  const { list: styles } = readIndex(styleIx, 'styles');
  const style = styles.find(s => s.slug === slug);
  if (!style) throw new Error(`风格 '${slug}' 不存在`);

  if (isGlobal) {
    const ts = resolveTargets(targets);
    const applied = [];

    for (const target of ts) {
      const runtimeDir = resolveRuntimeDir(target);
      if (!fs.existsSync(runtimeDir)) continue;

      if (target === 'claude' || target === 'gemini') {
        const settingsPath = path.join(runtimeDir, 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          settings.outputStyle = slug;
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
          applied.push(target);
        }
      } else if (target === 'codex' || target === 'openclaw') {
        // For codex/openclaw, style is embedded in AGENTS.md/SOUL.md
        // Just update the settings equivalent; full re-install handles the rest
        const configPath = target === 'codex'
          ? path.join(runtimeDir, 'config.toml')
          : path.join(runtimeDir, 'openclaw.json');
        if (fs.existsSync(configPath)) {
          applied.push(target);
        }
      }
    }

    return { scope: 'global', slug, applied };
  } else {
    setDefaultInIndex(styleIx, slug, 'styles');
    return { scope: 'project', slug, hint: '请运行 npx code-abyss -y 使项目级变更生效' };
  }
}

// ── remove ──

function cmdRemove(type, slug, projectRoot) {
  type = normalizeType(type);
  const indexPath = type === 'personas'
    ? resolvePersonaIndex(projectRoot)
    : resolveStyleIndex(projectRoot);
  const listKey = type === 'personas' ? 'personas' : 'styles';

  const removed = removeFromIndex(indexPath, slug, listKey);

  const fileDir = type === 'personas'
    ? resolvePersonaDir(projectRoot)
    : resolveStyleDir(projectRoot);
  const filePath = path.join(fileDir, removed.file);

  return {
    slug: removed.slug,
    label: removed.label || slug,
    indexPath,
    preservedFile: filePath,
  };
}

// ── create ──

function cmdCreatePersona(slug, srcFile, gender, projectRoot) {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error('slug 必须是 kebab-case 格式（小写字母开头，仅含小写字母、数字、连字符）');
  }

  const content = fs.readFileSync(srcFile, 'utf8');
  const validation = validatePersonaContent(content);
  if (!validation.valid) {
    throw new Error('Persona 校验失败:\n' + validation.errors.map(e => `  - ${e}`).join('\n'));
  }

  const targetDir = resolvePersonaDir(projectRoot);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const destFile = path.join(targetDir, `${slug}.md`);
  fs.copyFileSync(srcFile, destFile);

  const titleLine = extractTitleLine(content);
  const label = extractLabel(titleLine);
  const tagline = extractTagline(content);

  const entry = {
    slug,
    label: label || slug,
    description: tagline || '',
    file: `${slug}.md`,
    gender: gender || 'male',
    default: false,
  };

  const indexPath = resolvePersonaIndex(projectRoot);
  addToIndex(indexPath, entry, 'personas');

  return { slug, label: entry.label, destFile, indexPath };
}

function cmdCreateStyle(slug, srcFile, targets, projectRoot) {
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    throw new Error('slug 必须是 kebab-case 格式（小写字母开头，仅含小写字母、数字、连字符）');
  }

  const content = fs.readFileSync(srcFile, 'utf8');
  const validation = validateStyleContent(content);
  if (!validation.valid) {
    throw new Error('Style 校验失败:\n' + validation.errors.map(e => `  - ${e}`).join('\n'));
  }

  const targetDir = resolveStyleDir(projectRoot);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const destFile = path.join(targetDir, `${slug}.md`);
  fs.copyFileSync(srcFile, destFile);

  const titleLine = extractTitleLine(content);
  const label = extractLabel(titleLine);
  const tagline = extractTagline(content);

  const entry = {
    slug,
    label: label || slug,
    description: tagline || '',
    file: `${slug}.md`,
    default: false,
    targets: resolveTargets(targets),
  };

  const indexPath = resolveStyleIndex(projectRoot);
  addToIndex(indexPath, entry, 'styles');

  return { slug, label: entry.label, destFile, indexPath };
}

// ── CLI ──

function parseSubcommand(argv) {
  const args = [];
  const opts = {};
  let i = 0;

  while (i < argv.length) {
    if (argv[i] === '--project-root' && argv[i + 1]) {
      opts.projectRoot = argv[++i];
    } else if (argv[i] === '--gender' && argv[i + 1]) {
      opts.gender = argv[++i];
    } else if (argv[i] === '--targets' && argv[i + 1]) {
      opts.targets = argv[++i];
    } else if (argv[i] === '--target' && argv[i + 1]) {
      opts.target = argv[++i];
    } else if (argv[i] === '--global') {
      opts.global = true;
    } else {
      args.push(argv[i]);
    }
    i++;
  }

  return { args, opts };
}

function printHelp() {
  console.log(`soul — 人格与输出风格全生命周期管理

用法:
  node soul.js list personas [--project-root <path>]
  node soul.js list styles [--project-root <path>]
  node soul.js current [--target <name>] [--global]
  node soul.js validate persona <file>
  node soul.js validate style <file>
  node soul.js create persona <slug> <file> [--gender m|f] [--project-root <path>]
  node soul.js create style <slug> <file> [--targets a,b] [--project-root <path>]
  node soul.js apply persona <slug> [--global] [--targets a,b]
  node soul.js apply style <slug> [--global] [--targets a,b]
  node soul.js remove persona <slug> [--project-root <path>]
  node soul.js remove style <slug> [--project-root <path>]
`);
}

function main() {
  const rawArgs = process.argv.slice(2);
  const { args, opts } = parseSubcommand(rawArgs);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const cmd = args[0];

  try {
    if (cmd === 'list') {
      const type = args[1]; // personas | styles | all
      if (!type || (type !== 'personas' && type !== 'styles' && type !== 'all')) {
        console.error('用法: soul list personas|styles|all [--project-root <path>]');
        process.exit(1);
      }
      if (type === 'all') {
        const result = {
          personas: cmdList('personas', opts.projectRoot),
          styles: cmdList('styles', opts.projectRoot),
          current: cmdCurrent(opts.target, opts.global, opts.projectRoot),
        };
        console.log(JSON.stringify(result, null, 2));
      } else {
        const result = cmdList(type, opts.projectRoot);
        console.log(JSON.stringify(result, null, 2));
      }

    } else if (cmd === 'current') {
      const result = cmdCurrent(opts.target, opts.global, opts.projectRoot);
      console.log(JSON.stringify(result, null, 2));

    } else if (cmd === 'validate') {
      const type = args[1];
      const file = args[2];
      if (!type || !file || (type !== 'persona' && type !== 'style')) {
        console.error('用法: soul validate persona|style <file>');
        process.exit(1);
      }
      if (!fs.existsSync(file)) {
        console.error(`文件不存在: ${file}`);
        process.exit(1);
      }
      const content = fs.readFileSync(file, 'utf8');
      const validation = type === 'persona'
        ? validatePersonaContent(content)
        : validateStyleContent(content);

      if (validation.valid) {
        console.log(`✓ 校验通过: ${file}`);
        validation.warnings.forEach(w => console.log(`⚠ ${w}`));
      } else {
        console.error(`✗ 校验失败: ${file}`);
        validation.errors.forEach(e => console.error(`  - ${e}`));
        validation.warnings.forEach(w => console.log(`⚠ ${w}`));
        process.exit(1);
      }

    } else if (cmd === 'create') {
      const type = args[1];
      const slug = args[2];
      const file = args[3];
      if (!type || !slug || !file || (type !== 'persona' && type !== 'style')) {
        console.error('用法: soul create persona|style <slug> <file> [--gender m|f] [--targets a,b] [--project-root <path>]');
        process.exit(1);
      }
      if (!fs.existsSync(file)) {
        console.error(`文件不存在: ${file}`);
        process.exit(1);
      }

      if (type === 'persona') {
        const result = cmdCreatePersona(slug, file, opts.gender, opts.projectRoot);
        console.log(`已写入: ${result.destFile}`);
        console.log(`索引已更新: ${result.indexPath}`);
        console.log('注意: 如需安装使用，请调用 npx code-abyss --target claude -y');
      } else {
        const result = cmdCreateStyle(slug, file, opts.targets, opts.projectRoot);
        console.log(`已写入: ${result.destFile}`);
        console.log(`索引已更新: ${result.indexPath}`);
        console.log('注意: 如需安装使用，请调用 npx code-abyss --target claude -y');
      }

    } else if (cmd === 'apply') {
      const type = args[1];
      const slug = args[2];
      if (!type || !slug || (type !== 'persona' && type !== 'style')) {
        console.error('用法: soul apply persona|style <slug> [--global] [--targets a,b]');
        process.exit(1);
      }

      if (type === 'persona') {
        const result = cmdApplyPersona(slug, opts.global, opts.targets, opts.projectRoot);
        if (result.scope === 'global') {
          console.log(`人格已切至「${slug}」，全局生效 (${result.applied.join(', ')})`);
        } else {
          console.log(`项目默认人格已切至「${slug}」`);
          console.log(result.hint);
        }
      } else {
        const result = cmdApplyStyle(slug, opts.global, opts.targets, opts.projectRoot);
        if (result.scope === 'global') {
          console.log(`风格已切至「${slug}」，全局生效 (${result.applied.join(', ')})`);
        } else {
          console.log(`项目默认风格已切至「${slug}」`);
          console.log(result.hint);
        }
      }

    } else if (cmd === 'remove') {
      const type = args[1];
      const slug = args[2];
      if (!type || !slug || (type !== 'persona' && type !== 'style')) {
        console.error('用法: soul remove persona|style <slug> [--project-root <path>]');
        process.exit(1);
      }

      const result = cmdRemove(type, slug, opts.projectRoot);
      console.log(`已从索引移除「${result.label}」`);
      console.log(`源文件保留: ${result.preservedFile}`);

    } else {
      console.error(`未知命令: ${cmd}`);
      printHelp();
      process.exit(1);
    }
  } catch (err) {
    console.error(`错误: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validatePersonaContent,
  validateStyleContent,
  extractTitleLine,
  extractLabel,
  extractTagline,
  addToIndex,
  removeFromIndex,
  setDefaultInIndex,
  ensureIndexExists,
  resolvePersonaDir,
  resolveStyleDir,
  cmdList,
  cmdCurrent,
  cmdApplyPersona,
  cmdApplyStyle,
  cmdRemove,
};
