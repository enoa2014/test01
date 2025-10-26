// 完整的RBAC系统测试脚本
const cloud = require('wx-server-sdk');

// 初始化云开发
cloud.init({
  env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();
const _ = db.command;

// 测试配置
const TEST_CONFIG = {
  adminId: 'test_admin_001', // 测试管理员ID
  adminOpenId: 'test_admin_openid_001',
  testUserOpenId: 'test_user_openid_001',
  testVolunteerOpenId: 'test_volunteer_openid_001',
  env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38'
};

// 集合名称
const ADMINS_COLLECTION = 'admins';
const USERS_COLLECTION = 'users';
const ROLE_BINDINGS_COLLECTION = 'roleBindings';
const ROLE_REQUESTS_COLLECTION = 'roleRequests';
const INVITES_COLLECTION = 'invites';
const AUDIT_LOGS_COLLECTION = 'auditLogs';

/**
 * 创建测试管理员账户
 */
async function createTestAdmin() {
  console.log('🔧 创建测试管理员账户...');

  try {
    // 检查管理员是否已存在
    const existingAdmin = await db.collection(ADMINS_COLLECTION)
      .where({ _id: TEST_CONFIG.adminId })
      .get();

    if (existingAdmin.data && existingAdmin.data.length > 0) {
      console.log('✅ 测试管理员已存在');
      return existingAdmin.data[0];
    }

    // 创建管理员账户
    const adminData = {
      _id: TEST_CONFIG.adminId,
      username: 'test_admin',
      realName: '测试管理员',
      email: 'admin@test.com',
      phone: '13800138000',
      role: 'admin',
      status: 'active',
      permissions: ['admin', 'social_worker', 'user_management'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection(ADMINS_COLLECTION).add({
      data: adminData
    });

    console.log('✅ 测试管理员创建成功');
    return { ...adminData, _id: result._id };
  } catch (error) {
    console.error('❌ 创建测试管理员失败:', error);
    throw error;
  }
}

/**
 * 创建测试用户
 */
async function createTestUsers() {
  console.log('🔧 创建测试用户...');

  try {
    const users = [
      {
        _openid: TEST_CONFIG.testUserOpenId,
        profile: {
          realName: '测试用户',
          phone: '13800138001',
          avatar: ''
        },
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        _openid: TEST_CONFIG.testVolunteerOpenId,
        profile: {
          realName: '测试志愿者',
          phone: '13800138002',
          avatar: ''
        },
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    for (const user of users) {
      const existing = await db.collection(USERS_COLLECTION)
        .where({ openid: user._openid })
        .get();

      if (existing.data.length === 0) {
        await db.collection(USERS_COLLECTION).add({ data: user });
        console.log(`✅ 创建用户: ${user.profile.realName}`);
      } else {
        console.log(`✅ 用户已存在: ${user.profile.realName}`);
      }
    }
  } catch (error) {
    console.error('❌ 创建测试用户失败:', error);
    throw error;
  }
}

/**
 * 测试RBAC云函数调用
 */
async function callRBAC(action, data, userId = TEST_CONFIG.adminId) {
  try {
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action,
        ...data,
        __principalId: userId // 模拟自定义登录
      }
    });

    return result.result;
  } catch (error) {
    console.error(`❌ 调用RBAC失败 (${action}):`, error);
    throw error;
  }
}

/**
 * 测试权限验证
 */
async function testPermissionChecks() {
  console.log('🔐 测试权限验证...');

  const tests = [
    {
      name: '管理员权限测试',
      userId: TEST_CONFIG.adminId,
      action: 'getCurrentUser',
      shouldSucceed: true
    },
    {
      name: '未授权用户测试',
      userId: 'unauthorized_user',
      action: 'getCurrentUser',
      shouldSucceed: false
    },
    {
      name: '空用户ID测试',
      userId: '',
      action: 'getCurrentUser',
      shouldSucceed: false
    }
  ];

  for (const test of tests) {
    try {
      const result = await callRBAC(test.action, {}, test.userId);
      if (test.shouldSucceed) {
        console.log(`✅ ${test.name} - 成功`);
      } else {
        console.log(`❌ ${test.name} - 应该失败但成功了`);
      }
    } catch (error) {
      if (!test.shouldSucceed) {
        console.log(`✅ ${test.name} - 正确拒绝访问`);
      } else {
        console.log(`❌ ${test.name} - 意外失败:`, error.message);
      }
    }
  }
}

/**
 * 测试用户管理功能
 */
async function testUserManagement() {
  console.log('👥 测试用户管理功能...');

  try {
    // 测试获取用户列表
    const usersResult = await callRBAC('listUsers', {
      page: 1,
      pageSize: 10
    });

    if (usersResult.success) {
      console.log(`✅ 获取用户列表成功，共 ${usersResult.data.total} 个用户`);
    } else {
      console.log('❌ 获取用户列表失败:', usersResult.error);
    }

    // 测试获取角色绑定
    const bindingsResult = await callRBAC('listRoleBindings', {});

    if (bindingsResult.success) {
      console.log(`✅ 获取角色绑定成功，共 ${bindingsResult.data.items.length} 个绑定`);
    } else {
      console.log('❌ 获取角色绑定失败:', bindingsResult.error);
    }

  } catch (error) {
    console.error('❌ 用户管理测试失败:', error);
  }
}

/**
 * 测试角色申请功能
 */
async function testRoleApplications() {
  console.log('📝 测试角色申请功能...');

  try {
    // 测试普通用户提交角色申请
    const applicationResult = await callRBAC('submitRoleApplication', {
      role: 'volunteer',
      reason: '我希望成为志愿者，为社会贡献自己的力量。我有相关经验和时间。',
      attachments: []
    }, TEST_CONFIG.testUserOpenId);

    if (applicationResult.success) {
      console.log('✅ 提交角色申请成功');
      console.log(`申请ID: ${applicationResult.applicationId}`);
    } else {
      console.log('❌ 提交角色申请失败:', applicationResult.error);
    }

    // 测试管理员获取申请列表
    const requestsResult = await callRBAC('listRoleRequests', {
      state: 'pending',
      page: 1,
      pageSize: 10
    });

    if (requestsResult.success) {
      console.log(`✅ 获取申请列表成功，共 ${requestsResult.data.total} 个申请`);

      // 如果有待审核的申请，测试审批功能
      if (requestsResult.data.items.length > 0) {
        const firstRequest = requestsResult.data.items[0];

        // 测试通过申请
        const approveResult = await callRBAC('approveRoleRequest', {
          requestId: firstRequest.id,
          reason: '申请材料齐全，符合志愿者要求'
        });

        if (approveResult.success) {
          console.log('✅ 审批通过申请成功');
        } else {
          console.log('❌ 审批通过申请失败:', approveResult.error);
        }
      }
    } else {
      console.log('❌ 获取申请列表失败:', requestsResult.error);
    }

  } catch (error) {
    console.error('❌ 角色申请测试失败:', error);
  }
}

/**
 * 测试邀请码功能
 */
async function testInviteCodes() {
  console.log('🎫 测试邀请码功能...');

  try {
    // 测试创建邀请码
    const createResult = await callRBAC('createInvite', {
      role: 'parent',
      uses: 5,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天后过期
      note: '测试邀请码'
    });

    if (createResult.success) {
      console.log('✅ 创建邀请码成功');
      console.log(`邀请码: ${createResult.data.code}`);

      const inviteCode = createResult.data.code;

      // 测试获取邀请码列表
      const listResult = await callRBAC('listInvites', {
        page: 1,
        pageSize: 10
      });

      if (listResult.success) {
        console.log(`✅ 获取邀请码列表成功，共 ${listResult.data.total} 个邀请码`);
      } else {
        console.log('❌ 获取邀请码列表失败:', listResult.error);
      }

      // 测试验证邀请码
      const validateResult = await callRBAC('validateInviteCode', {
        code: inviteCode
      }, TEST_CONFIG.testVolunteerOpenId);

      if (validateResult.success) {
        console.log('✅ 验证邀请码成功');
        console.log(`邀请码有效: ${validateResult.data.valid}`);

        // 如果邀请码有效，测试使用邀请码
        if (validateResult.data.valid) {
          const useResult = await callRBAC('useInviteCode', {
            code: inviteCode
          }, TEST_CONFIG.testVolunteerOpenId);

          if (useResult.success) {
            console.log(`✅ 使用邀请码成功，获得角色: ${useResult.role}`);
          } else {
            console.log('❌ 使用邀请码失败:', useResult.error);
          }
        }
      } else {
        console.log('❌ 验证邀请码失败:', validateResult.error);
      }

      // 测试撤销邀请码
      const revokeResult = await callRBAC('revokeInvite', {
        inviteId: createResult.data.inviteId
      });

      if (revokeResult.success) {
        console.log('✅ 撤销邀请码成功');
      } else {
        console.log('❌ 撤销邀请码失败:', revokeResult.error);
      }
    } else {
      console.log('❌ 创建邀请码失败:', createResult.error);
    }

  } catch (error) {
    console.error('❌ 邀请码测试失败:', error);
  }
}

/**
 * 测试角色绑定管理
 */
async function testRoleBindingManagement() {
  console.log('🔗 测试角色绑定管理...');

  try {
    // 测试添加角色绑定
    const addResult = await callRBAC('addRoleBinding', {
      userOpenId: TEST_CONFIG.testUserOpenId,
      role: 'social_worker',
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30天后过期
    });

    if (addResult.success) {
      console.log('✅ 添加角色绑定成功');
    } else {
      console.log('❌ 添加角色绑定失败:', addResult.error);
    }

    // 测试移除角色绑定
    const removeResult = await callRBAC('removeRoleBinding', {
      userOpenId: TEST_CONFIG.testUserOpenId,
      role: 'social_worker'
    });

    if (removeResult.success) {
      console.log('✅ 移除角色绑定成功');
    } else {
      console.log('❌ 移除角色绑定失败:', removeResult.error);
    }

  } catch (error) {
    console.error('❌ 角色绑定管理测试失败:', error);
  }
}

/**
 * 测试用户资料更新
 */
async function testProfileUpdate() {
  console.log('👤 测试用户资料更新...');

  try {
    const updateResult = await callRBAC('updateProfile', {
      profile: {
        realName: '更新的用户名',
        phone: '13900139000',
        avatar: 'https://example.com/avatar.jpg',
        gender: 'male',
        birthday: '1990-01-01',
        address: '测试地址'
      }
    }, TEST_CONFIG.testUserOpenId);

    if (updateResult.success) {
      console.log('✅ 更新用户资料成功');
    } else {
      console.log('❌ 更新用户资料失败:', updateResult.error);
    }

  } catch (error) {
    console.error('❌ 用户资料更新测试失败:', error);
  }
}

/**
 * 清理测试数据
 */
async function cleanupTestData() {
  console.log('🧹 清理测试数据...');

  try {
    // 清理角色绑定
    await db.collection(ROLE_BINDINGS_COLLECTION)
      .where({
        userOpenId: _.in([TEST_CONFIG.testUserOpenId, TEST_CONFIG.testVolunteerOpenId])
      })
      .remove();

    // 清理角色申请
    await db.collection(ROLE_REQUESTS_COLLECTION)
      .where({
        applicantOpenId: _.in([TEST_CONFIG.testUserOpenId, TEST_CONFIG.testVolunteerOpenId])
      })
      .remove();

    // 清理邀请码
    await db.collection(INVITES_COLLECTION)
      .where({
        createdBy: TEST_CONFIG.adminId
      })
      .remove();

    // 清理审计日志
    await db.collection(AUDIT_LOGS_COLLECTION)
      .where({
        actorUserId: _.in([TEST_CONFIG.adminId, TEST_CONFIG.testUserOpenId, TEST_CONFIG.testVolunteerOpenId])
      })
      .remove();

    console.log('✅ 测试数据清理完成');
  } catch (error) {
    console.error('❌ 清理测试数据失败:', error);
  }
}

/**
 * 生成测试报告
 */
function generateTestReport(results) {
  console.log('\n📊 测试报告');
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

  console.log('\n✅ 通过的测试:');
  results.filter(r => r.passed).forEach(result => {
    console.log(`  - ${result.name}`);
  });
}

/**
 * 主测试函数
 */
async function runCompleteTests() {
  console.log('🚀 开始RBAC系统完整测试');
  console.log('测试环境:', TEST_CONFIG.env);
  console.log('=' .repeat(50));

  const results = [];

  try {
    // 准备测试环境
    await createTestAdmin();
    await createTestUsers();

    // 执行各项测试
    const tests = [
      { name: '权限验证', fn: testPermissionChecks },
      { name: '用户管理', fn: testUserManagement },
      { name: '角色申请', fn: testRoleApplications },
      { name: '邀请码功能', fn: testInviteCodes },
      { name: '角色绑定管理', fn: testRoleBindingManagement },
      { name: '用户资料更新', fn: testProfileUpdate }
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
    generateTestReport(results);

    // 清理测试数据
    await cleanupTestData();

    console.log('\n🎉 RBAC系统测试完成!');

  } catch (error) {
    console.error('❌ 测试过程中发生严重错误:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本，执行测试
if (require.main === module) {
  runCompleteTests().catch(console.error);
}

module.exports = {
  runCompleteTests,
  createTestAdmin,
  createTestUsers,
  testPermissionChecks,
  testUserManagement,
  testRoleApplications,
  testInviteCodes,
  testRoleBindingManagement,
  testProfileUpdate,
  cleanupTestData,
  TEST_CONFIG
};