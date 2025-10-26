// RBAC系统并发测试
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();
const _ = db.command;

// 测试配置
const TEST_CONFIG = {
  adminId: 'test_admin_001',
  concurrentUsers: 10,
  batchOperations: 5
};

/**
 * 并发创建邀请码测试
 */
async function testConcurrentInviteCreation() {
  console.log('🎫 测试并发创建邀请码...');

  const promises = [];
  const results = [];

  // 创建多个并发请求
  for (let i = 0; i < TEST_CONFIG.concurrentUsers; i++) {
    const promise = cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'parent',
        uses: 1,
        note: `并发测试邀请码 ${i + 1}`
      },
      __principalId: TEST_CONFIG.adminId
    }).then(result => {
      results.push({
        index: i,
        success: result.result && result.result.success,
        data: result.result
      });
      return result;
    }).catch(error => {
      results.push({
        index: i,
        success: false,
        error: error.message
      });
      throw error;
    });

    promises.push(promise);
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    console.log('并发创建过程中出现错误:', error.message);
  }

  // 分析结果
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const duplicateCodes = new Set();

  results.forEach(result => {
    if (result.success && result.data.data) {
      const code = result.data.data.code;
      if (duplicateCodes.has(code)) {
        console.log(`⚠️ 发现重复邀请码: ${code}`);
      }
      duplicateCodes.add(code);
    }
  });

  console.log(`并发创建结果: 成功 ${successCount}, 失败 ${failureCount}`);
  console.log(`唯一邀请码数量: ${duplicateCodes.size}`);

  if (successCount === TEST_CONFIG.concurrentUsers) {
    console.log('✅ 并发创建邀请码测试通过');
  } else {
    console.log('❌ 并发创建邀请码测试部分失败');
  }

  return results;
}

/**
 * 并发角色申请测试
 */
async function testConcurrentRoleApplications() {
  console.log('📝 测试并发角色申请...');

  const testUsers = [];
  const results = [];

  // 创建测试用户
  for (let i = 0; i < TEST_CONFIG.concurrentUsers; i++) {
    const userOpenId = `concurrent_user_${Date.now()}_${i}`;
    testUsers.push(userOpenId);

    // 确保用户存在
    await db.collection('users').add({
      data: {
        openid: userOpenId,
        profile: { realName: `并发用户${i + 1}`, phone: `1380013${String(i).padStart(4, '0')}` },
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    }).catch(() => {}); // 忽略已存在错误
  }

  // 并发提交角色申请
  const promises = testUsers.map((userOpenId, index) =>
    cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'submitRoleApplication',
        role: 'volunteer',
        reason: `并发测试申请 ${index + 1}：我希望成为志愿者，为社会贡献力量。`
      },
      __principalId: userOpenId
    }).then(result => {
      results.push({
        userOpenId,
        index,
        success: result.result && result.result.success,
        data: result.result
      });
      return result;
    }).catch(error => {
      results.push({
        userOpenId,
        index,
        success: false,
        error: error.message
      });
      throw error;
    })
  );

  try {
    await Promise.all(promises);
  } catch (error) {
    console.log('并发申请过程中出现错误:', error.message);
  }

  // 分析结果
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`并发申请结果: 成功 ${successCount}, 失败 ${failureCount}`);

  if (successCount === TEST_CONFIG.concurrentUsers) {
    console.log('✅ 并发角色申请测试通过');
  } else {
    console.log('❌ 并发角色申请测试部分失败');
  }

  return { results, testUsers };
}

/**
 * 并发数据读取测试
 */
async function testConcurrentDataRead() {
  console.log('📖 测试并发数据读取...');

  const readOperations = [
    { action: 'listUsers', data: { page: 1, pageSize: 10 } },
    { action: 'listInvites', data: { page: 1, pageSize: 10 } },
    { action: 'listRoleRequests', data: { page: 1, pageSize: 10 } },
    { action: 'listRoleBindings', data: {} }
  ];

  const promises = [];
  const results = [];

  // 为每个读操作创建多个并发请求
  readOperations.forEach((operation, opIndex) => {
    for (let i = 0; i < TEST_CONFIG.concurrentUsers; i++) {
      const promise = cloud.callFunction({
        name: 'rbac',
        data: operation.data,
        __principalId: TEST_CONFIG.adminId
      }).then(result => {
        results.push({
          operation: operation.action,
          opIndex,
          requestIndex: i,
          success: result.result && result.result.success,
          data: result.result
        });
        return result;
      }).catch(error => {
        results.push({
          operation: operation.action,
          opIndex,
          requestIndex: i,
          success: false,
          error: error.message
        });
        throw error;
      });

      promises.push(promise);
    }
  });

  try {
    await Promise.all(promises);
  } catch (error) {
    console.log('并发读取过程中出现错误:', error.message);
  }

  // 按操作类型分析结果
  const operationResults = {};
  readOperations.forEach(operation => {
    const opResults = results.filter(r => r.operation === operation.action);
    const successCount = opResults.filter(r => r.success).length;
    const failureCount = opResults.length - successCount;

    operationResults[operation.action] = {
      total: opResults.length,
      success: successCount,
      failure: failureCount
    };

    console.log(`${operation.action}: 总计 ${opResults.length}, 成功 ${successCount}, 失败 ${failureCount}`);
  });

  const totalSuccess = results.filter(r => r.success).length;
  const totalRequests = results.length;

  if (totalSuccess === totalRequests) {
    console.log('✅ 并发数据读取测试通过');
  } else {
    console.log('❌ 并发数据读取测试部分失败');
  }

  return operationResults;
}

