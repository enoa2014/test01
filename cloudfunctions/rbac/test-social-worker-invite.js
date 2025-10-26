// 社工邀请码与角色绑定创建测试
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();

const TEST = {
  adminId: 'test_admin_autobind_001',
  userOpenId: 'test_user_sw_001'
};

async function ensureAdmin() {
  try {
    await db.collection('admins').doc(TEST.adminId).set({
      data: {
        _id: TEST.adminId,
        username: 'tester-admin',
        role: 'admin',
        status: 'active',
        createdAt: Date.now()
      }
    });
  } catch (_) {
    // ignore
  }
}

async function ensureUser() {
  try {
    await db.collection('users').add({
      data: {
        openid: TEST.userOpenId,
        status: 'active',
        createdAt: Date.now()
      }
    });
  } catch (_) {
    // ignore
  }
}

async function testCreateSocialWorkerInvite() {
  console.log('🧪 测试：创建社工邀请码');
  const res = await cloud.callFunction({
    name: 'rbac',
    data: {
      action: 'createInvite',
      role: 'social_worker',
      uses: 1,
      __principalId: TEST.adminId
    },
    __principalId: TEST.adminId
  });
  const out = res && res.result ? res.result : {};
  if (!out.success) {
    throw new Error('创建社工邀请码失败: ' + (out.error && out.error.message));
  }
  const { inviteId } = out.data || {};
  const doc = await db.collection('invites').doc(inviteId).get();
  if (!doc.data || doc.data.role !== 'social_worker') {
    throw new Error('邀请码记录role不正确，应为 social_worker');
  }
  console.log('✅ 通过：社工邀请码创建成功');
}

async function testAddRoleBindingPermission() {
  console.log('🧪 测试：非管理员禁止直接分配社工角色');
  const res = await cloud.callFunction({
    name: 'rbac',
    data: {
      action: 'addRoleBinding',
      userOpenId: TEST.userOpenId,
      role: 'social_worker',
      __principalId: 'not_admin_001'
    },
    __principalId: 'not_admin_001'
  });
  const out = res && res.result ? res.result : {};
  if (out.success) {
    throw new Error('非管理员不应被允许添加角色绑定');
  }
  if (!out.error || out.error.code !== 'FORBIDDEN') {
    throw new Error('应返回 FORBIDDEN，但得到: ' + (out.error && out.error.code));
  }
  console.log('✅ 通过：权限校验生效（非管理员被拒绝）');
}

async function run() {
  try {
    await ensureAdmin();
    await ensureUser();
    await testCreateSocialWorkerInvite();
    await testAddRoleBindingPermission();
    console.log('\n🎉 社工邀请码/权限用例通过');
    process.exit(0);
  } catch (e) {
    console.error('❌ 测试失败：', e && e.message ? e.message : e);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run };

