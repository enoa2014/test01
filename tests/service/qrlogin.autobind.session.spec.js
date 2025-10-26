jest.mock('wx-server-sdk');

describe('QRLogin qrInit autoBind session fields', () => {
  let qrLogin;
  let cloud;
  let db;

  const adminId = 'svc_admin_qr_001';

  const call = async (payload = {}) => {
    return qrLogin.main(payload);
  };

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    db = cloud.database();
    // seed admin for createdBy reference (not required by qrInit logic, but closer to real)
    cloud.__setCollectionDoc('admins', adminId, {
      _id: adminId,
      username: 'root',
      role: 'admin',
      status: 'active',
      createdAt: Date.now(),
    });
    qrLogin = require('../../cloudfunctions/qrLogin/index.js');
  });

  test('qrInit writes autoBind/createdBy/requiredRole, parseQR issues approveNonce', async () => {
    const init = await call({
      action: 'qrInit',
      type: 'social_worker',
      autoBind: true,
      __principalId: adminId,
      deviceInfo: { userAgent: 'jest' },
      metadata: { source: 'svc-test' },
    });
    expect(init.success).toBe(true);
    const { sessionId, qrData } = init.data || {};
    expect(sessionId).toBeTruthy();
    expect(qrData).toBeTruthy();

    const doc = await db.collection('qrLoginSessions').doc(sessionId).get();
    expect(doc.data.autoBind).toBe(true);
    expect(doc.data.createdBy).toBe(adminId);
    expect(doc.data.requiredRole).toBe('social_worker');

    const parsed = await call({ action: 'parseQR', qrData, deviceInfo: { screenResolution: '1920x1080' } });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.approveNonce).toBeTruthy();
  });
});

