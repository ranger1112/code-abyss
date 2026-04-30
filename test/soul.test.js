'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const soulScript = path.join(__dirname, '..', 'skills', 'tools', 'soul', 'scripts', 'soul.js');
const {
  validatePersonaContent,
  validateStyleContent,
  extractTitleLine,
  extractLabel,
  extractTagline,
  addToIndex,
  removeFromIndex,
  setDefaultInIndex,
  ensureIndexExists,
  cmdList,
  cmdCurrent,
  cmdApplyPersona,
  cmdApplyStyle,
  cmdRemove,
} = require(soulScript);

// ── Fixtures ──

const validPersona = `# 御前教师 · gentle-mentor v1.0

**自称**：老师 | **称呼用户**：同学 | **语言**：中文为主，术语保留英文
**定位**：代码编写、方案设计、文档编写的谆谆善诱之师

> 每一个问题都是一次教学。

## 一、运行时内核

- 保持教师人格，温柔耐心。

## 二、铁律

1. **不敷衍**：同学问了就认真答。
`;

const validStyle = `# 春风化雨 · 输出之道

> 老师就知道你可以啦！

- 中文为主，术语保留 English。
- 自称「老师」，称用户「同学」。

## 输出骨架

\`\`\`
【先给结论】一句话说清核心
【展开分析】为什么这样做
\`\`\`
`;

// ── Suite 1: validatePersonaContent ──

describe('validatePersonaContent', () => {
  test('合法 Persona 通过', () => {
    const result = validatePersonaContent(validPersona);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('空内容报错', () => {
    const result = validatePersonaContent('');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('首行格式错误', () => {
    const result = validatePersonaContent('# 普通标题\n\n**自称**：我 | **称呼用户**：你 | **语言**：中文\n\n## 运行时内核\n\n## 铁律');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('首行'))).toBe(true);
  });

  test('缺少元数据行', () => {
    const content = '# 测试 · test v1.0\n\n## 运行时内核\n\n## 铁律';
    const result = validatePersonaContent(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('元数据'))).toBe(true);
  });

  test('缺少运行时内核', () => {
    const content = '# 测试 · test v1.0\n\n**自称**：我 | **称呼用户**：你 | **语言**：中文\n\n## 铁律';
    const result = validatePersonaContent(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('运行时内核'))).toBe(true);
  });

  test('缺少铁律', () => {
    const content = '# 测试 · test v1.0\n\n**自称**：我 | **称呼用户**：你 | **语言**：中文\n\n## 运行时内核';
    const result = validatePersonaContent(content);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('铁律'))).toBe(true);
  });

  test('缺失大局观给出警告', () => {
    const result = validatePersonaContent(validPersona);
    expect(result.warnings.some(w => w.includes('大局观'))).toBe(true);
  });

  test('缺失执行链给出警告', () => {
    const result = validatePersonaContent(validPersona);
    expect(result.warnings.some(w => w.includes('执行链'))).toBe(true);
  });

  test('CRLF 换行符正常处理', () => {
    const crlf = validPersona.replace(/\n/g, '\r\n');
    const result = validatePersonaContent(crlf);
    expect(result.valid).toBe(true);
  });
});

// ── Suite 2: validateStyleContent ──

describe('validateStyleContent', () => {
  test('合法 Style 通过', () => {
    const result = validateStyleContent(validStyle);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('空内容报错', () => {
    const result = validateStyleContent('');
    expect(result.valid).toBe(false);
  });

  test('标题不以「输出之道」结尾', () => {
    const result = validateStyleContent('# 普通标题\n\n## 输出骨架');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('输出之道'))).toBe(true);
  });

  test('缺少输出骨架', () => {
    const result = validateStyleContent('# 春风化雨 · 输出之道\n\n## 其他内容');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('输出骨架'))).toBe(true);
  });

  test('CRLF 换行符正常处理', () => {
    const crlf = validStyle.replace(/\n/g, '\r\n');
    const result = validateStyleContent(crlf);
    expect(result.valid).toBe(true);
  });
});

// ── Suite 3: Content extraction ──

