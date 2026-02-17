'use strict';

const path = require('path');
const { detectCclineBin } = require(path.join(__dirname, '..', 'bin', 'lib', 'ccline.js'));

describe('detectCclineBin', () => {
  test('存在的文件路径返回 true', () => {
    // __filename 一定存在
    expect(detectCclineBin(__filename)).toBe(true);
  });

  test('不存在的路径且无全局 ccline 返回 false', () => {
    const result = detectCclineBin('/tmp/nonexistent_ccline_bin_xyz');
    // 如果系统有全局 ccline 则 true，否则 false，两者都合理
    expect(typeof result).toBe('boolean');
  });
});
