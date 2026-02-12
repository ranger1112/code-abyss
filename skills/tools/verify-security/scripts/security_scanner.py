#!/usr/bin/env python3
"""
代码安全扫描器
检测常见安全漏洞模式：注入、硬编码密钥、危险函数等
"""

import os
import re
import sys
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum


class Severity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


@dataclass
class Finding:
    severity: Severity
    category: str
    message: str
    file_path: str
    line_number: int
    line_content: str
    recommendation: str


@dataclass
class ScanResult:
    scan_path: str
    files_scanned: int = 0
    findings: List[Finding] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return not any(f.severity in [Severity.CRITICAL, Severity.HIGH] for f in self.findings)

    def count_by_severity(self) -> Dict[str, int]:
        counts = {s.value: 0 for s in Severity}
        for f in self.findings:
            counts[f.severity.value] += 1
        return counts


# 安全检测规则
SECURITY_RULES = [
    # SQL 注入
    {
        "id": "SQL_INJECTION_DYNAMIC",
        "category": "注入",
        "severity": Severity.CRITICAL,
        "pattern": r'\b(execute|query|raw)\s*\(\s*(f["\']|["\'][^"\'\n]*["\']\s*\+\s*|["\'][^"\'\n]*["\']\s*%\s*[^,\)]|["\'][^"\'\n]*["\']\.format\s*\()',
        "extensions": [".py", ".js", ".ts", ".go", ".java", ".php"],
        "message": "可能存在 SQL 注入风险",
        "recommendation": "使用参数化查询或 ORM"
    },
    {
        "id": "SQL_INJECTION_FSTRING",
        "category": "注入",
        "severity": Severity.CRITICAL,
        "pattern": r'cursor\.(execute|executemany)\s*\(\s*f["\']',
        "extensions": [".py"],
        "message": "使用 f-string 构造 SQL 语句",
        "recommendation": "使用参数化查询: cursor.execute('SELECT * FROM t WHERE id = %s', (id,))"
    },
    # 命令注入
    {
        "id": "COMMAND_INJECTION",
        "category": "注入",
        "severity": Severity.CRITICAL,
        "pattern": r'(os\.system|os\.popen|subprocess\.call|subprocess\.run|subprocess\.Popen)\s*\([^)]*shell\s*=\s*True',
        "extensions": [".py"],
        "message": "使用 shell=True 可能导致命令注入",
        "recommendation": "避免 shell=True，使用列表参数"
    },
    {
        "id": "COMMAND_INJECTION_EVAL",
        "category": "注入",
        "severity": Severity.CRITICAL,
        "pattern": r'\b(eval|exec)\s*\([^)]*\b(input|request|argv|args)',
        "extensions": [".py"],
        "message": "eval/exec 执行用户输入",
        "recommendation": "避免对用户输入使用 eval/exec"
    },
    # 硬编码密钥
    {
        "id": "HARDCODED_SECRET",
        "category": "敏感信息",
        "severity": Severity.HIGH,
        "pattern": r'(?<!\w)(password|passwd|pwd|secret|api_key|apikey|token|auth_token)\s*=\s*["\'][^"\']{8,}["\']',
        "exclude_pattern": r'(example|placeholder|changeme|xxx|your[_-]|TODO|FIXME|<.*>|\*{3,})',
        "extensions": [".py", ".js", ".ts", ".go", ".java", ".php", ".rb", ".yaml", ".yml", ".json", ".env"],
        "message": "可能存在硬编码密钥/密码",
        "recommendation": "使用环境变量或密钥管理服务"
    },
    {
        "id": "HARDCODED_AWS_KEY",
        "category": "敏感信息",
        "severity": Severity.CRITICAL,
        "pattern": r'AKIA[0-9A-Z]{16}',
        "extensions": ["*"],
        "message": "发现 AWS Access Key",
        "recommendation": "立即轮换密钥，使用 IAM 角色或环境变量"
    },
    {
        "id": "HARDCODED_PRIVATE_KEY",
        "category": "敏感信息",
        "severity": Severity.CRITICAL,
        "pattern": r'-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----',
        "extensions": ["*"],
        "message": "发现私钥",
        "recommendation": "私钥不应提交到代码库"
    },
    # XSS
    {
        "id": "XSS_INNERHTML",
        "category": "XSS",
        "severity": Severity.HIGH,
        "pattern": r'\.innerHTML\s*=|\.outerHTML\s*=|document\.write\s*\(',
        "extensions": [".js", ".ts", ".jsx", ".tsx", ".html"],
        "message": "直接操作 innerHTML 可能导致 XSS",
        "recommendation": "使用 textContent 或框架的安全绑定"
    },
    {
        "id": "XSS_DANGEROUSLY",
        "category": "XSS",
        "severity": Severity.MEDIUM,
        "pattern": r'dangerouslySetInnerHTML',
        "extensions": [".js", ".ts", ".jsx", ".tsx"],
        "message": "使用 dangerouslySetInnerHTML",
        "recommendation": "确保内容已经过净化处理"
    },
    # 不安全的反序列化
    {
        "id": "UNSAFE_PICKLE",
        "category": "反序列化",
        "severity": Severity.HIGH,
        "pattern": r'pickle\.loads?\s*\(|yaml\.load\s*\([^)]*Loader\s*=\s*yaml\.Loader',
        "extensions": [".py"],
        "message": "不安全的反序列化",
        "recommendation": "使用 yaml.safe_load() 或验证数据来源"
    },
    # 弱加密
    {
        "id": "WEAK_CRYPTO_MD5",
        "category": "加密",
        "severity": Severity.MEDIUM,
        "pattern": r'\b(md5|MD5)\s*\(|hashlib\.md5\s*\(',
        "extensions": [".py", ".js", ".ts", ".go", ".java", ".php"],
        "message": "使用弱哈希算法 MD5",
        "recommendation": "密码存储使用 bcrypt/argon2，完整性校验使用 SHA-256+"
    },
    {
        "id": "WEAK_CRYPTO_SHA1",
        "category": "加密",
        "severity": Severity.LOW,
        "pattern": r'\b(sha1|SHA1)\s*\(|hashlib\.sha1\s*\(',
        "extensions": [".py", ".js", ".ts", ".go", ".java", ".php"],
        "message": "使用弱哈希算法 SHA1",
        "recommendation": "使用 SHA-256 或更强的算法"
    },
    # 路径遍历
    {
        "id": "PATH_TRAVERSAL",
        "category": "路径遍历",
        "severity": Severity.HIGH,
        "pattern": r'(open|read|write|Path|os\.path\.join)\s*\([^\n]*(request|input|argv|args|params|query|form|path_param)\b',
        "extensions": [".py"],
        "message": "可能存在路径遍历风险",
        "recommendation": "验证并规范化用户输入的路径"
    },
    # SSRF
    {
        "id": "SSRF",
        "category": "SSRF",
        "severity": Severity.HIGH,
        "pattern": r'(requests\.(get|post|put|delete|head)|urllib\.request\.urlopen)\s*\([^\n]*(request|input|argv|args|params|query|url)\b',
        "extensions": [".py"],
        "message": "可能存在 SSRF 风险",
        "recommendation": "验证并限制目标 URL"
    },
    # 调试代码
    {
        "id": "DEBUG_CODE",
        "category": "调试",
        "severity": Severity.LOW,
        "pattern": r'\b(console\.log|debugger|pdb\.set_trace|breakpoint)\s*\(',
        "extensions": [".py", ".js", ".ts"],
        "message": "发现调试代码",
        "recommendation": "生产环境移除调试代码"
    },
    # 不安全的随机数
    {
        "id": "INSECURE_RANDOM",
        "category": "加密",
        "severity": Severity.MEDIUM,
        "pattern": r'\brandom\.(random|randint|choice|shuffle)\s*\(',
        "extensions": [".py"],
        "message": "使用不安全的随机数生成器",
        "recommendation": "安全场景使用 secrets 模块"
    },
    # XXE
    {
        "id": "XXE",
        "category": "XXE",
        "severity": Severity.HIGH,
        "pattern": r'etree\.(parse|fromstring)\s*\([^)]*\)|xml\.dom\.minidom\.parse',
        "extensions": [".py"],
        "message": "XML 解析可能存在 XXE 风险",
        "recommendation": "禁用外部实体: parser = etree.XMLParser(resolve_entities=False)"
    },
]