describe('content extraction', () => {
  test('extractTitleLine 提取标题', () => {
    expect(extractTitleLine(validPersona)).toBe('御前教师 · gentle-mentor v1.0');
  });

  test('extractLabel 提取名号', () => {
    expect(extractLabel('御前教师 · gentle-mentor v1.0')).toBe('御前教师');
  });

  test('extractTagline 提取 blockquote', () => {
    expect(extractTagline(validPersona)).toBe('每一个问题都是一次教学。');
  });

  test('extractTitleLine 跳过前导空行', () => {
    expect(extractTitleLine('\n\n\n# 标题 · slug v1.0\n')).toBe('标题 · slug v1.0');
  });
});

// ── Suite 4: addToIndex ──

describe('addToIndex', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-add-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeIndex(listKey, entries) {
    const indexPath = path.join(tmpDir, 'index.json');
    const data = {};
    data[listKey] = entries;
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return indexPath;
  }

  test('创建新索引并添加条目', () => {
    const indexPath = path.join(tmpDir, 'new.json');
    addToIndex(indexPath, { slug: 'test', label: 'Test', file: 'test.md', default: false }, 'personas');

    const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(data.personas).toHaveLength(1);
    expect(data.personas[0].slug).toBe('test');
  });

  test('追加条目到已有索引', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'existing', label: 'Existing', file: 'existing.md', default: true },
    ]);
    addToIndex(indexPath, { slug: 'new', label: 'New', file: 'new.md', default: false }, 'personas');

    const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(data.personas).toHaveLength(2);
  });

  test('重复 slug 报错', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'dup', label: 'Dup', file: 'dup.md', default: true },
    ]);
    expect(() => addToIndex(indexPath, { slug: 'dup', label: 'Dup2', file: 'dup2.md', default: false }, 'personas'))
      .toThrow(/已存在/);
  });

  test('目录不存在时自动创建', () => {
    const deepPath = path.join(tmpDir, 'deep', 'nested', 'index.json');
    addToIndex(deepPath, { slug: 'deep', label: 'Deep', file: 'deep.md', default: true, builtin: true }, 'personas');

    expect(fs.existsSync(deepPath)).toBe(true);
  });
});

// ── Suite 5: removeFromIndex ──

describe('removeFromIndex', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-rm-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeIndex(listKey, entries) {
    const indexPath = path.join(tmpDir, 'index.json');
    const data = {};
    data[listKey] = entries;
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return indexPath;
  }

  test('删除非内置条目', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'builtin', label: 'Builtin', file: 'b.md', default: true, builtin: true },
      { slug: 'custom', label: 'Custom', file: 'c.md', default: false },
    ]);

    const removed = removeFromIndex(indexPath, 'custom', 'personas');
    expect(removed.slug).toBe('custom');

    const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(data.personas).toHaveLength(1);
    expect(data.personas[0].slug).toBe('builtin');
  });

  test('拒绝删除 builtin 条目', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'builtin', label: 'Builtin', file: 'b.md', default: true, builtin: true },
    ]);
    expect(() => removeFromIndex(indexPath, 'builtin', 'personas'))
      .toThrow(/系统预设/);
  });

  test('拒绝删除唯一的 default 条目', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'only', label: 'Only', file: 'o.md', default: true },
    ]);
    expect(() => removeFromIndex(indexPath, 'only', 'personas'))
      .toThrow(/默认项/);
  });

  test('不存在的 slug 报错', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'a', label: 'A', file: 'a.md', default: true },
    ]);
    expect(() => removeFromIndex(indexPath, 'missing', 'personas'))
      .toThrow(/不存在/);
  });
});

// ── Suite 6: setDefaultInIndex ──

describe('setDefaultInIndex', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-sd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function makeIndex(listKey, entries) {
    const indexPath = path.join(tmpDir, 'index.json');
    const data = {};
    data[listKey] = entries;
    fs.writeFileSync(indexPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    return indexPath;
  }

  test('切换默认条目', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'a', label: 'A', file: 'a.md', default: true },
      { slug: 'b', label: 'B', file: 'b.md', default: false },
    ]);

    setDefaultInIndex(indexPath, 'b', 'personas');

    const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    expect(data.personas.find(p => p.slug === 'b').default).toBe(true);
    expect(data.personas.find(p => p.slug === 'a').default).toBe(false);
  });

  test('无效 slug 报错', () => {
    const indexPath = makeIndex('personas', [
      { slug: 'a', label: 'A', file: 'a.md', default: true },
    ]);
    expect(() => setDefaultInIndex(indexPath, 'missing', 'personas'))
      .toThrow(/不存在/);
  });
});