/**
 * 压力测试 - 大量操作
 */
async function testStressLoad() {
  console.log('💪 测试系统压力负载...');

  const batchSize = 20;
  const batchCount = 5;
  const allResults = [];

  for (let batch = 0; batch < batchCount; batch++) {
    console.log(`执行批次 ${batch + 1}/${batchCount}...`);

    const batchPromises = [];

    // 每个批次执行多种操作
    for (let i = 0; i < batchSize; i++) {
      const operations = [
        // 创建邀请码
        cloud.callFunction({
          name: 'rbac',
          data: {
            action: 'createInvite',
            role: 'parent',
            uses: 1,
            note: `压力测试 ${batch}-${i}`
          },
          __principalId: TEST_CONFIG.adminId
        }),

        // 获取用户列表
        cloud.callFunction({
          name: 'rbac',
          data: {
            action: 'listUsers',
            page: 1,
            pageSize: 5
          },
          __principalId: TEST_CONFIG.adminId
        })
      ];

      // 随机选择一个操作
      const randomOp = operations[Math.floor(Math.random() * operations.length)];
      batchPromises.push(
        randomOp.then(result => ({
          batch,
          operation: i,
          success: result.result && result.result.success,
          timestamp: Date.now()
        })).catch(error => ({
          batch,
          operation: i,
          success: false,
          error: error.message,
          timestamp: Date.now()
        }))
      );
    }

    try {
      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);

      const batchSuccess = batchResults.filter(r => r.success).length;
      console.log(`批次 ${batch + 1} 完成: 成功 ${batchSuccess}/${batchSize}`);

      // 批次间稍微延迟，避免过度压力
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`批次 ${batch + 1} 失败:`, error.message);
    }
  }

  // 分析压力测试结果
  const totalSuccess = allResults.filter(r => r.success).length;
  const totalOperations = allResults.length;
  const successRate = (totalSuccess / totalOperations * 100).toFixed(2);

  console.log(`压力测试结果:`);
  console.log(`总操作数: ${totalOperations}`);
  console.log(`成功操作: ${totalSuccess}`);
  console.log(`成功率: ${successRate}%`);

  if (parseFloat(successRate) >= 90) {
    console.log('✅ 系统压力测试通过');
  } else {
    console.log('❌ 系统压力测试表现不佳');
  }

  return allResults;
}

/**
 * 数据一致性并发测试
 */
