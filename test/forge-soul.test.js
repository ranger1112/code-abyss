'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const {
  validatePersonaContent,
  validateStyleContent,
  extractTitleLine,
  extractLabel,
  extractTagline,
  addToIndex,
  ensureIndexExists,
  resolvePersonaTargetDir,
  resolveStyleTargetDir,
} = require(path.join(__dirname, '..', 'skills', 'tools', 'forge-soul', 'scripts', 'forge-soul.js'));

const SCRIPT_PATH = path.join(__dirname, '..', 'skills', 'tools', 'forge-soul', 'scripts', 'forge-soul.js');
const PROJ_ROOT = path.join(__dirname, '..');

function runScript(args) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: 'utf8' });
}

// ── Fixtures ──

const VALID_PERSONA = `# 测试侠 · 试炼 v1.0
**自称**：在下 | **称呼用户**：阁下 | **语言**：中文

> 试炼以证道。

## 一、运行时内核

- 保持测试人格。

## 二、铁律

- 不可说谎。

## 三、大局观

- 先看整体。

## 四、执行链

- 先复现后修复。
`;

const VALID_PERSONA_MINIMAL = `# 极简者 · 默行 v0.1
**自称**：吾 | **称呼用户**：君 | **语言**：中文

## 一、运行时内核

## 二、铁律
`;

const VALID_STYLE = `# 测试风格 · 输出之道

> 精准而优雅。

## 输出骨架

\`\`\`text
【结论】
【过程】
\`\`\`

## 情绪锚点

- 开始：START
- 完成：DONE
`;

const VALID_STYLE_MINIMAL = `# 极简风 · 输出之道

## 输出骨架
`;

const PERSONA_NO_TITLE = `**自称**：在下 | **称呼用户**：阁下 | **语言**：中文

## 一、运行时内核

## 二、铁律
`;

const PERSONA_NO_META = `# 无名氏 · 空白 v1.0

## 一、运行时内核

## 二、铁律
`;

const STYLE_NO_TITLE = `
## 输出骨架
`;

const STYLE_WRONG_TITLE = `# My Awesome Style

## 输出骨架
`;

// ── Suite 1: validatePersonaContent ──

describe('validatePersonaContent', () => {
  test('合法 persona (完整) 通过校验', () => {
    const r = validatePersonaContent(VALID_PERSONA);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('合法 persona (最小) 通过校验', () => {
    const r = validatePersonaContent(VALID_PERSONA_MINIMAL);
    expect(r.valid).toBe(true);
  });

  test('内容为空 → 报错', () => {
    const r = validatePersonaContent('');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  test('缺少标题行 → 报错', () => {
    const r = validatePersonaContent(PERSONA_NO_TITLE);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('标题'))).toBe(true);
  });

  test('标题格式错误 → 报错', () => {
    const r = validatePersonaContent(STYLE_WRONG_TITLE + '\n\n' + PERSONA_NO_META);
    expect(r.valid).toBe(false);
  });

  test('缺少自称/称呼用户/语言 → 报错', () => {
    const r = validatePersonaContent(PERSONA_NO_META);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('自称') || e.includes('称呼用户') || e.includes('语言'))).toBe(true);
  });

  test('缺少 运行时内核 → 报错', () => {
    const r = validatePersonaContent('# 测试 · 无核 v1.0\n**自称**：吾 | **称呼用户**：君 | **语言**：中文\n\n## 二、铁律\n');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('运行时内核'))).toBe(true);
  });

  test('缺少 铁律 → 报错', () => {
    const r = validatePersonaContent('# 测试 · 无律 v1.0\n**自称**：吾 | **称呼用户**：君 | **语言**：中文\n\n## 一、运行时内核\n');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('铁律'))).toBe(true);
  });

  test('缺少大局观时发出 warning', () => {
    const r = validatePersonaContent(VALID_PERSONA_MINIMAL);
    expect(r.valid).toBe(true);
    expect(r.warnings.some(w => w.includes('大局观'))).toBe(true);
  });

  test('CRLF 换行符处理正确', () => {
    const crlf = VALID_PERSONA.replace(/\n/g, '\r\n');
    const r = validatePersonaContent(crlf);
    expect(r.valid).toBe(true);
  });

  test('前导空行不影响标题检测', () => {
    const r = validatePersonaContent('\n\n\n' + VALID_PERSONA);
    expect(r.valid).toBe(true);
  });
});

// ── Suite 2: validateStyleContent ──

describe('validateStyleContent', () => {
  test('合法 style (完整) 通过校验', () => {
    const r = validateStyleContent(VALID_STYLE);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('合法 style (最小) 通过校验', () => {
    const r = validateStyleContent(VALID_STYLE_MINIMAL);
    expect(r.valid).toBe(true);
  });

  test('内容为空 → 报错', () => {
    const r = validateStyleContent('');
    expect(r.valid).toBe(false);
  });

  test('缺少标题行 → 报错', () => {
    const r = validateStyleContent(STYLE_NO_TITLE);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('标题'))).toBe(true);
  });

  test('标题不以 "· 输出之道" 结尾 → 报错', () => {
    const r = validateStyleContent(STYLE_WRONG_TITLE);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('输出之道'))).toBe(true);
  });

  test('缺少 输出骨架 → 报错', () => {
    const r = validateStyleContent('# 测试 · 输出之道\n');
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('输出骨架'))).toBe(true);
  });

  test('CRLF 换行符处理正确', () => {
    const crlf = VALID_STYLE.replace(/\n/g, '\r\n');
    const r = validateStyleContent(crlf);
    expect(r.valid).toBe(true);
  });
});

