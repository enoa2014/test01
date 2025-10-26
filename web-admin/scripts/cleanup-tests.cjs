#!/usr/bin/env node

/**
 * 测试文件清理脚本
 * 用于清理和优化测试文件结构
 */

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '../src/hooks/__tests__');

// 测试文件清理配置
const CLEANUP_CONFIG = {
  // 保留的主要测试文件
  keep: [
    'useCloudFunction.test.ts'
  ],
  // 可以清理的测试变体文件
  cleanup: [
    'useCloudFunction.simple.test.ts',
    'useCloudFunction.complete.test.ts',
    'useCloudFunction.optimized.test.ts'
  ]
};

function listTestFiles() {
  console.log('📋 当前Hook测试文件:');
  const files = fs.readdirSync(TESTS_DIR);
  files.forEach(file => {
    const filePath = path.join(TESTS_DIR, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024).toFixed(1);
    console.log(`  📄 ${file} (${size}KB)`);
  });
}

function cleanupVariants() {
  console.log('\n🧹 清理测试变体文件...');

  CLEANUP_CONFIG.cleanup.forEach(file => {
    const filePath = path.join(TESTS_DIR, file);
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + '.backup';

      // 创建备份
      fs.copyFileSync(filePath, backupPath);
      console.log(`  ✅ 已备份: ${file} -> ${file}.backup`);

      // 删除原文件
      fs.unlinkSync(filePath);
      console.log(`  🗑️  已删除: ${file}`);
    }
  });
}

function restoreBackups() {
  console.log('\n🔄 恢复备份文件...');

  CLEANUP_CONFIG.cleanup.forEach(file => {
    const backupPath = path.join(TESTS_DIR, file + '.backup');
    if (fs.existsSync(backupPath)) {
      const filePath = path.join(TESTS_DIR, file);
      fs.copyFileSync(backupPath, filePath);
      console.log(`  ✅ 已恢复: ${file}`);
    }
  });
}

function showStats() {
  console.log('\n📊 测试统计信息:');

  const files = fs.readdirSync(TESTS_DIR);
  const totalFiles = files.filter(f => f.endsWith('.test.ts')).length;
  const backupFiles = files.filter(f => f.endsWith('.backup')).length;

  console.log(`  📄 测试文件: ${totalFiles}个`);
  console.log(`  💾 备份文件: ${backupFiles}个`);

  // 计算总大小
  let totalSize = 0;
  files.forEach(file => {
    const filePath = path.join(TESTS_DIR, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
  });

  console.log(`  💾 总大小: ${(totalSize / 1024).toFixed(1)}KB`);
}

// 主程序
function main() {
  const command = process.argv[2];

  console.log('🔧 测试文件清理工具\n');

  switch (command) {
    case 'list':
      listTestFiles();
      showStats();
      break;

    case 'cleanup':
      listTestFiles();
      cleanupVariants();
      showStats();
      console.log('\n✨ 清理完成！变体测试文件已移至备份。');
      break;

    case 'restore':
      restoreBackups();
      listTestFiles();
      showStats();
      console.log('\n✨ 恢复完成！备份文件已恢复。');
      break;

    case 'stats':
      showStats();
      break;

    default:
      console.log('用法:');
      console.log('  node scripts/cleanup-tests.cjs list      - 列出测试文件');
      console.log('  node scripts/cleanup-tests.cjs cleanup   - 清理变体文件');
      console.log('  node scripts/cleanup-tests.cjs restore   - 恢复备份文件');
      console.log('  node scripts/cleanup-tests.cjs stats     - 显示统计信息');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  listTestFiles,
  cleanupVariants,
  restoreBackups,
  showStats
};