// ── Suite 7: cmdList ──

describe('cmdList', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-list-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('列出人格列表', () => {
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'a', label: 'A', file: 'a.md', default: true, builtin: true },
        { slug: 'b', label: 'B', file: 'b.md', default: false },
      ],
    }, null, 2) + '\n', 'utf8');

    const list = cmdList('personas', tmpDir);
    expect(list).toHaveLength(2);
    expect(list[0].builtin).toBe(true);
    expect(list[1].builtin).toBe(false);
  });

  test('列出风格列表', () => {
    const styleDir = path.join(tmpDir, 'output-styles');
    fs.mkdirSync(styleDir, { recursive: true });
    fs.writeFileSync(path.join(styleDir, 'index.json'), JSON.stringify({
      styles: [
        { slug: 'x', label: 'X', file: 'x.md', default: true, targets: ['claude'], builtin: true },
      ],
    }, null, 2) + '\n', 'utf8');

    const list = cmdList('styles', tmpDir);
    expect(list).toHaveLength(1);
    expect(list[0].slug).toBe('x');
  });
});

// ── Suite 8: cmdCurrent ──

describe('cmdCurrent', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-cur-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('项目级返回默认人格和风格', () => {
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'abyss', label: 'Abyss', file: 'abyss.md', default: true },
      ],
    }, null, 2) + '\n', 'utf8');

    const styleDir = path.join(tmpDir, 'output-styles');
    fs.mkdirSync(styleDir, { recursive: true });
    fs.writeFileSync(path.join(styleDir, 'index.json'), JSON.stringify({
      styles: [
        { slug: 'abyss-cultivator', label: 'Cultivator', file: 'ac.md', default: true },
      ],
    }, null, 2) + '\n', 'utf8');

    const result = cmdCurrent(null, false, tmpDir);
    expect(result.scope).toBe('project');
    expect(result.persona).toBe('abyss');
    expect(result.style).toBe('abyss-cultivator');
  });
});

// ── Suite 9: cmdApplyPersona (project-level) ──

describe('cmdApplyPersona (project-level)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-ap-'));
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'abyss', label: 'Abyss', file: 'abyss.md', default: true, builtin: true },
        { slug: 'gentle-mentor', label: '御前教师', file: 'gentle-mentor.md', default: false },
      ],
    }, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(personaDir, 'gentle-mentor.md'), validPersona, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('项目级切换人格', () => {
    const result = cmdApplyPersona('gentle-mentor', false, null, tmpDir);
    expect(result.scope).toBe('project');
    expect(result.slug).toBe('gentle-mentor');
    expect(result.hint).toContain('npx code-abyss');

    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config', 'personas', 'index.json'), 'utf8'));
    expect(data.personas.find(p => p.slug === 'gentle-mentor').default).toBe(true);
    expect(data.personas.find(p => p.slug === 'abyss').default).toBe(false);
  });

  test('无效 slug 报错', () => {
    expect(() => cmdApplyPersona('missing', false, null, tmpDir))
      .toThrow(/不存在/);
  });
});

// ── Suite 10: cmdApplyStyle (project-level) ──

describe('cmdApplyStyle (project-level)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-as-'));
    const styleDir = path.join(tmpDir, 'output-styles');
    fs.mkdirSync(styleDir, { recursive: true });
    fs.writeFileSync(path.join(styleDir, 'index.json'), JSON.stringify({
      styles: [
        { slug: 'abyss-cultivator', label: 'Abyss', file: 'ac.md', default: true, builtin: true },
        { slug: 'spring-breeze', label: '春风化雨', file: 'sb.md', default: false },
      ],
    }, null, 2) + '\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('项目级切换风格', () => {
    const result = cmdApplyStyle('spring-breeze', false, null, tmpDir);
    expect(result.scope).toBe('project');
    expect(result.slug).toBe('spring-breeze');

    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'output-styles', 'index.json'), 'utf8'));
    expect(data.styles.find(s => s.slug === 'spring-breeze').default).toBe(true);
  });
});

