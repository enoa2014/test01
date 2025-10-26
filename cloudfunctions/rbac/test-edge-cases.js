// RBAC系统边界情况测试
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();
const _ = db.command;

// 测试配置
const TEST_CONFIG = {
  adminId: 'test_admin_001',
  testUserOpenId: 'test_edge_user_001',
  testVolunteerOpenId: 'test_edge_volunteer_001',
  testParentOpenId: 'test_edge_parent_001'
};

/**
 * 测试无效输入处理
 */
async function testInvalidInputs() {
  console.log('🧪 测试无效输入处理...');

  const testCases = [
    {
      name: '空action参数',
      data: {},
      expectError: true
    },
    {
      name: '不存在的action',
      data: { action: 'nonexistent_action' },
      expectError: true
    },
    {
      name: 'createInvite缺少role参数',
      data: { action: 'createInvite' },
      expectError: true
    },
    {
      name: 'createInvite无效role参数',
      data: { action: 'createInvite', role: 'invalid_role' },
      expectError: true
    },
    {
      name: 'createInvite负数uses',
      data: { action: 'createInvite', role: 'parent', uses: -1 },
      expectError: true
    },
    {
      name: 'createInvite超大uses',
      data: { action: 'createInvite', role: 'parent', uses: 1000 },
      expectError: true
    },
    {
      name: 'validateInviteCode空code',
      data: { action: 'validateInviteCode' },
      expectError: true
    },
    {
      name: 'validateInviteCode短code',
      data: { action: 'validateInviteCode', code: '123' },
      expectError: true
    },
    {
      name: 'validateInviteCode长code',
      data: { action: 'validateInviteCode', code: '123456789012345' },
      expectError: true
    }
  ];

  for (const testCase of testCases) {
    try {
      const result = await cloud.callFunction({
        name: 'rbac',
        data: {
          ...testCase.data,
          __principalId: TEST_CONFIG.adminId
        }
      });

      if (testCase.expectError) {
        if (result.result && !result.result.success) {
          console.log(`✅ ${testCase.name} - 正确拒绝: ${result.result.error.message}`);
        } else {
          console.log(`❌ ${testCase.name} - 应该拒绝但成功了`);
        }
      } else {
        if (result.result && result.result.success) {
          console.log(`✅ ${testCase.name} - 成功`);
        } else {
          console.log(`❌ ${testCase.name} - 意外失败: ${result.result?.error?.message}`);
        }
      }
    } catch (error) {
      if (testCase.expectError) {
        console.log(`✅ ${testCase.name} - 正确抛出异常: ${error.message}`);
      } else {
        console.log(`❌ ${testCase.name} - 意外异常: ${error.message}`);
      }
    }
  }
}

/**
 * 测试权限边界
 */
