// cloudfunctions/rbac/test-first-stage.js
/**
 * RBAC云函数第一阶段功能测试
 * 测试用户注册和权限管理功能
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  details: []
};

/**
 * 测试结果记录
 */
function recordTest(testName, success, details = '') {
  const result = {
    name: testName,
    success,
    details,
    timestamp: new Date().toISOString()
  };

  testResults.details.push(result);

  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}: ${details}`);
  } else {
    testResults.failed++;
    console.error(`❌ ${testName}: ${details}`);
  }
}

/**
 * 等待函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试用户资料更新功能
 */
async function testUpdateProfile() {
  try {
    // 获取一个测试用户（这里使用系统时间作为测试标识）
    const testOpenId = `test_user_${Date.now()}`;

    // 先确保用户存在
    try {
      await db.collection('users').add({
        data: {
          openid: testOpenId,
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });
    } catch (error) {
      // 用户可能已存在，忽略错误
      if (error.errCode !== -501002) {
        console.warn('创建测试用户失败:', error);
      }
    }

    // 模拟用户资料
    const testProfile = {
      realName: '测试用户',
      gender: 'male',
      phone: '13800138000',
      email: 'test@example.com',
      occupation: 'social_worker',
      organization: '测试机构',
      bio: '这是一个测试用户'
    };

    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'updateProfile',
        profile: testProfile
      }
    });

    if (result.result && result.result.success) {
      recordTest('用户资料更新', true, '资料更新成功');
      return true;
    } else {
      recordTest('用户资料更新', false, result.result?.error?.message || '未知错误');
      return false;
    }
  } catch (error) {
    recordTest('用户资料更新', false, error.message);
    return false;
  }
}

/**
 * 测试邀请码验证功能
 */
async function testValidateInviteCode() {
  try {
    // 测试无效邀请码
    const result1 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'validateInviteCode',
        code: 'INVALID'
      }
    });

    if (!result1.result || !result1.result.success) {
      recordTest('邀请码验证-无效码', false, result1.result?.error?.message || '未知错误');
      return false;
    }

    if (result1.result.data.valid) {
      recordTest('邀请码验证-无效码', false, '无效码被识别为有效');
      return false;
    }

    recordTest('邀请码验证-无效码', true, '正确识别无效邀请码');
    return true;
  } catch (error) {
    recordTest('邀请码验证-无效码', false, error.message);
    return false;
  }
}

/**
 * 测试角色申请提交功能
 */
async function testSubmitRoleApplication() {
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'submitRoleApplication',
        role: 'social_worker',
        reason: '这是一个测试申请，用于验证角色申请功能是否正常工作。申请理由长度足够，符合系统要求。',
        attachments: []
      }
    });

    if (result.result && result.result.success) {
      recordTest('角色申请提交', true, '申请提交成功');
      return true;
    } else {
      recordTest('角色申请提交', false, result.result?.error?.message || '未知错误');
      return false;
    }
  } catch (error) {
    recordTest('角色申请提交', false, error.message);
    return false;
  }
}

/**
 * 测试获取当前用户信息
 */
async function testGetCurrentUser() {
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getCurrentUser'
      }
    });

    if (result.result && result.result.success) {
      const { userId, openid, roles, displayName } = result.result.data;

      if (userId && openid) {
        recordTest('获取用户信息', true, `用户ID: ${userId}, 角色: ${roles.join(', ')}`);
        return true;
      } else {
        recordTest('获取用户信息', false, '返回的用户信息不完整');
        return false;
      }
    } else {
      recordTest('获取用户信息', false, result.result?.error?.message || '未知错误');
      return false;
    }
  } catch (error) {
    recordTest('获取用户信息', false, error.message);
    return false;
  }
}

/**
 * 测试申请状态查询
 */
async function testGetApplicationStatus() {
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getApplicationStatus'
      }
    });

    if (result.result && result.result.success) {
      recordTest('申请状态查询', true, `找到 ${result.result.data.applications.length} 个申请记录`);
      return true;
    } else {
      recordTest('申请状态查询', false, result.result?.error?.message || '未知错误');
      return false;
    }
  } catch (error) {
    recordTest('申请状态查询', false, error.message);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runTests() {
  console.log('🚀 开始RBAC云函数第一阶段功能测试...\n');

  console.log('📋 测试列表:');
  console.log('1. 获取当前用户信息');
  console.log('2. 用户资料更新');
  console.log('3. 邀请码验证');
  console.log('4. 角色申请提交');
  console.log('5. 申请状态查询');
  console.log('');

  // 运行测试
  await testGetCurrentUser();
  await sleep(500);

  await testUpdateProfile();
  await sleep(500);

  await testValidateInviteCode();
  await sleep(500);

  await testSubmitRoleApplication();
  await sleep(500);

  await testGetApplicationStatus();
  await sleep(500);

  // 输出测试结果
  console.log('\n📊 测试结果:');
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`📈 成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.details.filter(test => !test.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.details}`);
    });
  }

  console.log('\n🎉 RBAC云函数第一阶段测试完成!');

  return testResults.failed === 0;
}

// 导出测试函数
exports.main = async (event, context) => {
  try {
    const success = await runTests();

    return {
      success,
      message: success ? '所有测试通过' : '部分测试失败',
      results: testResults
    };
  } catch (error) {
    console.error('测试运行失败:', error);

    return {
      success: false,
      message: error.message,
      error: error.stack
    };
  }
};