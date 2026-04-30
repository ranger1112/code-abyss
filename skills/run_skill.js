#!/usr/bin/env node
/**
 * Skills 运行入口
 * 跨平台统一调用各 skill 脚本
 *
 * 用法:
 *     node run_skill.js <skill_name> [args...]
 *
 * 示例:
 *     node run_skill.js verify-module ./my-project -v
 *     node run_skill.js verify-security ./src --json
 *     node run_skill.js verify-change --mode staged
 *     node run_skill.js verify-quality ./src
 *     node run_skill.js gen-docs ./new-module --force
 */

const { spawn } = require('child_process');
const { unlinkSync, closeSync, openSync, statSync, existsSync, readdirSync, readFileSync } = require('fs');
const { join, resolve } = require('path');
const { createHash } = require('crypto');
const { tmpdir } = require('os');
const { resolveExecutableSkillScript } = require('../bin/lib/skill-registry');
const { parseFrontmatter } = require('../bin/lib/utils');

function getSkillsDir() {
  const override = process.env.SAGE_SKILLS_DIR;
  if (override) return resolve(override);
  return __dirname;
}

function sleep(ms) {
  return new Promise(resolveSleep => setTimeout(resolveSleep, ms));
}

function getScriptEntry(skillName) {
  const skillsDir = getSkillsDir();

  // 快速路径：仅查找目标 skill，不做全量扫描
  const tolerant = findSkillTolerant(skillsDir, skillName, true);
  if (tolerant) return tolerant;

  // 回退标准路径：通过 collectSkills() 全量校验查找（用于列出所有 skills 等场景）
  try {
    const { skill, scriptPath, reason } = resolveExecutableSkillScript(skillsDir, skillName);

    if (reason === 'missing') {
      console.error(`错误: 未知的 skill '${skillName}'. Try: node run_skill.js --help to list available skills`);
      process.exit(1);
    }

    if (reason === 'no-script') {
      console.error(`错误: skill '${skillName}' 的 runtimeType 不是 scripted`);
      console.error(`请先阅读: ${skill.skillPath}`);
      process.exit(1);
    }

    return { skill, scriptPath };
  } catch (_) {
    // collectSkills() 因其他 skill frontmatter 不合法而全局失败
    console.error(`错误: 未知的 skill '${skillName}'.`);
    process.exit(1);
  }
}

function findSkillTolerant(skillsDir, skillName, silent) {
  const categories = ['tools', 'domains', 'orchestration'];

  for (const cat of categories) {
    const catDir = join(skillsDir, cat);
    if (!existsSync(catDir)) continue;

    let entries;
    try { entries = readdirSync(catDir, { withFileTypes: true }); } catch { continue; }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = join(catDir, entry.name, 'SKILL.md');
      if (!existsSync(skillMd)) continue;

      try {
        const content = readFileSync(skillMd, 'utf8');
        const meta = parseFrontmatter(content);
        if (!meta || meta.name !== skillName) continue;

        // 按 skill 目录名推断脚本路径（而非 SKILL.md 的 name 字段）
        const scriptsDir = join(catDir, entry.name, 'scripts');
        if (!existsSync(scriptsDir)) {
          if (!silent) {
            console.error(`错误: skill '${skillName}' 的 runtimeType 不是 scripted`);
          }
          return silent ? null : process.exit(1);
        }

        // 找 scripts/ 下唯一的 .js 文件
        let scriptPath = null;
        try {
          const scripts = readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
          if (scripts.length === 1) {
            scriptPath = join(scriptsDir, scripts[0]);
          }
        } catch {}

        if (!scriptPath) {
          if (!silent) {
            console.error(`错误: skill '${skillName}' 没有可执行的脚本入口`);
          }
          return silent ? null : process.exit(1);
        }

        return {
          skill: {
            name: meta.name,
            relPath: join(cat, entry.name),
            skillPath: skillMd,
            runtimeType: 'scripted',
          },
          scriptPath,
        };
      } catch {
        // 该 skill 的 frontmatter 有问题，继续找
      }
    }
  }

  if (silent) return null;
  console.error(`错误: 未知的 skill '${skillName}'.`);
  process.exit(1);
}

const STALE_LOCK_MAX_AGE_MS = 60000;

function isStaleLock(lockPath) {
  try {
    const stat = statSync(lockPath);
    return (Date.now() - stat.mtimeMs) > STALE_LOCK_MAX_AGE_MS;
  } catch { return false; }
}

async function acquireTargetLock(args) {
  const target = args.find(a => !a.startsWith('-')) || process.cwd();
  const hash = createHash('md5').update(resolve(target)).digest('hex').slice(0, 12);
  const lockPath = join(tmpdir(), `sage_skill_${hash}.lock`);

  const deadline = Date.now() + 30000;
  let first = true;
  while (true) {
    try {
      const fd = openSync(lockPath, 'wx');
      return { fd, lockPath, target };
    } catch (e) {
      if (e.code !== 'EEXIST') return { fd: null, lockPath: null, target };
      if (first) {
        console.log(`⏳ 等待锁释放: ${target}`);
        first = false;
      }
      // Stale lock cleanup: if lock file is older than threshold, remove it
      if (isStaleLock(lockPath)) {
        console.log(`⏳ 检测到过期锁，尝试清理: ${lockPath}`);
        try { unlinkSync(lockPath); } catch { /* best-effort */ }
        continue;
      }
      if (Date.now() >= deadline) {
        console.error(`⏳ 等待锁超时: ${target}. Try: rm ${lockPath}`);
        process.exit(1);
      }
      await sleep(200);
    }
  }
}

function releaseLock({ fd, lockPath }) {
  if (fd !== null) {
    try { closeSync(fd); } catch {}
  }
  if (lockPath) {
    try { unlinkSync(lockPath); } catch {}
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(__filename.split('/').pop() + ' <skill_name> [args...]');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const skillName = args[0];
  const { scriptPath } = getScriptEntry(skillName);
  const scriptArgs = args.slice(1);
  const lock = await acquireTargetLock(scriptArgs);

  const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
    stdio: 'inherit',
  });

  child.on('close', (code) => {
    releaseLock(lock);
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    console.error(`执行错误: ${err.message}`);
    releaseLock(lock);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\n已取消');
    child.kill('SIGINT');
    releaseLock(lock);
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    console.log('\n已终止');
    child.kill('SIGTERM');
    releaseLock(lock);
    process.exit(143);
  });
}

main().catch((err) => {
  console.error(`执行错误: ${err.message}`);
  process.exit(1);
});