async function testPermissionBoundaries() {
  console.log('🔐 测试权限边界...');

  // 创建测试用户
  const testUsers = [
    { openId: TEST_CONFIG.testUserOpenId, name: '普通用户' },
    { openId: TEST_CONFIG.testVolunteerOpenId, name: '志愿者' },
    { openId: TEST_CONFIG.testParentOpenId, name: '家长' }
  ];

  for (const user of testUsers) {
    try {
      // 确保用户存在
      await db.collection('users').add({
        data: {
          openid: user.openId,
          profile: { realName: user.name, phone: '13800138000' },
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }).catch(() => {}); // 忽略已存在错误
    } catch (error) {
      console.log(`创建用户失败: ${user.name}`, error.message);
    }
  }

  // 测试不同用户的权限
  const permissionTests = [
    {
      user: '普通用户',
      openId: TEST_CONFIG.testUserOpenId,
      actions: [
        { action: 'getCurrentUser', shouldSucceed: true },
        { action: 'listUsers', shouldSucceed: false },
        { action: 'createInvite', shouldSucceed: false },
        { action: 'listInvites', shouldSucceed: false }
      ]
    },
    {
      user: '管理员',
      openId: TEST_CONFIG.adminId,
      actions: [
        { action: 'getCurrentUser', shouldSucceed: true },
        { action: 'listUsers', shouldSucceed: true },
        { action: 'createInvite', shouldSucceed: true },
        { action: 'listInvites', shouldSucceed: true }
      ]
    }
  ];

  for (const userTest of permissionTests) {
    console.log(`\n👤 测试用户权限: ${userTest.user}`);

    for (const actionTest of userTest.actions) {
      try {
        const result = await cloud.callFunction({
          name: 'rbac',
          data: {
            action: actionTest.action,
            ...getActionData(actionTest.action)
          },
          __principalId: userTest.openId
        });

        const success = result.result && result.result.success;

        if (success === actionTest.shouldSucceed) {
          console.log(`  ✅ ${actionTest.action} - 权限正确`);
        } else {
          console.log(`  ❌ ${actionTest.action} - 权限错误 (期望: ${actionTest.shouldSucceed ? '成功' : '失败'}, 实际: ${success ? '成功' : '失败'})`);
        }
      } catch (error) {
        if (!actionTest.shouldSucceed) {
          console.log(`  ✅ ${actionTest.action} - 正确拒绝访问`);
        } else {
          console.log(`  ❌ ${actionTest.action} - 意外失败: ${error.message}`);
        }
      }
    }
  }
}

/**
 * 获取action对应的数据
 */
function getActionData(action) {
  const actionDataMap = {
    'createInvite': { role: 'parent', uses: 1 },
    'listUsers': { page: 1, pageSize: 5 },
    'listInvites': { page: 1, pageSize: 5 }
  };
  return actionDataMap[action] || {};
}

/**
 * 测试邀请码边界情况
 */
async function testInviteEdgeCases() {
  console.log('🎫 测试邀请码边界情况...');

  // 测试创建大量邀请码
  console.log('测试批量创建邀请码...');
  const inviteCodes = [];

  for (let i = 0; i < 10; i++) {
    try {
      const result = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'createInvite',
          role: 'parent',
          uses: 1,
          note: `边界测试邀请码 ${i + 1}`
        },
        __principalId: TEST_CONFIG.adminId
      });

      if (result.result && result.result.success) {
        inviteCodes.push(result.result.data);
        console.log(`  ✅ 创建邀请码 ${i + 1}: ${result.result.data.code}`);
      }
    } catch (error) {
      console.log(`  ❌ 创建邀请码 ${i + 1} 失败: ${error.message}`);
    }
  }

  console.log(`成功创建 ${inviteCodes.length} 个邀请码`);

  // 测试重复使用邀请码
  if (inviteCodes.length > 0) {
    console.log('测试重复使用邀请码...');
    const testCode = inviteCodes[0];

    try {
      // 第一次使用
      const result1 = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'useInviteCode',
          code: testCode.code
        },
        __principalId: TEST_CONFIG.testParentOpenId
      });

      if (result1.result && result1.result.success) {
        console.log(`  ✅ 首次使用邀请码成功`);
      } else {
        console.log(`  ❌ 首次使用邀请码失败`);
      }

      // 第二次使用同一个邀请码
      const result2 = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'useInviteCode',
          code: testCode.code
        },
        __principalId: TEST_CONFIG.testVolunteerOpenId
      });

      if (result2.result && !result2.result.success) {
        console.log(`  ✅ 重复使用邀请码被正确拒绝`);
      } else {
        console.log(`  ❌ 重复使用邀请码未被拒绝`);
      }
    } catch (error) {
      console.log(`  ❌ 测试重复使用时出错: ${error.message}`);
    }
  }

  // 测试过期邀请码
  console.log('测试过期邀请码...');
  try {
    const expiredResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'parent',
        uses: 1,
        expiresAt: Date.now() - 1000 // 已过期
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (expiredResult.result && expiredResult.result.success) {
      const expiredCode = expiredResult.result.data.code;

      // 尝试使用过期的邀请码
      const useResult = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'validateInviteCode',
          code: expiredCode
        },
        __principalId: TEST_CONFIG.testUserOpenId
      });

      if (useResult.result && useResult.result.data && !useResult.result.data.valid) {
        console.log(`  ✅ 过期邀请码被正确拒绝: ${useResult.result.data.reason}`);
      } else {
        console.log(`  ❌ 过期邀请码未被正确拒绝`);
      }
    }
  } catch (error) {
    console.log(`  ❌ 测试过期邀请码时出错: ${error.message}`);
  }
}