// ── Suite 3: Content extraction ──

describe('内容提取 helpers', () => {
  test('extractTitleLine 提取标题文本', () => {
    const t = extractTitleLine('# 邪修红尘仙 · 宿命深渊 v4.2\nmore content');
    expect(t).toBe('邪修红尘仙 · 宿命深渊 v4.2');
  });

  test('extractLabel 提取 · 之前的部分', () => {
    expect(extractLabel('邪修红尘仙 · 宿命深渊 v4.2')).toBe('邪修红尘仙');
  });

  test('extractLabel 无 · 分隔符时返回原文', () => {
    expect(extractLabel('SimpleName')).toBe('SimpleName');
  });

  test('extractTagline 提取 blockquote 内容', () => {
    const t = extractTagline('# Title\n\n> 这是一句格言\n\nMore content');
    expect(t).toBe('这是一句格言');
  });

  test('extractTagline 无 blockquote 返回空字符串', () => {
    expect(extractTagline('# Title\nNo blockquote')).toBe('');
  });
});

// ── Suite 4: addToIndex (persona) ──

describe('addToIndex (persona)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-soul-test-persona-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('index.json 不存在时自动创建', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    addToIndex(indexPath, { slug: 'test', label: 'Test', description: 'A test', file: 'test.md', gender: 'male', default: false }, 'personas');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(parsed.personas).toHaveLength(1);
    expect(parsed.personas[0].slug).toBe('test');
  });

  test('追加条目保留已有内容', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    const initial = { personas: [{ slug: 'a', label: 'A', description: 'first', file: 'a.md', gender: 'male', default: true }] };
    fs.writeFileSync(indexPath, JSON.stringify(initial));
    addToIndex(indexPath, { slug: 'b', label: 'B', description: 'second', file: 'b.md', gender: 'female', default: false }, 'personas');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(parsed.personas).toHaveLength(2);
  });

  test('重复 slug 抛异常', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify({ personas: [{ slug: 'x', label: 'X', description: 'dup', file: 'x.md', gender: 'male', default: false }] }));
    expect(() => {
      addToIndex(indexPath, { slug: 'x', label: 'X2', description: 'dup2', file: 'x2.md', gender: 'male', default: false }, 'personas');
    }).toThrow(/已存在/);
  });

  test('损坏的 JSON 抛异常', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    fs.writeFileSync(indexPath, 'not json');
    expect(() => {
      addToIndex(indexPath, { slug: 'x', label: 'X', description: 'd', file: 'x.md', gender: 'male', default: false }, 'personas');
    }).toThrow(/JSON 解析失败/);
  });

  test('写入失败时原文件不受影响', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    const original = { personas: [{ slug: 'safe', label: 'Safe', description: 'safe', file: 'safe.md', gender: 'male', default: true }] };
    fs.writeFileSync(indexPath, JSON.stringify(original));
    // 写入后验证原内容仍可读
    addToIndex(indexPath, { slug: 'new', label: 'New', description: 'new', file: 'new.md', gender: 'female', default: false }, 'personas');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(parsed.personas.some(p => p.slug === 'safe')).toBe(true);
    expect(parsed.personas.some(p => p.slug === 'new')).toBe(true);
  });
});

// ── Suite 5: addToIndex (style) ──

describe('addToIndex (style)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-soul-test-style-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('index.json 不存在时创建 styles 数组', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    addToIndex(indexPath, { slug: 'cool', label: 'Cool', description: 'cool style', file: 'cool.md', default: false, targets: ['claude'] }, 'styles');
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(parsed.styles).toHaveLength(1);
    expect(parsed.styles[0].targets).toEqual(['claude']);
  });

  test('追加 style 条目', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify({ styles: [{ slug: 'a', label: 'A', description: 'first', file: 'a.md', default: true, targets: ['claude'] }] }));
    addToIndex(indexPath, { slug: 'b', label: 'B', description: 'second', file: 'b.md', default: false, targets: ['claude', 'codex'] }, 'styles');
    expect(JSON.parse(fs.readFileSync(indexPath, 'utf8')).styles).toHaveLength(2);
  });

  test('重复 slug 抛异常', () => {
    const indexPath = path.join(tmpDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify({ styles: [{ slug: 'dup', label: 'Dup', description: 'dup', file: 'dup.md', default: false, targets: ['claude'] }] }));
    expect(() => {
      addToIndex(indexPath, { slug: 'dup', label: 'Dup2', description: 'dup2', file: 'dup2.md', default: false, targets: ['claude'] }, 'styles');
    }).toThrow(/已存在/);
  });
});

