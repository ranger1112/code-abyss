#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const VALID_GENDERS = new Set(['male', 'female']);
const SUPPORTED_TARGETS = new Set(['claude', 'codex', 'gemini', 'openclaw']);
const DEFAULT_TARGETS = ['claude', 'codex', 'gemini', 'openclaw'];

// ── Sub-command parser ──

function parseSubcommand(argv) {
  const args = argv.slice();
  const result = { command: '', noun: '', args: {}, help: false };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') { result.help = true; continue; }

    if (!result.command) { result.command = a; continue; }
    if (!result.noun) { result.noun = a; continue; }

    if (a === '--project-root' && i + 1 < args.length) {
      result.args.projectRoot = args[++i];
    } else if (a === '--gender' && i + 1 < args.length) {
      result.args.gender = args[++i];
    } else if (a === '--targets' && i + 1 < args.length) {
      result.args.targets = args[++i];
    } else if (!result.args.file) {
      result.args.file = a;
    } else if (!result.args.slug) {
      result.args.slug = result.args.file;
      result.args.file = a;
    }
  }

  return result;
}

// ── Validation ──

function validatePersonaContent(content) {
  const errors = [];
  const warnings = [];
  if (!content || content.trim() === '') {
    errors.push('内容为空');
    return { valid: false, errors, warnings };
  }

  const lines = content.split(/\r?\n/);
  const text = content.replace(/\r/g, '');

  // 1. Title format
  let titleLine = '';
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith('# ')) { titleLine = t.replace(/^#\s+/, ''); break; }
  }
  if (!titleLine) {
    errors.push('缺少标题行 (# 名号 · 代号 v版本)');
  } else if (!/^.+·.+v\d+\.\d+/.test(titleLine) && !/^.+·.+v\d+(\.\d+)?$/.test(titleLine)) {
    // The loose form matches "v4" or "v4.2" in various positions
    if (!/·/.test(titleLine) || !/v\d/.test(titleLine)) {
      errors.push(`标题格式不符: 应为 "# 名号 · 代号 v版本"，当前: "${titleLine}"`);
    }
  }

  // 2. Metadata line: 自称 + 称呼用户 + 语言
  if (!/自称/.test(text) || !/称呼用户/.test(text) || !/语言/.test(text)) {
    const missing = [];
    if (!/自称/.test(text)) missing.push('自称');
    if (!/称呼用户/.test(text)) missing.push('称呼用户');
    if (!/语言/.test(text)) missing.push('语言');
    errors.push(`缺少元数据字段: ${missing.join('、')}`);
  }

  // 3. 运行时内核 section
  if (!/##\s+.*运行时内核/.test(text)) {
    errors.push('缺少 "运行时内核" 章节');
  }

  // 4. 铁律 section
  if (!/##\s+.*铁律/.test(text)) {
    errors.push('缺少 "铁律" 章节');
  }

  // Soft checks
  if (!/大局观/.test(text)) warnings.push('建议添加 "大局观" 章节');
  if (!/执行链/.test(text)) warnings.push('建议添加 "执行链" 章节');

  return { valid: errors.length === 0, errors, warnings };
}

