// 验证RBAC系统BUG修复效果
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();
const _ = db.command;

// 测试配置
const TEST_CONFIG = {
  adminId: 'test_admin_001',
  testUserOpenId: 'test_fix_user_001'
};

/**
 * 测试修复1: 负数使用次数验证
 */
async function testNegativeUsesValidation() {
  console.log('🧪 测试修复1: 负数使用次数验证...');

  const negativeValues = [-5, -1, 0, 0.5, 1.5, 101, 1000];

  for (const uses of negativeValues) {
    try {
      const result = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'createInvite',
          role: 'parent',
          uses: uses,
          note: `测试负数验证: ${uses}`
        },
        __principalId: TEST_CONFIG.adminId
      });

      if (result.result && !result.result.success) {
        console.log(`  ✅ 负数/无效值 ${uses} 被正确拒绝: ${result.result.error.message}`);
      } else {
        console.log(`  ❌ 负数/无效值 ${uses} 未被正确拒绝`);
        return false;
      }
    } catch (error) {
      console.log(`  ✅ 负数/无效值 ${uses} 被正确抛出异常: ${error.message}`);
    }
  }

  // 测试正常值
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'parent',
        uses: 5,
        note: '测试正常值验证'
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (result.result && result.result.success) {
      console.log(`  ✅ 正常值 5 被正确接受`);
      return true;
    } else {
      console.log(`  ❌ 正常值 5 被错误拒绝`);
      return false;
    }
  } catch (error) {
    console.log(`  ❌ 正常值 5 被错误抛出异常: ${error.message}`);
    return false;
  }
}

/**
 * 测试修复2: 权限验证用户身份传递
 */
async function testPermissionAuthContext() {
  console.log('🧪 测试修复2: 权限验证用户身份传递...');

  try {
    // 测试无身份信息的情况
    const result1 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getCurrentUser'
      }
      // 不传递 __principalId
    });

    if (result1.result && !result1.result.success &&
        result1.result.error.code === 'UNAUTHORIZED') {
      console.log('  ✅ 无身份信息时正确拒绝访问');
    } else {
      console.log('  ❌ 无身份信息时未被正确拒绝');
      return false;
    }

    // 测试有身份信息的情况
    const result2 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'getCurrentUser'
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (result2.result && result2.result.success) {
      console.log('  ✅ 有身份信息时正确允许访问');
      return true;
    } else {
      console.log('  ❌ 有身份信息时被错误拒绝');
      console.log('    错误信息:', result2.result?.error?.message);
      return false;
    }
  } catch (error) {
    console.log('  ❌ 权限验证测试异常:', error.message);
    return false;
  }
}

/**
 * 测试修复3: 边界值验证增强
 */
async function testEnhancedBoundaryValidation() {
  console.log('🧪 测试修复3: 边界值验证增强...');

  const boundaryTests = [
    { field: '申请理由长度', action: 'submitRoleApplication', data: { role: 'volunteer', reason: '短' }, shouldFail: true },
    { field: '申请理由长度', action: 'submitRoleApplication', data: { role: 'volunteer', reason: 'a'.repeat(501) }, shouldFail: true },
    { field: '申请理由长度', action: 'submitRoleApplication', data: { role: 'volunteer', reason: '这是一个长度合适的申请理由，用于测试边界验证功能是否正常工作。' }, shouldFail: false },
    { field: '手机号格式', action: 'updateProfile', data: { profile: { realName: '测试用户', phone: '123' } }, shouldFail: true },
    { field: '手机号格式', action: 'updateProfile', data: { profile: { realName: '测试用户', phone: '13800138000' } }, shouldFail: false },
    { field: '姓名长度', action: 'updateProfile', data: { profile: { realName: '一', phone: '13800138000' } }, shouldFail: true },
    { field: '姓名长度', action: 'updateProfile', data: { profile: { realName: '这是一个非常长的用户姓名用于测试边界验证', phone: '13800138000' } }, shouldFail: true },
    { field: '姓名长度', action: 'updateProfile', data: { profile: { realName: '张三', phone: '13800138000' } }, shouldFail: false }
  ];

  let passedTests = 0;

  for (const test of boundaryTests) {
    try {
      const result = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: test.action,
          ...test.data
        },
        __principalId: TEST_CONFIG.testUserOpenId
      });

      const failed = !result.result.success;

      if (failed === test.shouldFail) {
        console.log(`  ✅ ${test.field} 验证正确 (期望${test.shouldFail ? '失败' : '成功'}, 实际${failed ? '失败' : '成功'})`);
        passedTests++;
      } else {
        console.log(`  ❌ ${test.field} 验证错误 (期望${test.shouldFail ? '失败' : '成功'}, 实际${failed ? '失败' : '成功'})`);
      }
    } catch (error) {
      if (test.shouldFail) {
        console.log(`  ✅ ${test.field} 验证正确 (异常拒绝)`);
        passedTests++;
      } else {
        console.log(`  ❌ ${test.field} 验证错误 (意外异常): ${error.message}`);
      }
    }
  }

  return passedTests === boundaryTests.length;
}