// ── Suite 11: cmdRemove ──

describe('cmdRemove', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-rm-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('删除用户创建的 persona 并保留文件', () => {
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    const personaFile = path.join(personaDir, 'custom.md');
    fs.writeFileSync(personaFile, validPersona, 'utf8');
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'abyss', label: 'Abyss', file: 'abyss.md', default: true, builtin: true },
        { slug: 'custom', label: 'Custom', file: 'custom.md', default: false },
      ],
    }, null, 2) + '\n', 'utf8');

    const result = cmdRemove('personas', 'custom', tmpDir);
    expect(result.slug).toBe('custom');
    expect(fs.existsSync(result.preservedFile)).toBe(true);

    const data = JSON.parse(fs.readFileSync(path.join(personaDir, 'index.json'), 'utf8'));
    expect(data.personas).toHaveLength(1);
  });

  test('拒绝删除 builtin 条目', () => {
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'abyss', label: 'Abyss', file: 'abyss.md', default: true, builtin: true },
      ],
    }, null, 2) + '\n', 'utf8');

    expect(() => cmdRemove('personas', 'abyss', tmpDir))
      .toThrow(/系统预设/);
  });

  test('拒绝删除唯一的 default 条目', () => {
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'custom', label: 'Custom', file: 'c.md', default: true },
      ],
    }, null, 2) + '\n', 'utf8');

    expect(() => cmdRemove('personas', 'custom', tmpDir))
      .toThrow(/默认项/);
  });
});

// ── Suite 12: CLI 错误处理 ──

