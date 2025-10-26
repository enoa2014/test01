// QR 登录自动绑定会话字段测试（不触发真实审批）
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || 'cloud1-6g2fzr5f7cf51e38'
});

const db = cloud.database();

const TEST = {
  adminId: 'test_admin_qr_001'
};

async function ensureAdmin() {
  try {
    await db.collection('admins').doc(TEST.adminId).set({
      data: {
        _id: TEST.adminId,
        username: 'tester-admin-qr',
        role: 'admin',
        status: 'active',
        createdAt: Date.now()
      }
    });
  } catch (_) {
    // ignore
  }
}

async function testQrInitStoresAutoBind() {
  console.log('🧪 测试：qrInit 存储 autoBind/createdBy/requiredRole');
  const res = await cloud.callFunction({
    name: 'qrLogin',
    data: {
      action: 'qrInit',
      type: 'social_worker',
      autoBind: true,
      __principalId: TEST.adminId,
      deviceInfo: { userAgent: 'jest-test' },
      metadata: { source: 'unit-test' }
    }
  });

  const out = res && res.result ? res.result : {};
  if (!out.success) {
    throw new Error('qrInit 调用失败: ' + (out.error && out.error.message));
  }

  const { sessionId } = out.data || {};
  if (!sessionId) throw new Error('未返回 sessionId');

  const doc = await db.collection('qrLoginSessions').doc(sessionId).get();
  const data = doc && doc.data ? doc.data : null;
  if (!data) throw new Error('未读取到会话记录');

  if (data.autoBind !== true) throw new Error('autoBind 字段未正确写入');
  if (data.createdBy !== TEST.adminId) throw new Error('createdBy 未按 __principalId 记录');
  if (data.requiredRole !== 'social_worker') throw new Error('requiredRole 未按 type 写入 social_worker');
  console.log('✅ 通过：会话写入字段正确');
}

async function run() {
  try {
    await ensureAdmin();
    await testQrInitStoresAutoBind();
    console.log('\n🎉 QR自动绑定用例通过');
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

