const adminId = 'admin-1';
const adminUserInfo = { customUserId: adminId };

const buildPatientPayload = overrides => ({
  patientName: '张三',
  gender: '男',
  birthDate: '2012-05-01',
  idNumber: '410101201201012345',
  phone: '13800000000',
  nativePlace: '河南省周口市',
  address: '河南省周口市',
  summaryCaregivers: '父母',
  ...overrides,
});

describe('patientProfile cloud function', () => {
  let patientProfile;
  let cloud;

  const loadModule = () => {
    patientProfile = require('../../cloudfunctions/patientProfile/index.js');
  };

  const call = async payload => {
    return patientProfile.main({ userInfo: adminUserInfo, ...payload });
  };

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    cloud.__setCollectionDoc('admins', adminId, {
      _id: adminId,
      username: 'root',
      status: 'active',
      role: 'admin',
    });
    loadModule();
  });

  test('create patient succeeds with minimum required fields', async () => {
    const result = await call({ action: 'create', data: buildPatientPayload() });
    expect(result.success).toBe(true);
    const stored = cloud.__getCollectionDoc('patients', result.patientKey);
    expect(stored).toBeTruthy();
    expect(stored.patientName).toBe('张三');
    expect(stored.careStatus).toBe('in_care');
    expect(Array.isArray(stored.familyContacts || [])).toBe(true);
  });

  test('create patient rejects duplicate idNumber', async () => {
    await call({ action: 'create', data: buildPatientPayload({ idNumber: '1234567890' }) });
    const result = await call({
      action: 'create',
      data: buildPatientPayload({ patientName: '李四', idNumber: '1234567890', phone: '13900000000' }),
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('DUPLICATE_PATIENT');
  });

  test('create patient requires idNumber or phone', async () => {
    const result = await call({
      action: 'create',
      data: buildPatientPayload({ idNumber: '', phone: '', backupPhone: '' }),
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_INPUT');
  });

  test('update patient merges fields and recalculates contacts', async () => {
    const created = await call({ action: 'create', data: buildPatientPayload() });
    expect(created.success).toBe(true);

    const updateResult = await call({
      action: 'update',
      patientKey: created.patientKey,
      patch: {
        phone: '13900000000',
        careStatus: 'discharged',
        checkoutAt: '2024-01-10',
        backupContact: '王五',
        backupPhone: '13100000000',
      },
    });

    expect(updateResult.success).toBe(true);
    const stored = cloud.__getCollectionDoc('patients', created.patientKey);
    expect(stored.phone).toBe('13900000000');
    expect(stored.careStatus).toBe('discharged');
    expect(stored.checkoutAt).toBe('2024-01-10');
    const backupContact = stored.familyContacts.find(item => item.role === 'backup');
    expect(backupContact).toBeTruthy();
    expect(backupContact.phone).toBe('13100000000');
  });

  test('list supports keyword and status filtering', async () => {
    const first = await call({ action: 'create', data: buildPatientPayload() });
    const second = await call({
      action: 'create',
      data: buildPatientPayload({
        patientName: '李四',
        idNumber: '987654321',
        phone: '13700000000',
        nativePlace: '湖北省武汉市',
      }),
    });
    expect(first.success && second.success).toBe(true);

    await call({
      action: 'update',
      patientKey: second.patientKey,
      patch: { careStatus: 'discharged' },
    });

    const filterRes = await call({
      action: 'list',
      filters: { careStatus: 'discharged' },
      includeTotal: true,
    });
    expect(filterRes.success).toBe(true);
    expect(filterRes.patients).toHaveLength(1);
    expect(filterRes.patients[0].patientName).toBe('李四');

    const keywordRes = await call({
      action: 'list',
      keyword: '13700000000',
    });
    expect(keywordRes.patients).toHaveLength(1);
    expect(keywordRes.patients[0].patientName).toBe('李四');
  });

  test('create rejects unauthorized request', async () => {
    const result = await patientProfile.main({ action: 'create', data: buildPatientPayload() });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FORBIDDEN');
  });
});