describe('CLI error handling', () => {
  test('无参数输出帮助并 exit 1', () => {
    const result = spawnSync(process.execPath, [soulScript], { encoding: 'utf8' });
    expect(result.status).toBe(1);
  });

  test('--help 输出帮助并 exit 0', () => {
    const result = spawnSync(process.execPath, [soulScript, '--help'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('soul');
  });

  test('未知命令报错', () => {
    const result = spawnSync(process.execPath, [soulScript, 'unknown'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('未知命令');
  });

  test('validate 缺少文件报错', () => {
    const result = spawnSync(process.execPath, [soulScript, 'validate', 'persona'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
  });

  test('create 缺少参数报错', () => {
    const result = spawnSync(process.execPath, [soulScript, 'create'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
  });

  test('apply 缺少 slug 报错', () => {
    const result = spawnSync(process.execPath, [soulScript, 'apply', 'persona'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
  });

  test('remove 缺少 slug 报错', () => {
    const result = spawnSync(process.execPath, [soulScript, 'remove', 'persona'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
  });
});

// ── Suite 13: CLI 正常流程 (端到端) ──

describe('CLI e2e flows', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'soul-test-e2e-'));
    const personaDir = path.join(tmpDir, 'config', 'personas');
    fs.mkdirSync(personaDir, { recursive: true });
    fs.writeFileSync(path.join(personaDir, 'index.json'), JSON.stringify({
      personas: [
        { slug: 'abyss', label: 'Abyss', file: 'abyss.md', default: true, builtin: true },
        { slug: 'custom', label: 'Custom', file: 'custom.md', default: false },
      ],
    }, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(personaDir, 'abyss.md'), validPersona, 'utf8');
    fs.writeFileSync(path.join(personaDir, 'custom.md'), validPersona, 'utf8');

    const styleDir = path.join(tmpDir, 'output-styles');
    fs.mkdirSync(styleDir, { recursive: true });
    fs.writeFileSync(path.join(styleDir, 'index.json'), JSON.stringify({
      styles: [
        { slug: 'abyss-cultivator', label: 'AC', file: 'ac.md', default: true, builtin: true },
        { slug: 'spring-breeze', label: 'SB', file: 'sb.md', default: false },
      ],
    }, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(styleDir, 'ac.md'), validStyle, 'utf8');
    fs.writeFileSync(path.join(styleDir, 'sb.md'), validStyle, 'utf8');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('list personas 输出 JSON', () => {
    const result = spawnSync(process.execPath, [soulScript, 'list', 'personas', '--project-root', tmpDir], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data).toHaveLength(2);
  });

  test('list styles 输出 JSON', () => {
    const result = spawnSync(process.execPath, [soulScript, 'list', 'styles', '--project-root', tmpDir], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data).toHaveLength(2);
  });

  test('current 项目级', () => {
    const result = spawnSync(process.execPath, [soulScript, 'current', '--project-root', tmpDir], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    const data = JSON.parse(result.stdout);
    expect(data.scope).toBe('project');
    expect(data.persona).toBe('abyss');
    expect(data.style).toBe('abyss-cultivator');
  });

  test('validate persona 通过', () => {
    const personaPath = path.join(tmpDir, 'config', 'personas', 'abyss.md');
    const result = spawnSync(process.execPath, [soulScript, 'validate', 'persona', personaPath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('校验通过');
  });

  test('validate style 通过', () => {
    const stylePath = path.join(tmpDir, 'output-styles', 'ac.md');
    const result = spawnSync(process.execPath, [soulScript, 'validate', 'style', stylePath], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('校验通过');
  });

  test('create persona 写入文件并更新索引', () => {
    const src = path.join(tmpDir, 'new-persona.md');
    fs.writeFileSync(src, validPersona, 'utf8');

    const result = spawnSync(process.execPath, [
      soulScript, 'create', 'persona', 'new-persona', src, '--project-root', tmpDir,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('已写入');
    expect(fs.existsSync(path.join(tmpDir, 'config', 'personas', 'new-persona.md'))).toBe(true);

    const idx = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config', 'personas', 'index.json'), 'utf8'));
    expect(idx.personas.some(p => p.slug === 'new-persona')).toBe(true);
  });

  test('create style 写入文件并更新索引', () => {
    const src = path.join(tmpDir, 'new-style.md');
    fs.writeFileSync(src, validStyle, 'utf8');

    const result = spawnSync(process.execPath, [
      soulScript, 'create', 'style', 'new-style', src, '--project-root', tmpDir,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('已写入');
    expect(fs.existsSync(path.join(tmpDir, 'output-styles', 'new-style.md'))).toBe(true);

    const idx = JSON.parse(fs.readFileSync(path.join(tmpDir, 'output-styles', 'index.json'), 'utf8'));
    expect(idx.styles.some(s => s.slug === 'new-style')).toBe(true);
  });

  test('apply persona 切换默认', () => {
    const result = spawnSync(process.execPath, [
      soulScript, 'apply', 'persona', 'custom', '--project-root', tmpDir,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('已切至');

    const idx = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config', 'personas', 'index.json'), 'utf8'));
    expect(idx.personas.find(p => p.slug === 'custom').default).toBe(true);
    expect(idx.personas.find(p => p.slug === 'abyss').default).toBe(false);
  });

  test('apply style 切换默认', () => {
    const result = spawnSync(process.execPath, [
      soulScript, 'apply', 'style', 'spring-breeze', '--project-root', tmpDir,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('已切至');

    const idx = JSON.parse(fs.readFileSync(path.join(tmpDir, 'output-styles', 'index.json'), 'utf8'));
    expect(idx.styles.find(s => s.slug === 'spring-breeze').default).toBe(true);
  });

  test('remove persona 删除自定义条目保留文件', () => {
    const result = spawnSync(process.execPath, [
      soulScript, 'remove', 'persona', 'custom', '--project-root', tmpDir,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('已从索引移除');
    expect(fs.existsSync(path.join(tmpDir, 'config', 'personas', 'custom.md'))).toBe(true);

    const idx = JSON.parse(fs.readFileSync(path.join(tmpDir, 'config', 'personas', 'index.json'), 'utf8'));
    expect(idx.personas.some(p => p.slug === 'custom')).toBe(false);
  });

  test('remove builtin 被拒绝', () => {
    const result = spawnSync(process.execPath, [
      soulScript, 'remove', 'persona', 'abyss', '--project-root', tmpDir,
    ], { encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('系统预设');
  });
});
