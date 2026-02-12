#!/usr/bin/env python3
"""
Skills 运行入口
跨平台统一调用各 skill 脚本

用法:
    python run_skill.py <skill_name> [args...]

示例:
    python run_skill.py verify-module ./my-project -v
    python run_skill.py verify-security ./src --json
    python run_skill.py verify-change --mode staged
    python run_skill.py verify-quality ./src
    python run_skill.py gen-docs ./new-module --force
"""

import sys
import subprocess
import hashlib
import tempfile
from pathlib import Path
import os

IS_WIN = sys.platform == 'win32'
if IS_WIN:
    import msvcrt
else:
    import fcntl


def get_skills_dir() -> Path:
    """获取 skills 目录路径（跨平台）"""
    override = os.environ.get("SAGE_SKILLS_DIR")
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parent


def discover_skills(skills_dir: Path) -> dict:
    """自动发现 tools/ 下所有 skill（按目录结构扫描）"""
    found = {}
    tools_dir = skills_dir / "tools"
    if not tools_dir.is_dir():
        return found
    for skill_dir in sorted(tools_dir.iterdir()):
        if not skill_dir.is_dir():
            continue
        scripts_dir = skill_dir / "scripts"
        if not scripts_dir.is_dir():
            continue
        py_files = list(scripts_dir.glob("*.py"))
        if py_files:
            found[skill_dir.name] = py_files[0]
    return found


def get_script_path(skill_name: str) -> Path:
    """获取 skill 脚本路径"""
    skills_dir = get_skills_dir()
    available = discover_skills(skills_dir)

    if skill_name not in available:
        names = ", ".join(available.keys()) if available else "(无)"
        print(f"错误: 未知的 skill '{skill_name}'")
        print(f"可用的 skills: {names}")
        sys.exit(1)

    return available[skill_name]


def acquire_target_lock(args: list):
    """按目标路径获取文件锁，同路径串行，不同路径并行。返回 (lock_fd, lock_path) 或 (None, None)"""
    # 从参数中提取目标路径（第一个非 flag 参数）
    target = None
    for a in args:
        if not a.startswith('-'):
            target = a
            break
    if not target:
        target = os.getcwd()

    target = str(Path(target).resolve())
    lock_name = "sage_skill_" + hashlib.md5(target.encode()).hexdigest()[:12] + ".lock"
    lock_path = Path(tempfile.gettempdir()) / lock_name

    fd = open(lock_path, 'w')
    if IS_WIN:
        import time
        for _ in range(300):  # 最多等 30s
            try:
                msvcrt.locking(fd.fileno(), msvcrt.LK_NBLCK, 1)
                return fd, lock_path
            except OSError:
                time.sleep(0.1)
        print(f"⏳ 等待锁超时: {target}")
        msvcrt.locking(fd.fileno(), msvcrt.LK_LOCK, 1)
    else:
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            print(f"⏳ 等待锁释放: {target}")
            fcntl.flock(fd, fcntl.LOCK_EX)  # 阻塞等待
    return fd, lock_path


def release_lock(fd):
    """释放文件锁"""
    if not fd:
        return
    try:
        if IS_WIN:
            msvcrt.locking(fd.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        fd.close()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    skill_name = sys.argv[1]

    if skill_name in ["-h", "--help"]:
        print(__doc__)
        sys.exit(0)

    script_path = get_script_path(skill_name)
    args = sys.argv[2:]

    # 按目标路径加锁，防止多 Agent 同时操作同一目录
    lock_fd, lock_path = acquire_target_lock(args)

    # 使用 sys.executable 确保使用当前 Python 解释器
    cmd = [sys.executable, str(script_path)] + args

    try:
        result = subprocess.run(cmd)
        sys.exit(result.returncode)
    except KeyboardInterrupt:
        print("\n已取消")
        sys.exit(130)
    except Exception as e:
        print(f"执行错误: {e}")
        sys.exit(1)
    finally:
        release_lock(lock_fd)


if __name__ == "__main__":
    main()