def scan_file(file_path: Path, rules: List[Dict]) -> List[Finding]:
    """扫描单个文件"""
    findings = []
    suffix = file_path.suffix.lower()

    try:
        content = file_path.read_text(encoding='utf-8', errors='ignore')
        lines = content.split('\n')
    except Exception:
        return findings

    for rule in rules:
        # 检查文件扩展名
        extensions = rule.get("extensions", ["*"])
        if "*" not in extensions and suffix not in extensions:
            continue

        pattern = re.compile(rule["pattern"], re.IGNORECASE)

        for line_num, line in enumerate(lines, 1):
            # 跳过注释行
            stripped = line.strip()
            if stripped.startswith('#') or stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
                continue

            if pattern.search(line):
                # 排除已知安全模式（如 placeholder、example）
                exclude = rule.get("exclude_pattern")
                if exclude and re.search(exclude, line, re.IGNORECASE):
                    continue

                findings.append(Finding(
                    severity=rule["severity"],
                    category=rule["category"],
                    message=rule["message"],
                    file_path=str(file_path),
                    line_number=line_num,
                    line_content=line.strip()[:100],
                    recommendation=rule["recommendation"]
                ))

    return findings


def scan_directory(path: str, exclude_dirs: List[str] = None) -> ScanResult:
    """扫描目录"""
    scan_path = Path(path).resolve()
    result = ScanResult(scan_path=str(scan_path))

    if exclude_dirs is None:
        exclude_dirs = ['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', '.tox', 'tests', 'test', '__tests__', 'spec']

    code_extensions = {'.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.java', '.php', '.rb', '.yaml', '.yml', '.json'}

    for file_path in scan_path.rglob('*'):
        # 跳过排除目录
        if any(ex in file_path.parts for ex in exclude_dirs):
            continue

        if file_path.is_file() and file_path.suffix.lower() in code_extensions:
            result.files_scanned += 1
            findings = scan_file(file_path, SECURITY_RULES)
            result.findings.extend(findings)

    # 按严重程度排序
    severity_order = {Severity.CRITICAL: 0, Severity.HIGH: 1, Severity.MEDIUM: 2, Severity.LOW: 3, Severity.INFO: 4}
    result.findings.sort(key=lambda f: severity_order[f.severity])

    return result