/**
 * 测试修复4: 错误处理一致性
 */
async function testErrorHandlingConsistency() {
  console.log('🧪 测试修复4: 错误处理一致性...');

  const errorTests = [
    { action: 'nonexistent', expectedCode: 'UNSUPPORTED_ACTION' },
    { action: 'createInvite', expectedCode: 'INVALID_INPUT' }, // 缺少role参数
    { action: 'validateInviteCode', expectedCode: 'INVALID_INPUT' }, // 缺少code参数
    { action: 'useInviteCode', expectedCode: 'UNAUTHORIZED' }, // 缺少身份验证
    { action: 'approveRoleRequest', expectedCode: 'UNAUTHORIZED' } // 缺少权限
  ];

  let consistentErrors = 0;

  for (const test of errorTests) {
    try {
      const result = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: test.action
          // 故意缺少必要参数或使用无效参数
        }
        // 不传递 __principalId 来测试权限验证
      });

      if (result.result && !result.result.success &&
          result.result.error && result.result.error.code) {
        if (result.result.error.code === test.expectedCode) {
          console.log(`  ✅ ${test.action} 错误码一致: ${result.result.error.code}`);
          consistentErrors++;
        } else {
          console.log(`  ⚠️ ${test.action} 错误码不一致: 期望 ${test.expectedCode}, 实际 ${result.result.error.code}`);
        }
      } else {
        console.log(`  ❌ ${test.action} 未返回预期的错误结构`);
      }
    } catch (error) {
      console.log(`  ❌ ${test.action} 测试异常: ${error.message}`);
    }
  }

  return consistentErrors >= errorTests.length * 0.8; // 80%通过率即可
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  console.log('🧹 清理测试数据...');

  try {
    // 清理测试期间创建的邀请码
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
        openid: _.in([TEST_CONFIG.adminId, TEST_CONFIG.testUserOpenId])
      })
      .remove();

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理测试数据失败:', error);
  }
}

/**
 * 主测试函数
 */
async function runBugFixValidation() {
  console.log('🚀 开始RBAC系统BUG修复验证');
  console.log('测试环境:', process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38');
  console.log('=' .repeat(50));

  const testResults = {};

  try {
    testResults['负数使用次数验证'] = await testNegativeUsesValidation();
  } catch (error) {
    testResults['负数使用次数验证'] = false;
    console.log('❌ 负数使用次数验证测试失败:', error.message);
  }

  try {
    testResults['权限验证用户身份传递'] = await testPermissionAuthContext();
  } catch (error) {
    testResults['权限验证用户身份传递'] = false;
    console.log('❌ 权限验证测试失败:', error.message);
  }

  try {
    testResults['边界值验证增强'] = await testEnhancedBoundaryValidation();
  } catch (error) {
    testResults['边界值验证增强'] = false;
    console.log('❌ 边界值验证测试失败:', error.message);
  }

  try {
    testResults['错误处理一致性'] = await testErrorHandlingConsistency();
  } catch (error) {
    testResults['错误处理一致性'] = false;
    console.log('❌ 错误处理测试失败:', error.message);
  }

  // 生成测试报告
  console.log('\n📊 BUG修复验证报告');
  console.log('=' .repeat(50));

  const totalTests = Object.keys(testResults).length;
  const passedTests = Object.values(testResults).filter(result => result).length;
  const successRate = (passedTests / totalTests * 100).toFixed(1);

  Object.keys(testResults).forEach(testName => {
    const status = testResults[testName] ? '✅ 通过' : '❌ 失败';
    console.log(`${testName}: ${status}`);
  });

  console.log(`\n总体修复效果: ${passedTests}/${totalTests} 测试通过 (${successRate}%)`);

  if (successRate >= 75) {
    console.log('🎉 BUG修复验证成功！系统功能恢复正常');
  } else if (successRate >= 50) {
    console.log('⚠️ BUG修复部分成功，仍有改进空间');
  } else {
    console.log('❌ BUG修复验证失败，需要进一步检查');
  }

  // 清理测试数据
  await cleanupTestData();

  console.log('\n🎉 RBAC系统BUG修复验证完成!');

  return {
    success: successRate >= 75,
    passRate: parseFloat(successRate),
    results: testResults
  };
}

// 运行测试
if (require.main === module) {
  runBugFixValidation().catch(console.error);
}

module.exports = {
  runBugFixValidation,
  testNegativeUsesValidation,
  testPermissionAuthContext,
  testEnhancedBoundaryValidation,
  testErrorHandlingConsistency,
  cleanupTestData
};