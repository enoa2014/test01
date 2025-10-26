// 测试邀请码创建功能
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || 'cloud1-6g2fzr5f7cf51e38'
});

async function testCreateInvite() {
  console.log('🧪 测试邀请码创建功能...');

  try {
    // 测试管理员创建邀请码
    const result = await cloud.callFunction({
      name: 'rbac',
      data: {
        action: 'createInvite',
        role: 'parent',
        uses: 5,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        note: '测试邀请码',
        __principalId: 'test_admin_001' // 使用测试管理员ID
      }
    });

    console.log('✅ 邀请码创建结果:', result.result);

    if (result.result.success) {
      console.log('✅ 邀请码创建成功!');
      console.log('邀请码:', result.result.data.code);
      console.log('邀请ID:', result.result.data.inviteId);
    } else {
      console.log('❌ 邀请码创建失败:', result.result.error);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testCreateInvite();