def format_report(result: ScanResult, verbose: bool = False) -> str:
    """格式化扫描报告"""
    lines = []
    lines.append("=" * 60)
    lines.append("代码安全扫描报告")
    lines.append("=" * 60)
    lines.append(f"\n扫描路径: {result.scan_path}")
    lines.append(f"扫描文件: {result.files_scanned}")
    lines.append(f"扫描结果: {'✓ 通过' if result.passed else '✗ 发现高危问题'}")

    counts = result.count_by_severity()
    lines.append(f"\n严重: {counts['critical']} | 高危: {counts['high']} | 中危: {counts['medium']} | 低危: {counts['low']}")

    if result.findings:
        lines.append("\n" + "-" * 40)
        lines.append("发现问题:")
        lines.append("-" * 40)

        severity_icons = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🔵",
            "info": "⚪"
        }

        for finding in result.findings:
            icon = severity_icons[finding.severity.value]
            lines.append(f"\n{icon} [{finding.severity.value.upper()}] {finding.category}")
            lines.append(f"   文件: {finding.file_path}:{finding.line_number}")
            lines.append(f"   问题: {finding.message}")
            if verbose:
                lines.append(f"   代码: {finding.line_content}")
            lines.append(f"   建议: {finding.recommendation}")

    lines.append("\n" + "=" * 60)
    return "\n".join(lines)


def main():
    import argparse

    parser = argparse.ArgumentParser(description="代码安全扫描器")
    parser.add_argument("path", nargs="?", default=".", help="扫描路径")
    parser.add_argument("-v", "--verbose", action="store_true", help="详细输出")
    parser.add_argument("--json", action="store_true", help="JSON 格式输出")
    parser.add_argument("--exclude", nargs="*", default=[], help="排除目录")

    args = parser.parse_args()

    exclude_dirs = ['.git', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build', 'tests', 'test', '__tests__', 'spec'] + args.exclude
    result = scan_directory(args.path, exclude_dirs)

    if args.json:
        output = {
            "scan_path": result.scan_path,
            "files_scanned": result.files_scanned,
            "passed": result.passed,
            "counts": result.count_by_severity(),
            "findings": [
                {
                    "severity": f.severity.value,
                    "category": f.category,
                    "message": f.message,
                    "file_path": f.file_path,
                    "line_number": f.line_number,
                    "line_content": f.line_content,
                    "recommendation": f.recommendation
                }
                for f in result.findings
            ]
        }
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print(format_report(result, args.verbose))

    sys.exit(0 if result.passed else 1)


if __name__ == "__main__":
    main()
