// 前端认证状态测试脚本
// 在小程序开发者工具控制台中运行此脚本

console.log('🔍 开始前端认证状态检查...');

// 1. 检查云开发是否正确初始化
async function checkCloudInit() {
  try {
    if (typeof wx === 'undefined') {
      console.log('❌ 不在微信小程序环境中');
      return false;
    }

    if (!wx.cloud) {
      console.log('❌ 云开发未初始化');
      return false;
    }

    console.log('✅ 云开发环境已初始化');
    return true;
  } catch (error) {
    console.error('❌ 云开发检查失败:', error);
    return false;
  }
}

// 2. 检查登录状态
async function checkLoginStatus() {
  try {
    console.log('🔐 检查用户登录状态...');

    const result = await wx.cloud.callFunction({
      name: 'rbac',
      data: { action: 'getCurrentUser' }
    });

    console.log('登录检查结果:', result);

    if (result.result && result.result.success) {
      console.log('✅ 用户已登录');
      console.log('用户信息:', result.result.data);
      return result.result.data;
    } else {
      console.log('❌ 用户未登录或权限不足');
      console.log('错误信息:', result.result?.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 登录状态检查失败:', error);
    return null;
  }
}

// 3. 测试创建邀请码
async function testCreateInvite() {
  try {
    console.log('🎫 测试创建邀请码...');

    const result = await wx.cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'parent',
        uses: 3,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天后过期
        note: '前端测试邀请码'
      }
    });

    console.log('创建邀请码结果:', result);

    if (result.result && result.result.success) {
      console.log('✅ 邀请码创建成功!');
      console.log('邀请码:', result.result.data.code);
      console.log('邀请ID:', result.result.data.inviteId);
      return result.result.data;
    } else {
      console.log('❌ 邀请码创建失败');
      console.log('错误信息:', result.result?.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 创建邀请码失败:', error);
    return null;
  }
}

// 4. 获取用户管理信息
async function testUserManagement() {
  try {
    console.log('👥 测试用户管理功能...');

    const result = await wx.cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'listUsers',
        page: 1,
        pageSize: 5
      }
    });

    console.log('用户列表结果:', result);

    if (result.result && result.result.success) {
      console.log('✅ 用户列表获取成功');
      console.log('用户数量:', result.result.data.total);
      return result.result.data;
    } else {
      console.log('❌ 用户列表获取失败');
      console.log('错误信息:', result.result?.error);
      return null;
    }
  } catch (error) {
    console.error('❌ 用户管理测试失败:', error);
    return null;
  }
}

// 5. 综合测试流程
async function runAuthTest() {
  console.log('🚀 开始前端认证综合测试');
  console.log('='.repeat(50));

  // 步骤1: 检查云开发环境
  const cloudOk = await checkCloudInit();
  if (!cloudOk) {
    console.log('❌ 云开发环境检查失败，测试终止');
    return;
  }

  // 步骤2: 检查登录状态
  const userInfo = await checkLoginStatus();
  if (!userInfo) {
    console.log('❌ 用户未登录，请先登录后再测试');
    console.log('💡 提示: 在小程序中完成登录后再运行此测试');
    return;
  }

  // 步骤3: 检查用户权限
  console.log('🔍 检查用户权限...');
  if (userInfo.roles.includes('admin')) {
    console.log('✅ 用户具有管理员权限');
  } else if (userInfo.roles.includes('social_worker')) {
    console.log('✅ 用户具有社工权限');
  } else {
    console.log('⚠️ 用户权限有限，某些功能可能无法使用');
  }

  // 步骤4: 测试管理员功能
  if (userInfo.roles.includes('admin') || userInfo.roles.includes('social_worker')) {
    console.log('\n🧪 测试管理员功能...');

    // 测试用户管理
    await testUserManagement();

    // 测试创建邀请码
    const inviteResult = await testCreateInvite();

    if (inviteResult) {
      console.log('\n🎉 所有管理员功能测试通过!');
    } else {
      console.log('\n❌ 部分管理员功能测试失败');
    }
  } else {
    console.log('\n⚠️ 用户权限不足，跳过管理员功能测试');
  }

  console.log('\n✅ 前端认证测试完成!');
  console.log('💡 如果遇到权限问题，请检查:');
  console.log('   1. 用户是否已正确登录');
  console.log('   2. 用户是否在管理员列表中');
  console.log('   3. 云开发环境是否正确配置');
}

// 6. 错误诊断工具
async function diagnoseAuthError() {
  console.log('🔧 诊断认证问题...');

  try {
    // 测试基本的云函数调用
    console.log('测试基本云函数调用...');
    const basicResult = await wx.cloud.callFunction({
      name: 'rbac',
      data: { action: 'test' } // 这个action不存在，用于测试错误处理
    });

    console.log('基本调用结果:', basicResult);
  } catch (error) {
    console.log('基本调用错误:', error);
  }

  // 检查本地存储
  try {
    const storageInfo = wx.getStorageInfoSync();
    console.log('本地存储信息:', storageInfo);
  } catch (error) {
    console.log('本地存储检查失败:', error);
  }

  // 检查网络状态
  wx.getNetworkType({
    success: (res) => {
      console.log('网络状态:', res.networkType);
    },
    fail: (error) => {
      console.log('网络状态检查失败:', error);
    }
  });
}

// 导出函数供控制台调用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    checkCloudInit,
    checkLoginStatus,
    testCreateInvite,
    testUserManagement,
    runAuthTest,
    diagnoseAuthError
  };
} else {
  // 在小程序环境中直接绑定到全局对象
  if (typeof wx !== 'undefined') {
    wx.authTest = {
      checkCloudInit,
      checkLoginStatus,
      testCreateInvite,
      testUserManagement,
      runAuthTest,
      diagnoseAuthError
    };

    console.log('🎯 认证测试工具已加载到 wx.authTest');
    console.log('💡 使用方法:');
    console.log('   wx.authTest.runAuthTest() - 运行完整测试');
    console.log('   wx.authTest.checkLoginStatus() - 检查登录状态');
    console.log('   wx.authTest.testCreateInvite() - 测试创建邀请码');
    console.log('   wx.authTest.diagnoseAuthError() - 诊断认证问题');
  }
}

// 自动运行测试（如果在适当的环境中）
if (typeof wx !== 'undefined') {
  // 等待一秒后自动运行测试
  setTimeout(() => {
    console.log('🚀 自动运行认证测试...');
    runAuthTest();
  }, 1000);
}