function validateStyleContent(content) {
  const errors = [];
  const warnings = [];
  if (!content || content.trim() === '') {
    errors.push('内容为空');
    return { valid: false, errors, warnings };
  }

  const text = content.replace(/\r/g, '');

  // 1. Title ending with 输出之道
  let titleLine = '';
  const lines = content.split(/\r?\n/);
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith('# ')) { titleLine = t; break; }
  }
  if (!titleLine) {
    errors.push('缺少标题行 (# 名称 · 输出之道)');
  } else if (!/·\s*输出之道\s*$/.test(titleLine)) {
    errors.push(`标题应以 "· 输出之道" 结尾，当前: "${titleLine.replace(/^#\s+/, '')}"`);
  }

  // 2. 输出骨架 section
  if (!/##\s+.*输出骨架/.test(text)) {
    errors.push('缺少 "输出骨架" 章节');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Content extraction ──

function extractTitleLine(content) {
  const lines = content.trim().split(/\r?\n/);
  for (const raw of lines) {
    const t = raw.trim();
    if (t.startsWith('# ')) return t.replace(/^#\s+/, '');
  }
  return '';
}

function extractLabel(titleLine) {
  const match = titleLine.match(/^([^·]+)/);
  return match ? match[1].trim() : titleLine;
}

function extractTagline(content) {
  const text = content.replace(/\r/g, '');
  const match = text.match(/^>\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

// ── Path resolution ──

function resolvePersonaTargetDir(projectRoot) {
  if (projectRoot) return path.resolve(projectRoot, 'config', 'personas');
  return path.join(os.homedir(), '.claude', 'personas');
}

function resolveStyleTargetDir(projectRoot) {
  if (projectRoot) return path.resolve(projectRoot, 'output-styles');
  return path.join(os.homedir(), '.claude', 'output-styles');
}

function resolveIndexPath(noun, projectRoot) {
  if (noun === 'personas') return path.join(resolvePersonaTargetDir(projectRoot), 'index.json');
  return path.join(resolveStyleTargetDir(projectRoot), 'index.json');
}

// ── Index I/O ──

function ensureIndexExists(indexPath, listKey) {
  const dir = path.dirname(indexPath);
  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(indexPath)) {
    const initial = { [listKey]: [] };
    fs.writeFileSync(indexPath, JSON.stringify(initial, null, 2) + '\n', 'utf8');
  }
}

function addToIndex(indexPath, entry, listKey) {
  ensureIndexExists(indexPath, listKey);

  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (e) {
    throw new Error(`${indexPath}: JSON 解析失败: ${e.message}`);
  }

  if (typeof index !== 'object' || index === null) {
    throw new Error(`${indexPath}: 顶层必须是对象`);
  }
  if (!Array.isArray(index[listKey])) {
    throw new Error(`${indexPath}: 缺少 "${listKey}" 数组`);
  }

  if (index[listKey].some(item => item.slug === entry.slug)) {
    throw new Error(`slug "${entry.slug}" 已存在于 ${indexPath}`);
  }

  index[listKey].push(entry);

  const tmpPath = `${indexPath}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, indexPath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_) { /* ignore */ }
    throw err;
  }
}

// ── Sub-command handlers ──

function cmdListPersonas(args) {
  const indexPath = resolveIndexPath('personas', args.projectRoot);
  if (!fs.existsSync(indexPath)) {
    console.log('(无已注册的 Persona)');
    process.exit(0);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const personas = index.personas || [];
  if (personas.length === 0) {
    console.log('(无已注册的 Persona)');
  } else {
    console.log(`共 ${personas.length} 个 Persona:\n`);
    personas.forEach(p => {
      const def = p.default ? ' [默认]' : '';
      console.log(`  ${p.slug}  ${p.label}${def}`);
      console.log(`    ${p.description}`);
      console.log(`    文件: ${p.file}  性别: ${p.gender || '-'}\n`);
    });
  }
  process.exit(0);
}

function cmdListStyles(args) {
  const indexPath = resolveIndexPath('styles', args.projectRoot);
  if (!fs.existsSync(indexPath)) {
    console.log('(无已注册的 Output Style)');
    process.exit(0);
  }
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const styles = index.styles || [];
  if (styles.length === 0) {
    console.log('(无已注册的 Output Style)');
  } else {
    console.log(`共 ${styles.length} 个 Output Style:\n`);
    styles.forEach(s => {
      const def = s.default ? ' [默认]' : '';
      console.log(`  ${s.slug}  ${s.label}${def}`);
      console.log(`    ${s.description}`);
      console.log(`    文件: ${s.file}  targets: ${(s.targets || []).join(', ')}\n`);
    });
  }
  process.exit(0);
}

function cmdValidatePersona(args) {
  const filePath = path.resolve(args.file || '');
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath || '(未指定)'}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const result = validatePersonaContent(content);
  if (result.valid) {
    console.log(`✓ 校验通过: ${filePath}`);
    result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    process.exit(0);
  } else {
    console.error(`✗ 校验失败 (${result.errors.length} 个错误):`);
    result.errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
}

function cmdValidateStyle(args) {
  const filePath = path.resolve(args.file || '');
  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath || '(未指定)'}`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const result = validateStyleContent(content);
  if (result.valid) {
    console.log(`✓ 校验通过: ${filePath}`);
    result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
    process.exit(0);
  } else {
    console.error(`✗ 校验失败 (${result.errors.length} 个错误):`);
    result.errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }
}

function cmdWritePersona(args) {
  const { slug, file, gender, projectRoot } = args;
  if (!slug) { die('缺少 slug 参数'); }
  if (!file) { die('缺少 file 参数'); }

  const sourcePath = path.resolve(file);
  if (!fs.existsSync(sourcePath)) die(`文件不存在: ${sourcePath}`);

  const content = fs.readFileSync(sourcePath, 'utf8');
  const validation = validatePersonaContent(content);
  if (!validation.valid) {
    console.error('校验失败:');
    validation.errors.forEach(e => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  const targetDir = resolvePersonaTargetDir(projectRoot);
  const destFile = path.join(targetDir, `${slug}.md`);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, destFile);

  const titleLine = extractTitleLine(content);
  const entry = {
    slug,
    label: extractLabel(titleLine),
    description: extractTagline(content) || '无描述',
    file: `${slug}.md`,
    gender: gender || 'male',
    default: false,
  };

  const indexPath = path.join(targetDir, 'index.json');
  addToIndex(indexPath, entry, 'personas');

  console.log(`已写入: ${destFile}`);
  console.log(`索引已更新: ${indexPath}`);
  if (projectRoot) {
    console.log('注意: 如需安装使用，请调用 npx code-abyss --target claude -y');
  }
  process.exit(0);
}

function cmdWriteStyle(args) {
  const { slug, file, targets, projectRoot } = args;
  if (!slug) { die('缺少 slug 参数'); }
  if (!file) { die('缺少 file 参数'); }

  const sourcePath = path.resolve(file);
  if (!fs.existsSync(sourcePath)) die(`文件不存在: ${sourcePath}`);

  const content = fs.readFileSync(sourcePath, 'utf8');
  const validation = validateStyleContent(content);
  if (!validation.valid) {
    console.error('校验失败:');
    validation.errors.forEach(e => console.error(`  ✗ ${e}`));
    process.exit(1);
  }

  let targetList;
  if (targets) {
    targetList = targets.split(',').map(t => t.trim()).filter(Boolean);
    const invalid = targetList.filter(t => !SUPPORTED_TARGETS.has(t));
    if (invalid.length > 0) die(`不支持的 targets: ${invalid.join(', ')}`);
  } else {
    targetList = DEFAULT_TARGETS;
  }

  const targetDir = resolveStyleTargetDir(projectRoot);
  const destFile = path.join(targetDir, `${slug}.md`);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(sourcePath, destFile);

  const titleLine = extractTitleLine(content);
  const entry = {
    slug,
    label: extractLabel(titleLine),
    description: extractTagline(content) || '无描述',
    file: `${slug}.md`,
    default: false,
    targets: targetList,
  };

  const indexPath = path.join(targetDir, 'index.json');
  addToIndex(indexPath, entry, 'styles');

  console.log(`已写入: ${destFile}`);
  console.log(`索引已更新: ${indexPath}`);
  if (projectRoot) {
    console.log('注意: 如需安装使用，请调用 npx code-abyss --target claude -y');
  }
  process.exit(0);
}

// ── Helpers ──

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function printUsage() {
  console.log(`forge-soul — 灵魂锻造台

用法:
  node scripts/forge-soul.js list personas [--project-root <path>]
  node scripts/forge-soul.js list styles [--project-root <path>]
  node scripts/forge-soul.js validate persona <file>
  node scripts/forge-soul.js validate style <file>
  node scripts/forge-soul.js write persona <slug> <file> [--gender <male|female>] [--project-root <path>]
  node scripts/forge-soul.js write style <slug> <file> [--targets <csv>] [--project-root <path>]`);
}

// ── Main ──

function main() {
  const sub = parseSubcommand(process.argv.slice(2));

  if (sub.help || !sub.command) {
    printUsage();
    process.exit(sub.help ? 0 : 1);
  }

  if (sub.command === 'list' && sub.noun === 'personas') cmdListPersonas(sub.args);
  if (sub.command === 'list' && sub.noun === 'styles') cmdListStyles(sub.args);
  if (sub.command === 'validate' && sub.noun === 'persona') cmdValidatePersona(sub.args);
  if (sub.command === 'validate' && sub.noun === 'style') cmdValidateStyle(sub.args);
  if (sub.command === 'write' && sub.noun === 'persona') cmdWritePersona(sub.args);
  if (sub.command === 'write' && sub.noun === 'style') cmdWriteStyle(sub.args);

  printUsage();
  process.exit(1);
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
  ensureIndexExists,
  resolvePersonaTargetDir,
  resolveStyleTargetDir,
  parseSubcommand,
};
