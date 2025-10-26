// 验证 createInvite 返回 sharePath，且 listInvites 能返回相同 sharePath
const cloud = require('wx-server-sdk');

cloud.init({
  env: process.env.TCB_ENV || process.env.SCF_NAMESPACE || process.env.TENCENTCLOUD_ENV,
});

async function main() {
  const role = 'volunteer';
  const uses = 1;

  try {
    console.log('🧪 创建邀请码并校验 sharePath...');
    const createRes = await cloud.callFunction({
      name: 'rbac',
      data: { action: 'createInvite', role, uses, note: 'sharePath-test', __principalId: 'test_admin_001' },
    });
    const { success, data, error } = createRes.result || {};
    if (!success) {
      console.error('❌ createInvite 失败:', error);
      return;
    }

    const { code, inviteId, sharePath } = data || {};
    console.log('✅ createInvite 返回:', { code, inviteId, sharePath });
    const codeOk = /^[A-Z0-9]{8}$/.test(code || '');
    const pathOk = typeof sharePath === 'string' && sharePath.includes(code);
    if (!codeOk || !pathOk) {
      console.error('❌ sharePath 校验未通过:', sharePath);
      return;
    }

    console.log('🧪 listInvites 校验 sharePath...');
    const listRes = await cloud.callFunction({
      name: 'rbac',
      data: { action: 'listInvites', page: 1, pageSize: 50, state: 'active', __principalId: 'test_admin_001' },
    });
    const listOk = listRes.result && listRes.result.success;
    if (!listOk) {
      console.error('❌ listInvites 调用失败:', listRes.result && listRes.result.error);
      return;
    }
    const items = (listRes.result.data && listRes.result.data.items) || [];
    const found = items.find((it) => it && it.code === code);
    if (!found) {
      console.error('❌ listInvites 未找到刚创建的邀请');
      return;
    }
    if (found.sharePath !== sharePath) {
      console.error('❌ listInvites 返回的 sharePath 不一致:', found.sharePath, sharePath);
      return;
    }

    console.log('✅ 测试通过：sharePath 返回正确且与列表一致');
  } catch (e) {
    console.error('❌ 测试执行异常:', e);
  }
}

main();

