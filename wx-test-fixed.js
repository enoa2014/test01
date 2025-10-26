/**
 * 微信开发者工具测试脚本（修复版）
 * 复制此代码到微信开发者工具控制台中执行
 */

console.log('=== 微信开发者工具修复版测试 ===');

// 测试1: 环境测试
console.log('\n🧪 测试1: 环境测试');
wx.cloud.callFunction({
  name: 'testQrGeneration',
  data: { testType: 'env' }
}).then(res => {
  console.log('✅ 环境测试结果:', res);
  if (res.result && res.result.success) {
    console.log('🎉 环境测试成功!');
    console.log('云环境:', res.result.environment.env);
    console.log('AppID:', res.result.environment.appId);
  } else {
    console.log('❌ 环境测试失败:', res.result?.error || res.result?.message);
  }
}).catch(err => {
  console.error('❌ 环境测试失败:', err);
});

// 测试2: 修复后的基础功能测试
setTimeout(() => {
  console.log('\n🧪 测试2: 修复后的基础功能测试');
  wx.cloud.callFunction({
    name: 'testQrGeneration',
    data: { testType: 'basic' }
  }).then(res => {
    console.log('✅ 基础功能测试结果:', res);
    if (res.result && res.result.success) {
      console.log('🎉 修复后的基础功能测试成功!');
      console.log('测试码:', res.result.testCode);
      console.log('文件ID:', res.result.fileID);
      console.log('临时链接:', res.result.tempURL);

      // 如果成功，测试显示二维码
      if (res.result.tempURL) {
        console.log('📱 二维码链接:', res.result.tempURL);
        console.log('💡 可以在浏览器中打开此链接查看二维码');
      }
    } else {
      console.log('❌ 基础功能测试失败:', res.result?.error || res.result?.message);
      console.log('详情:', res.result?.details || '');

      // 显示修复建议
      if (res.result?.suggestions && res.result.suggestions.length > 0) {
        console.log('\n💡 修复建议:');
        res.result.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
    }
  }).catch(err => {
    console.error('❌ 基础功能测试失败:', err);
  });
}, 2000);

// 测试3: 参数组合测试
setTimeout(() => {
  console.log('\n🧪 测试3: 参数组合测试');
  wx.cloud.callFunction({
    name: 'testQrGeneration',
    data: { testType: 'parameters' }
  }).then(res => {
    console.log('✅ 参数组合测试结果:', res);
    if (res.result && res.result.success) {
      console.log('🎉 参数组合测试成功!');
    } else {
      console.log('❌ 参数组合测试失败:', res.result?.error || res.result?.message);
    }
  }).catch(err => {
    console.error('❌ 参数组合测试失败:', err);
  });
}, 4000);

// 测试4: 完整流程测试
setTimeout(() => {
  console.log('\n🧪 测试4: 完整流程测试');
  wx.cloud.callFunction({
    name: 'testQrGeneration',
    data: { testType: 'full' }
  }).then(res => {
    console.log('✅ 完整流程测试结果:', res);
    if (res.result && res.result.success) {
      console.log('🎉 完整流程测试成功!');
      console.log('邀请码:', res.result.code);
      console.log('邀请ID:', res.result.inviteId);
      console.log('文件ID:', res.result.fileId);
      console.log('临时链接:', res.result.url);

      if (res.result.url) {
        console.log('📱 邀请二维码链接:', res.result.url);
        console.log('💡 可以在浏览器中打开此链接查看二维码');
      }
    } else {
      console.log('❌ 完整流程测试失败:', res.result?.error || res.result?.message);
      console.log('详情:', res.result?.details || '');

      if (res.result?.inviteCreated) {
        console.log('✅ 但邀请创建成功:');
        console.log('  邀请码:', res.result.inviteCreated.code);
        console.log('  邀请ID:', res.result.inviteCreated.inviteId);
      }

      if (res.result?.suggestions && res.result.suggestions.length > 0) {
        console.log('\n💡 解决建议:');
        res.result.suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion}`);
        });
      }
    }
  }).catch(err => {
    console.error('❌ 完整流程测试失败:', err);
  });
}, 6000);

console.log('\n📋 测试脚本已执行，请等待结果...');
console.log('💡 修复内容:');
console.log('   1. 添加了 check_path: false 参数');
console.log('   2. 添加了 env_version: "release" 参数');
console.log('   3. 改进了错误处理和建议');
console.log('   4. 添加了参数组合测试');