// scripts/test-phase1-validation.js
/**
 * 第一阶段功能验证脚本
 * 用于验证用户注册和角色管理系统的完整功能
 */

const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  details: [],
  startTime: new Date(),
  endTime: null
};

/**
 * 测试结果记录
 */
function recordTest(testName, success, details = '', duration = 0) {
  const result = {
    name: testName,
    success,
    details,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  };

  testResults.details.push(result);

  if (success) {
    testResults.passed++;
    console.log(`✅ ${testName}: ${details} (${duration}ms)`);
  } else {
    testResults.failed++;
    console.error(`❌ ${testName}: ${details} (${duration}ms)`);
  }
}

/**
 * 等待函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 测试1: 验证云函数基础连接
 */
async function testCloudFunctionConnection() {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'ping'
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      recordTest('云函数连接测试', true, 'RBAC云函数响应正常', duration);
      return true;
    } else {
      recordTest('云函数连接测试', false, result.result?.error?.message || '云函数响应异常', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('云函数连接测试', false, `连接失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试2: 用户资料更新功能
 */
async function testUserProfileUpdate() {
  const startTime = Date.now();
  try {
    const testProfile = {
      realName: '测试用户' + Date.now(),
      gender: 'male',
      phone: '13800138000',
      email: 'test@example.com',
      occupation: 'social_worker',
      organization: '测试机构',
      bio: '这是一个通过验证脚本创建的测试用户'
    };

    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'updateProfile',
        profile: testProfile
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      recordTest('用户资料更新', true, `用户资料更新成功: ${testProfile.realName}`, duration);
      return true;
    } else {
      recordTest('用户资料更新', false, result.result?.error?.message || '资料更新失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('用户资料更新', false, `更新失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试3: 获取当前用户信息
 */
async function testGetCurrentUser() {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getCurrentUser'
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      const { userId, openid, roles, displayName } = result.result.data;

      if (userId && openid) {
        recordTest('获取用户信息', true, `用户ID: ${userId}, 角色: ${roles.join(', ')}`, duration);
        return true;
      } else {
        recordTest('获取用户信息', false, '返回的用户信息不完整', duration);
        return false;
      }
    } else {
      recordTest('获取用户信息', false, result.result?.error?.message || '获取用户信息失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('获取用户信息', false, `获取失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试4: 邀请码创建和验证流程
 */
async function testInviteCodeFlow() {
  const startTime = Date.now();

  try {
    // 4.1 创建邀请码
    const createResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'social_worker',
        uses: 1,
        description: '测试邀请码'
      }
    });

    if (!createResult.result || !createResult.result.success) {
      const duration = Date.now() - startTime;
      recordTest('邀请码流程', false, `创建邀请码失败: ${createResult.result?.error?.message || '未知错误'}`, duration);
      return false;
    }

    const { code } = createResult.result.data;
    await sleep(1000);

    // 4.2 验证邀请码
    const validateResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'validateInviteCode',
        code: code
      }
    });

    const duration = Date.now() - startTime;

    if (!validateResult.result || !validateResult.result.success) {
      recordTest('邀请码流程', false, `邀请码验证失败: ${validateResult.result?.error?.message || '未知错误'}`, duration);
      return false;
    }

    if (!validateResult.result.data.valid) {
      recordTest('邀请码流程', false, '新创建的邀请码验证失败', duration);
      return false;
    }

    recordTest('邀请码流程', true, `邀请码创建和验证流程正常，邀请码: ${code}`, duration);
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('邀请码流程', false, `流程测试失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试5: 角色申请提交
 */
async function testRoleApplication() {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'submitRoleApplication',
        role: 'social_worker',
        reason: '这是一个验证脚本提交的测试申请，用于验证角色申请功能是否正常工作。申请理由长度足够，符合系统要求。',
        attachments: []
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      recordTest('角色申请提交', true, '角色申请提交成功', duration);
      return true;
    } else {
      recordTest('角色申请提交', false, result.result?.error?.message || '申请提交失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('角色申请提交', false, `提交失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试6: 申请状态查询
 */
async function testApplicationStatus() {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getApplicationStatus'
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      const applications = result.result.data.applications;
      recordTest('申请状态查询', true, `找到 ${applications.length} 个申请记录`, duration);
      return true;
    } else {
      recordTest('申请状态查询', false, result.result?.error?.message || '状态查询失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('申请状态查询', false, `查询失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试7: 邀请码使用功能
 */
async function testInviteCodeUsage() {
  const startTime = Date.now();

  try {
    // 7.1 先创建一个测试邀请码
    const createResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'volunteer',
        uses: 1,
        description: '测试使用邀请码'
      }
    });

    if (!createResult.result || !createResult.result.success) {
      const duration = Date.now() - startTime;
      recordTest('邀请码使用测试', false, `创建测试邀请码失败`, duration);
      return false;
    }

    const { code } = createResult.result.data;
    await sleep(1000);

    // 7.2 使用邀请码
    const useResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'useInviteCode',
        code: code
      }
    });

    const duration = Date.now() - startTime;

    if (useResult.result && useResult.result.success) {
      recordTest('邀请码使用测试', true, `成功使用邀请码获得角色: ${useResult.result.data.role}`, duration);
      return true;
    } else {
      recordTest('邀请码使用测试', false, `使用邀请码失败: ${useResult.result?.error?.message || '未知错误'}`, duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('邀请码使用测试', false, `使用测试失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试8: 数据库集成验证
 */
async function testDatabaseIntegration() {
  const startTime = Date.now();
  try {
    // 检查users集合是否存在
    const usersCount = await db.collection('users').count();

    // 检查role_applications集合是否存在
    const applicationsCount = await db.collection('role_applications').count();

    // 检查invite_codes集合是否存在
    const invitesCount = await db.collection('invite_codes').count();

    const duration = Date.now() - startTime;

    recordTest('数据库集成验证', true,
      `Users: ${usersCount.total}, Applications: ${applicationsCount.total}, Invites: ${invitesCount.total}`,
      duration
    );

    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('数据库集成验证', false, `数据库检查失败: ${error.message}`, duration);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runPhase1Validation() {
  console.log('🚀 开始第一阶段功能验证测试...\n');

  console.log('📋 测试项目:');
  console.log('1. 云函数连接测试');
  console.log('2. 用户资料更新功能');
  console.log('3. 获取当前用户信息');
  console.log('4. 邀请码创建和验证流程');
  console.log('5. 角色申请提交');
  console.log('6. 申请状态查询');
  console.log('7. 邀请码使用功能');
  console.log('8. 数据库集成验证');
  console.log('');

  // 运行所有测试
  const tests = [
    testCloudFunctionConnection,
    testGetCurrentUser,
    testUserProfileUpdate,
    testInviteCodeFlow,
    testRoleApplication,
    testApplicationStatus,
    testInviteCodeUsage,
    testDatabaseIntegration
  ];

  for (const test of tests) {
    await test();
    await sleep(1000); // 测试间隔1秒
  }

  // 记录结束时间
  testResults.endTime = new Date();
  const totalDuration = testResults.endTime - testResults.startTime;

  // 输出测试结果
  console.log('\n📊 第一阶段功能验证结果:');
  console.log(`✅ 通过: ${testResults.passed}`);
  console.log(`❌ 失败: ${testResults.failed}`);
  console.log(`📈 成功率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  console.log(`⏱️ 总耗时: ${totalDuration}ms`);

  if (testResults.failed > 0) {
    console.log('\n❌ 失败的测试:');
    testResults.details.filter(test => !test.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.details} (${test.duration})`);
    });
  }

  console.log('\n📋 详细测试结果:');
  testResults.details.forEach(test => {
    const status = test.success ? '✅' : '❌';
    console.log(`   ${status} ${test.name}: ${test.details} (${test.duration})`);
  });

  console.log('\n🎉 第一阶段功能验证完成!');

  // 返回测试结果
  return {
    success: testResults.failed === 0,
    totalTests: testResults.passed + testResults.failed,
    passed: testResults.passed,
    failed: testResults.failed,
    successRate: ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1),
    duration: totalDuration,
    details: testResults.details
  };
}

// 导出测试函数
module.exports = { runPhase1Validation };

// 如果直接运行此脚本
if (require.main === module) {
  runPhase1Validation().then(result => {
    console.log('\n📄 测试总结:');
    console.log(`测试结果: ${result.success ? '全部通过' : '存在失败'}`);
    console.log(`成功率: ${result.successRate}%`);
    console.log(`总耗时: ${result.duration}ms`);

    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('验证脚本运行失败:', error);
    process.exit(1);
  });
}