/**
 * 测试角色绑定边界
 */
async function testRoleBindingEdgeCases() {
  console.log('🔗 测试角色绑定边界情况...');

  // 测试重复角色绑定
  console.log('测试重复角色绑定...');
  try {
    // 第一次添加角色
    const result1 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'addRoleBinding',
        userOpenId: TEST_CONFIG.testUserOpenId,
        role: 'volunteer'
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (result1.result && result1.result.success) {
      console.log('  ✅ 首次添加角色绑定成功');
    }

    // 第二次添加相同角色
    const result2 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'addRoleBinding',
        userOpenId: TEST_CONFIG.testUserOpenId,
        role: 'volunteer'
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (result2.result && !result2.result.success) {
      console.log('  ✅ 重复角色绑定被正确拒绝');
    } else {
      console.log('  ❌ 重复角色绑定未被拒绝');
    }
  } catch (error) {
    console.log(`  ❌ 测试重复角色绑定时出错: ${error.message}`);
  }

  // 测试移除不存在的角色绑定
  console.log('测试移除不存在的角色绑定...');
  try {
    const removeResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'removeRoleBinding',
        userOpenId: 'nonexistent_user',
        role: 'volunteer'
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (removeResult.result && !removeResult.result.success) {
      console.log('  ✅ 移除不存在的角色绑定被正确拒绝');
    } else {
      console.log('  ❌ 移除不存在的角色绑定未被拒绝');
    }
  } catch (error) {
    console.log(`  ❌ 测试移除不存在的角色绑定时出错: ${error.message}`);
  }
}

/**
 * 测试角色申请边界
 */
async function testRoleApplicationEdgeCases() {
  console.log('📝 测试角色申请边界情况...');

  // 测试重复申请
  console.log('测试重复角色申请...');
  try {
    // 第一次申请
    const result1 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'submitRoleApplication',
        role: 'volunteer',
        reason: '这是一个测试申请，用于验证重复申请处理。'
      },
      __principalId: TEST_CONFIG.testVolunteerOpenId
    });

    if (result1.result && result1.result.success) {
      console.log('  ✅ 首次提交申请成功');
    }

    // 第二次申请相同角色
    const result2 = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'submitRoleApplication',
        role: 'volunteer',
        reason: '这是重复的申请。'
      },
      __principalId: TEST_CONFIG.testVolunteerOpenId
    });

    if (result2.result && !result2.result.success) {
      console.log('  ✅ 重复申请被正确拒绝');
    } else {
      console.log('  ❌ 重复申请未被拒绝');
    }
  } catch (error) {
    console.log(`  ❌ 测试重复申请时出错: ${error.message}`);
  }

  // 测试无效理由长度
  console.log('测试无效申请理由...');
  const invalidReasonTests = [
    { reason: '', description: '空理由' },
    { reason: '短', description: '过短理由' },
    { reason: 'a'.repeat(501), description: '过长理由' }
  ];

  for (const test of invalidReasonTests) {
    try {
      const result = await cloud.callFunction({
        name: 'rbac',
        data: {
          action: 'submitRoleApplication',
          role: 'volunteer',
          reason: test.reason
        },
        __principalId: TEST_CONFIG.testUserOpenId
      });

      if (result.result && !result.result.success) {
        console.log(`  ✅ ${test.description}被正确拒绝`);
      } else {
        console.log(`  ❌ ${test.description}未被拒绝`);
      }
    } catch (error) {
      console.log(`  ❌ 测试${test.description}时出错: ${error.message}`);
    }
  }
}

/**
 * 测试数据一致性
 */