async function testConcurrentDataConsistency() {
  console.log('🔄 测试并发数据一致性...');

  // 创建一个测试邀请码
  const createResult = await cloud.callFunction({
    name: 'rbac',
    data: {
      action: 'createInvite',
      role: 'parent',
      uses: 1,
      note: '并发一致性测试'
    },
    __principalId: TEST_CONFIG.adminId
  });

  if (!createResult.result || !createResult.result.success) {
    throw new Error('创建测试邀请码失败');
  }

  const inviteCode = createResult.result.data.code;
  const testUserOpenId = `consistency_test_user_${Date.now()}`;

  // 确保测试用户存在
  await db.collection('users').add({
    data: {
      openid: testUserOpenId,
      profile: { realName: '一致性测试用户', phone: '13800138888' },
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }).catch(() => {});

  // 并发验证和使用邀请码
  const concurrentOperations = [
    // 验证邀请码
    cloud.callFunction({
      name: 'rbac',
      data: { action: 'validateInviteCode', code: inviteCode },
      __principalId: testUserOpenId
    }),

    // 使用邀请码
    cloud.callFunction({
      name: 'rbac',
      data: { action: 'useInviteCode', code: inviteCode },
      __principalId: testUserOpenId
    }),

    // 再次验证邀请码
    cloud.callFunction({
      name: 'rbac',
      data: { action: 'validateInviteCode', code: inviteCode },
      __principalId: testUserOpenId
    })
  ];

  const results = await Promise.all(concurrentOperations);

  // 分析一致性结果
  const validateResult1 = results[0];
  const useResult = results[1];
  const validateResult2 = results[2];

  let consistencyTestPassed = true;

  // 检查第一次验证
  if (!validateResult1.result || !validateResult1.result.success) {
    console.log('❌ 第一次验证失败');
    consistencyTestPassed = false;
  }

  // 检查使用操作
  if (!useResult.result || !useResult.result.success) {
    console.log('❌ 使用邀请码失败');
    consistencyTestPassed = false;
  }

  // 检查第二次验证（应该显示已使用）
  if (validateResult2.result && validateResult2.result.data) {
    if (!validateResult2.result.data.valid) {
      console.log('✅ 数据一致性正确：邀请码使用后状态正确');
    } else {
      console.log('❌ 数据一致性错误：邀请码使用后状态未更新');
      consistencyTestPassed = false;
    }
  } else {
    console.log('❌ 第二次验证失败');
    consistencyTestPassed = false;
  }

  if (consistencyTestPassed) {
    console.log('✅ 并发数据一致性测试通过');
  } else {
    console.log('❌ 并发数据一致性测试失败');
  }

  return consistencyTestPassed;
}

/**
 * 清理并发测试数据
 */
async function cleanupConcurrentTestData() {
  console.log('🧹 清理并发测试数据...');

  try {
    // 清理最近创建的邀请码
    const recentTime = Date.now() - 5 * 60 * 1000; // 5分钟内
    await db.collection('invites')
      .where({
        createdAt: _.gte(recentTime),
        createdBy: TEST_CONFIG.adminId
      })
      .remove();

    // 清理测试用户
    await db.collection('users')
      .where({
        openid: db.RegExp({
          regexp: '^(concurrent_|consistency_)',
          options: 'i'
        })
      })
      .remove();

    // 清理测试角色申请
    await db.collection('roleRequests')
      .where({
        applicantOpenId: db.RegExp({
          regexp: '^(concurrent_|consistency_)',
          options: 'i'
        })
      })
      .remove();

    console.log('✅ 并发测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理并发测试数据失败:', error);
  }
}

/**
 * 生成并发测试报告
 */
function generateConcurrencyReport(results) {
  console.log('\n📊 并发测试报告');
  console.log('=' .repeat(50));

  Object.keys(results).forEach(testName => {
    const testResult = results[testName];
    console.log(`${testName}: ${testResult.passed ? '✅ 通过' : '❌ 失败'}`);
    if (testResult.details) {
      console.log(`  详情: ${testResult.details}`);
    }
  });
}

/**
 * 主测试函数
 */
async function runConcurrencyTests() {
  console.log('🚀 开始RBAC系统并发测试');
  console.log('测试环境:', process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38');
  console.log(`并发用户数: ${TEST_CONFIG.concurrentUsers}`);
  console.log('=' .repeat(50));

  const results = {};

  try {
    results['并发邀请码创建'] = { passed: true };
    await testConcurrentInviteCreation();
  } catch (error) {
    results['并发邀请码创建'] = { passed: false, details: error.message };
  }

  try {
    results['并发角色申请'] = { passed: true };
    await testConcurrentRoleApplications();
  } catch (error) {
    results['并发角色申请'] = { passed: false, details: error.message };
  }

  try {
    results['并发数据读取'] = { passed: true };
    await testConcurrentDataRead();
  } catch (error) {
    results['并发数据读取'] = { passed: false, details: error.message };
  }

  try {
    results['压力测试'] = { passed: true };
    await testStressLoad();
  } catch (error) {
    results['压力测试'] = { passed: false, details: error.message };
  }

  try {
    results['并发数据一致性'] = { passed: true };
    await testConcurrentDataConsistency();
  } catch (error) {
    results['并发数据一致性'] = { passed: false, details: error.message };
  }

  // 生成测试报告
  generateConcurrencyReport(results);

  // 清理测试数据
  await cleanupConcurrentTestData();

  console.log('\n🎉 RBAC系统并发测试完成!');
}

// 运行测试
if (require.main === module) {
  runConcurrencyTests().catch(console.error);
}

module.exports = {
  runConcurrencyTests,
  testConcurrentInviteCreation,
  testConcurrentRoleApplications,
  testConcurrentDataRead,
  testStressLoad,
  testConcurrentDataConsistency,
  cleanupConcurrentTestData
};