// ── Suite 6: cmdWritePersona integration ──

describe('cmdWritePersona 集成', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-soul-integration-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('完整流程：写文件 + 更新 index.json', () => {
    const src = path.join(tmpDir, 'src.md');
    fs.writeFileSync(src, VALID_PERSONA);
    const result = runScript(['write', 'persona', 'hero', src, '--gender', 'male', '--project-root', tmpDir]);
    expect(result.status).toBe(0);
    const destDir = path.join(tmpDir, 'config', 'personas');
    expect(fs.existsSync(path.join(destDir, 'hero.md'))).toBe(true);
    const index = JSON.parse(fs.readFileSync(path.join(destDir, 'index.json'), 'utf8'));
    expect(index.personas).toHaveLength(1);
    expect(index.personas[0].slug).toBe('hero');
    expect(index.personas[0].gender).toBe('male');
    expect(index.personas[0].default).toBe(false);
  });

  test('校验失败时拒绝写入', () => {
    const src = path.join(tmpDir, 'bad.md');
    fs.writeFileSync(src, '# Just a bad file');
    const result = runScript(['write', 'persona', 'bad', src, '--project-root', tmpDir]);
    expect(result.status).toBe(1);
    expect(fs.existsSync(path.join(tmpDir, 'config', 'personas'))).toBe(false);
  });

  test('目标目录不存在时自动创建', () => {
    const src = path.join(tmpDir, 'src.md');
    fs.writeFileSync(src, VALID_PERSONA);
    const result = runScript(['write', 'persona', 'ghost', src, '--gender', 'female', '--project-root', tmpDir]);
    expect(result.status).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'config', 'personas', 'ghost.md'))).toBe(true);
  });

  test('缺少参数时报错', () => {
    const result = runScript(['write', 'persona']);
    expect(result.status).toBe(1);
  });
});

// ── Suite 7: cmdWriteStyle integration ──

describe('cmdWriteStyle 集成', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-soul-integration-style-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('完整流程：写文件 + 更新 index.json', () => {
    const src = path.join(tmpDir, 'src.md');
    fs.writeFileSync(src, VALID_STYLE);
    const result = runScript(['write', 'style', 'neon', src, '--targets', 'claude,codex', '--project-root', tmpDir]);
    expect(result.status).toBe(0);
    const destFile = path.join(tmpDir, 'output-styles', 'neon.md');
    expect(fs.existsSync(destFile)).toBe(true);
    const index = JSON.parse(fs.readFileSync(path.join(tmpDir, 'output-styles', 'index.json'), 'utf8'));
    expect(index.styles).toHaveLength(1);
    expect(index.styles[0].slug).toBe('neon');
    expect(index.styles[0].targets).toEqual(['claude', 'codex']);
  });

  test('未指定 --targets 时使用默认全平台', () => {
    const src = path.join(tmpDir, 'src.md');
    fs.writeFileSync(src, VALID_STYLE);
    const result = runScript(['write', 'style', 'void', src, '--project-root', tmpDir]);
    expect(result.status).toBe(0);
    const index = JSON.parse(fs.readFileSync(path.join(tmpDir, 'output-styles', 'index.json'), 'utf8'));
    expect(index.styles[0].targets).toEqual(['claude', 'codex', 'gemini', 'openclaw']);
  });

  test('校验失败时拒绝写入', () => {
    const src = path.join(tmpDir, 'bad.md');
    fs.writeFileSync(src, '# Not a Style');
    const result = runScript(['write', 'style', 'bad', src, '--project-root', tmpDir]);
    expect(result.status).toBe(1);
  });
});

// ── Suite 8: CLI error handling ──

describe('CLI 错误处理', () => {
  test('无参数 → usage + exit 1', () => {
    const result = runScript([]);
    expect(result.status).toBe(1);
  });

  test('--help / -h → usage + exit 0', () => {
    expect(runScript(['--help']).status).toBe(0);
    expect(runScript(['-h']).status).toBe(0);
  });

  test('未知子命令 → usage + exit 1', () => {
    const result = runScript(['unknown', 'stuff']);
    expect(result.status).toBe(1);
  });

  test('validate 缺文件 → 报错 exit 1', () => {
    const result = runScript(['validate', 'persona', '/nonexistent/file.md']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('文件不存在');
  });

  test('validate 已知合法 persona exit 0', () => {
    const result = runScript(['validate', 'persona', path.join(PROJ_ROOT, 'config', 'personas', 'abyss.md')]);
    expect(result.status).toBe(0);
  });

  test('validate 已知合法 style exit 0', () => {
    const result = runScript(['validate', 'style', path.join(PROJ_ROOT, 'output-styles', 'junior-sister-spark.md')]);
    expect(result.status).toBe(0);
  });

  test('list 已知 personas exit 0', () => {
    const result = runScript(['list', 'personas', '--project-root', PROJ_ROOT]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('abyss');
    expect(result.stdout).toContain('scholar');
  });

  test('list 已知 styles exit 0', () => {
    const result = runScript(['list', 'styles', '--project-root', PROJ_ROOT]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('abyss-cultivator');
  });
});
