jest.mock('wx-server-sdk');

describe('RBAC invite/create/use for social_worker', () => {
  let rbac;
  let cloud;
  let db;

  const adminId = 'svc_admin_sw_001';
  const userId = 'svc_user_sw_001';

  const call = async (payload = {}, principal = '') => {
    return rbac.main({ ...(payload || {}), __principalId: principal || '' });
  };

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    db = cloud.database();
    // seed admin
    cloud.__setCollectionDoc('admins', adminId, {
      _id: adminId,
      username: 'root',
      role: 'admin',
      status: 'active',
      createdAt: Date.now(),
    });
    rbac = require('../../cloudfunctions/rbac/index.js');
  });

  test('admin can create social_worker invite and user can activate it', async () => {
    const created = await call({ action: 'createInvite', role: 'social_worker', uses: 1 }, adminId);
    expect(created.success).toBe(true);
    const code = created.data?.code;
    expect(code).toMatch(/^[A-Z0-9]{8}$/);

    // validate code before use
    const validate = await call({ action: 'validateInviteCode', code }, userId);
    expect(validate.success).toBe(true);
    expect(validate.data?.valid).toBe(true);
    expect(validate.data?.role).toBe('social_worker');

    // activate (use invite)
    const used = await call({ action: 'useInviteCode', code }, userId);
    expect(used.success).toBe(true);
    expect(used.data?.role).toBe('social_worker');

    // roleBinding created
    const bindings = await db
      .collection('roleBindings')
      .where({ userOpenId: userId, role: 'social_worker', state: 'active' })
      .get();
    expect((bindings.data || []).length).toBe(1);

    // usesLeft decreased to 0
    const inviteRes = await db
      .collection('invites')
      .where({ code })
      .limit(1)
      .get();
    expect(inviteRes.data?.[0]?.usesLeft).toBe(0);

    // second use should fail
    const second = await call({ action: 'useInviteCode', code }, userId);
    expect(second.success).toBe(false);
    expect(second.error?.code).toBe('INVALID_INVITE_CODE');
  });

  test('non-admin cannot add social_worker binding directly', async () => {
    const res = await call(
      { action: 'addRoleBinding', userOpenId: userId, role: 'social_worker' },
      'not_admin_001'
    );
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('FORBIDDEN');
  });
});

