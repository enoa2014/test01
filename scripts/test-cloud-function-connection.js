// scripts/test-cloud-function-connection.js
/**
 * 测试云函数连接和基础功能
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: 'cloud1-6g2fzr5f7cf51e38'
});

async function testBasicConnection() {
  try {
    console.log('🔄 测试RBAC云函数基础连接...');

    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'ping'
      }
    });

    console.log('📤 云函数响应:', JSON.stringify(result, null, 2));

    if (result.result && result.result.success) {
      console.log('✅ 云函数连接成功！');
      return true;
    } else {
      console.log('❌ 云函数连接失败:', result.result?.error?.message || '未知错误');
      return false;
    }
  } catch (error) {
    console.error('❌ 云函数连接异常:', error);
    return false;
  }
}

async function testGetCurrentUser() {
  try {
    console.log('🔄 测试获取当前用户信息...');

    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getCurrentUser'
      }
    });

    console.log('📤 用户信息响应:', JSON.stringify(result, null, 2));

    if (result.result && result.result.success) {
      console.log('✅ 获取用户信息成功！');
      return true;
    } else {
      console.log('❌ 获取用户信息失败:', result.result?.error?.message || '未知错误');
      return false;
    }
  } catch (error) {
    console.error('❌ 获取用户信息异常:', error);
    return false;
  }
}

async function runTests() {
  console.log('🚀 开始云函数连接测试...\n');

  const connectionResult = await testBasicConnection();
  console.log('');

  const userResult = await testGetCurrentUser();
  console.log('');

  if (connectionResult && userResult) {
    console.log('🎉 所有基础测试通过！云函数部署成功。');
  } else {
    console.log('⚠️ 部分测试失败，需要进一步检查。');
  }
}

// 运行测试
runTests().catch(error => {
  console.error('测试运行失败:', error);
});