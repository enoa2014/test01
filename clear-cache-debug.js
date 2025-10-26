// 简单的缓存清理脚本，用于调试
console.log('🧹 清理小程序缓存的建议步骤:');
console.log('1. 在微信开发者工具中:');
console.log('   - 点击 "清缓存" → "清除数据缓存"');
console.log('   - 点击 "清缓存" → "清除文件缓存"');
console.log('   - 重新编译项目');
console.log('');
console.log('2. 在代码中添加调试:');
console.log('   - 在 pages/index/index.js 的 fetchPatients 方法开头添加:');
console.log('   - console.log("开始获取患者数据...");');
console.log('   - 在 try 块中添加详细日志');
console.log('');
console.log('3. 检查可能的问题:');
console.log('   - ApiClient.callPatientProfile 的返回结构');
console.log('   - CacheManager 是否正确清除缓存');
console.log('   - 云函数是否正常返回数据');

// 检查当前 index.js 的 fetchPatients 实现
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'miniprogram', 'pages', 'index', 'index.js');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');

  console.log('\n📝 当前 fetchPatients 方法的关键部分:');
  const lines = content.split('\n');
  let inFetchPatients = false;
  let braceCount = 0;

  lines.forEach((line, index) => {
    if (line.includes('async fetchPatients')) {
      inFetchPatients = true;
      console.log(`${index + 1}: ${line}`);
    } else if (inFetchPatients) {
      if (line.includes('{')) braceCount++;
      if (line.includes('}')) braceCount--;

      if (braceCount >= 0) {
        console.log(`${index + 1}: ${line}`);
      }

      if (braceCount === 0 && line.includes('}')) {
        inFetchPatients = false;
      }
    }
  });
} else {
  console.log('❌ 找不到 index.js 文件');
}