async function testDataConsistency() {
  console.log('🔄 测试数据一致性...');

  try {
    // 创建邀请码
    const createResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'parent',
        uses: 1,
        note: '数据一致性测试'
      },
      __principalId: TEST_CONFIG.adminId
    });

    if (!createResult.result || !createResult.result.success) {
      throw new Error('创建邀请码失败');
    }

    const inviteCode = createResult.result.data.code;

    // 验证邀请码
    const validateResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'validateInviteCode',
        code: inviteCode
      },
      __principalId: TEST_CONFIG.testParentOpenId
    });

    if (!validateResult.result || !validateResult.result.success) {
      throw new Error('验证邀请码失败');
    }

    // 使用邀请码
    const useResult = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'useInviteCode',
        code: inviteCode
      },
      __principalId: TEST_CONFIG.testParentOpenId
    });

    if (!useResult.result || !useResult.result.success) {
      throw new Error('使用邀请码失败');
    }

    // 验证邀请码已被使用
    const validateAfterUse = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'validateInviteCode',
        code: inviteCode
      },
      __principalId: TEST_CONFIG.testUserOpenId
    });

    if (validateAfterUse.result &&
        validateAfterUse.result.data &&
        !validateAfterUse.result.data.valid) {
      console.log('  ✅ 数据一致性正确：邀请码使用后状态正确更新');
    } else {
      console.log('  ❌ 数据一致性错误：邀请码使用后状态未正确更新');
    }

  } catch (error) {
    console.log(`  ❌ 数据一致性测试失败: ${error.message}`);
  }
}

/**
 * 清理测试数据
 */
async function cleanupEdgeTestData() {
  console.log('🧹 清理边界测试数据...');

  try {
    // 清理角色绑定
    await db.collection('roleBindings')
      .where({
        userOpenId: _.in([
          TEST_CONFIG.testUserOpenId,
          TEST_CONFIG.testVolunteerOpenId,
          TEST_CONFIG.testParentOpenId
        ])
      })
      .remove();

    // 清理角色申请
    await db.collection('roleRequests')
      .where({
        applicantOpenId: _.in([
          TEST_CONFIG.testUserOpenId,
          TEST_CONFIG.testVolunteerOpenId,
          TEST_CONFIG.testParentOpenId
        ])
      })
      .remove();

    // 清理测试用户
    await db.collection('users')
      .where({
        openid: _.in([
          TEST_CONFIG.testUserOpenId,
          TEST_CONFIG.testVolunteerOpenId,
          TEST_CONFIG.testParentOpenId
        ])
      })
      .remove();

    console.log('✅ 边界测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理边界测试数据失败:', error);
  }
}

/**
 * 生成边界测试报告
 */
function generateEdgeTestReport(results) {
  console.log('\n📊 边界测试报告');
  console.log('=' .repeat(50));

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = totalTests - passedTests;

  console.log(`总测试数: ${totalTests}`);
  console.log(`通过: ${passedTests}`);
  console.log(`失败: ${failedTests}`);
  console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

  if (failedTests > 0) {
    console.log('\n❌ 失败的测试:');
    results.filter(r => !r.passed).forEach(result => {
      console.log(`  - ${result.name}: ${result.error}`);
    });
  }
}

/**
 * 主测试函数
 */
async function runEdgeTests() {
  console.log('🚀 开始RBAC系统边界情况测试');
  console.log('测试环境:', process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38');
  console.log('=' .repeat(50));

  const results = [];

  const tests = [
    { name: '无效输入处理', fn: testInvalidInputs },
    { name: '权限边界', fn: testPermissionBoundaries },
    { name: '邀请码边界', fn: testInviteEdgeCases },
    { name: '角色绑定边界', fn: testRoleBindingEdgeCases },
    { name: '角色申请边界', fn: testRoleApplicationEdgeCases },
    { name: '数据一致性', fn: testDataConsistency }
  ];

  for (const test of tests) {
    try {
      console.log(`\n🧪 执行测试: ${test.name}`);
      await test.fn();
      results.push({ name: test.name, passed: true });
      console.log(`✅ ${test.name} 测试完成`);
    } catch (error) {
      results.push({ name: test.name, passed: false, error: error.message });
      console.log(`❌ ${test.name} 测试失败:`, error.message);
    }
  }

  // 生成测试报告
  generateEdgeTestReport(results);

  // 清理测试数据
  await cleanupEdgeTestData();

  console.log('\n🎉 RBAC系统边界情况测试完成!');
}

// 运行测试
if (require.main === module) {
  runEdgeTests().catch(console.error);
}

module.exports = {
  runEdgeTests,
  testInvalidInputs,
  testPermissionBoundaries,
  testInviteEdgeCases,
  testRoleBindingEdgeCases,
  testRoleApplicationEdgeCases,
  testDataConsistency,
  cleanupEdgeTestData
};