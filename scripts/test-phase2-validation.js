// scripts/test-phase2-validation.js
/**
 * 第二阶段功能验证脚本
 * 验证微信小程序用户注册和角色管理系统的第二阶段功能
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
 * 测试1: 验证角色申请功能
 */
async function testRoleApplication() {
  const startTime = Date.now();
  try {
    const testApplication = {
      role: 'social_worker',
      reason: '这是一个验证脚本提交的测试申请，用于验证角色申请功能是否正常工作。申请理由长度足够，符合系统要求。',
      phone: '13800138000',
      email: 'test@example.com',
      attachments: []
    };

    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'submitRoleApplication',
        ...testApplication
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      recordTest('角色申请提交', true, `角色申请提交成功: ${testApplication.role}`, duration);
      return true;
    } else {
      recordTest('角色申请提交', false, result.result?.error?.message || '角色申请提交失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('角色申请提交', false, `角色申请提交异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试2: 验证邀请码创建功能
 */
async function testInviteCodeCreation() {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'volunteer',
        uses: 1,
        description: '测试邀请码'
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      const { code } = result.result.data;
      recordTest('邀请码创建', true, `邀请码创建成功: ${code}`, duration);
      return { success: true, code };
    } else {
      recordTest('邀请码创建', false, result.result?.error?.message || '邀请码创建失败', duration);
      return { success: false };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('邀请码创建', false, `邀请码创建异常: ${error.message}`, duration);
    return { success: false };
  }
}

/**
 * 测试3: 验证邀请码验证功能
 */
async function testInviteCodeValidation(inviteCode) {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'validateInviteCode',
        code: inviteCode
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success && result.result.data.valid) {
      recordTest('邀请码验证', true, `邀请码验证成功: ${inviteCode}`, duration);
      return true;
    } else {
      recordTest('邀请码验证', false, result.result?.error?.message || '邀请码验证失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('邀请码验证', false, `邀请码验证异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试4: 验证邀请码使用功能
 */
async function testInviteCodeUsage(inviteCode) {
  const startTime = Date.now();
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'useInviteCode',
        code: inviteCode
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      recordTest('邀请码使用', true, `邀请码使用成功，获得角色: ${result.result.data.role}`, duration);
      return true;
    } else {
      recordTest('邀请码使用', false, result.result?.error?.message || '邀请码使用失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('邀请码使用', false, `邀请码使用异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试5: 验证申请状态查询功能
 */
async function testApplicationStatusQuery() {
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
      recordTest('申请状态查询', false, result.result?.error?.message || '申请状态查询失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('申请状态查询', false, `申请状态查询异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试6: 验证用户资料更新功能
 */
async function testUserProfileUpdate() {
  const startTime = Date.now();
  try {
    const testProfile = {
      realName: '测试用户' + Date.now(),
      gender: 'male',
      phone: '13900139000',
      email: 'updated@example.com',
      occupation: 'social_worker',
      organization: '更新测试机构',
      bio: '这是一个通过验证脚本更新的测试用户资料，用于验证资料更新功能是否正常工作。'
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
      recordTest('用户资料更新', false, result.result?.error?.message || '用户资料更新失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('用户资料更新', false, `用户资料更新异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试7: 验证数据库集成
 */
async function testDatabaseIntegration() {
  const startTime = Date.now();
  try {
    // 检查各个集合是否存在
    const collections = ['users', 'role_applications', 'invite_codes'];
    const results = [];

    for (const collectionName of collections) {
      try {
        const count = await db.collection(collectionName).count();
        results.push({
          collection: collectionName,
          count: count.total,
          success: true
        });
      } catch (error) {
        results.push({
          collection: collectionName,
          error: error.message,
          success: false
        });
      }
    }

    const duration = Date.now() - startTime;
    const allSuccess = results.every(r => r.success);

    if (allSuccess) {
      const summary = results.map(r => `${r.collection}: ${r.count}`).join(', ');
      recordTest('数据库集成验证', true, `所有集合正常: ${summary}`, duration);
    } else {
      const failed = results.filter(r => !r.success).map(r => r.collection).join(', ');
      recordTest('数据库集成验证', false, `部分集合异常: ${failed}`, duration);
    }

    return allSuccess;
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('数据库集成验证', false, `数据库集成验证异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 测试8: 验证权限系统
 */
async function testPermissionSystem() {
  const startTime = Date.now();
  try {
    // 测试权限查询
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getCurrentUser'
      }
    });

    const duration = Date.now() - startTime;

    if (result.result && result.result.success) {
      const user = result.result.data;
      const roles = user.roles || [];
      const permissions = user.permissions || [];

      recordTest('权限系统验证', true,
        `用户权限正常 - 角色: ${roles.join(', ')}, 权限: ${permissions.length}个`,
        duration
      );
      return true;
    } else {
      recordTest('权限系统验证', false, result.result?.error?.message || '权限系统验证失败', duration);
      return false;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    recordTest('权限系统验证', false, `权限系统验证异常: ${error.message}`, duration);
    return false;
  }
}

/**
 * 主测试函数
 */
async function runPhase2Validation() {
  console.log('🚀 开始第二阶段功能验证测试...\n');

  console.log('📋 测试项目:');
  console.log('1. 角色申请提交功能');
  console.log('2. 邀请码创建功能');
  console.log('3. 邀请码验证功能');
  console.log('4. 邀请码使用功能');
  console.log('5. 申请状态查询功能');
  console.log('6. 用户资料更新功能');
  console.log('7. 数据库集成验证');
  console.log('8. 权限系统验证');
  console.log('');

  // 测试序列
  console.log('🔄 开始执行测试序列...\n');

  // 1. 测试角色申请
  await testRoleApplication();
  await sleep(1000);

  // 2. 测试邀请码创建
  const inviteResult = await testInviteCodeCreation();
  await sleep(1000);

  // 3-4. 如果邀请码创建成功，测试验证和使用
  if (inviteResult.success) {
    await testInviteCodeValidation(inviteResult.code);
    await sleep(1000);

    await testInviteCodeUsage(inviteResult.code);
    await sleep(1000);
  } else {
    console.log('⚠️ 跳过邀请码验证和使用测试（创建失败）');
  }

  // 5. 测试申请状态查询
  await testApplicationStatusQuery();
  await sleep(1000);

  // 6. 测试用户资料更新
  await testUserProfileUpdate();
  await sleep(1000);

  // 7. 测试数据库集成
  await testDatabaseIntegration();
  await sleep(1000);

  // 8. 测试权限系统
  await testPermissionSystem();
  await sleep(1000);

  // 记录结束时间
  testResults.endTime = new Date();
  const totalDuration = testResults.endTime - testResults.startTime;

  // 输出测试结果
  console.log('\n📊 第二阶段功能验证结果:');
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

  console.log('\n🎉 第二阶段功能验证完成！');

  // 输出第二阶段特性总结
  console.log('\n🌟 第二阶段新增功能特性:');
  console.log('✅ 角色申请页面 - 完整的角色申请流程');
  console.log('✅ 邀请码激活页面 - 邀请码验证和激活功能');
  console.log('✅ 权限管理页面 - 用户权限查看和管理');
  console.log('✅ 权限帮助页面 - 详细的权限使用指南');
  console.log('✅ 统一认证流程 - 应用级别的权限控制');
  console.log('✅ 患者系统集成 - 在现有系统中集成权限检查');

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
module.exports = { runPhase2Validation };

// 如果直接运行此脚本
if (require.main === module) {
  runPhase2Validation().then(result => {
    console.log('\n📄 第二阶段测试总结:');
    console.log(`测试结果: ${result.success ? '全部通过' : '存在失败'}`);
    console.log(`成功率: ${result.successRate}%`);
    console.log(`总耗时: ${result.duration}ms`);

    process.exit(result.success ? 0 : 1);
  }).catch(error => {
    console.error('验证脚本运行失败:', error);
    process.exit(1);
  });
}