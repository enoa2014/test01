jest.mock('wx-server-sdk');

describe('patientIntake updatePatient', () => {
  let patientIntake;
  let cloud;
  const PATIENT_COLLECTION = 'patients';
  const INTAKE_COLLECTION = 'patient_intake_records';
  const LOG_COLLECTION = 'patient_operation_logs';

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
    cloud = require('wx-server-sdk');
    cloud.__reset();
    patientIntake = require('../../cloudfunctions/patientIntake/index.js');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const seedPatient = (patientKey, overrides = {}) => {
    const base = {
      _id: patientKey,
      patientName: '张三',
      idType: '身份证',
      idNumber: '1234567890',
      gender: '男',
      birthDate: 946656000000,
      phone: '13300000000',
      address: '旧地址',
      emergencyContact: '李四',
      emergencyPhone: '13300000001',
      backupContact: '王五',
      backupPhone: '13300000002',
      lastIntakeNarrative: 'old narrative',
      updatedAt: 1600000000000,
      createdAt: 1590000000000
    };
    cloud.__setCollectionDoc(PATIENT_COLLECTION, patientKey, { ...base, ...overrides });
  };

  const seedIntake = (intakeId, patientKey, overrides = {}) => {
    const base = {
      _id: intakeId,
      patientKey,
      basicInfo: {
        patientName: '张三',
        idType: '身份证',
        idNumber: '1234567890',
        gender: '男',
        birthDate: 946656000000,
        phone: '13300000000'
      },
      contactInfo: {
        address: '旧地址',
        emergencyContact: '李四',
        emergencyPhone: '13300000001',
        backupContact: '王五',
        backupPhone: '13300000002'
      },
      intakeInfo: {
        intakeTime: 1600000000000,
        situation: 'old narrative',
        followUpPlan: 'old plan',
        medicalHistory: ['糖尿病'],
        attachments: []
      },
      metadata: {
        submittedAt: 1600000000000,
        lastModifiedAt: 1600000000000
      },
      updatedAt: 1600000000000
    };
    cloud.__setCollectionDoc(INTAKE_COLLECTION, intakeId, { ...base, ...overrides });
  };

  const getLogs = async () => {
    const db = cloud.database();
    const res = await db.collection(LOG_COLLECTION).get();
    return res.data || [];
  };

  test('updates patient and intake records and records operation log', async () => {
    const patientKey = 'patient-1';
    const intakeId = 'intake-1';
    seedPatient(patientKey);
    seedIntake(intakeId, patientKey);

    const result = await patientIntake.main({
      action: 'updatePatient',
      patientKey,
      patientUpdates: {
        patientName: '李雷',
        phone: '13311112222',
        address: '新地址',
        lastIntakeNarrative: '最新情况',
        expectedUpdatedAt: 1600000000000
      },
      intakeUpdates: {
        intakeId,
        expectedUpdatedAt: 1600000000000,
        basicInfo: {
          patientName: '李雷',
          phone: '13311112222'
        },
        contactInfo: {
          address: '新地址',
          emergencyContact: '韩梅梅',
          emergencyPhone: '13311112223'
        },
        intakeInfo: {
          intakeTime: 1650000000000,
          followUpPlan: '新的计划',
          situation: '最新情况'
        },
        medicalHistory: ['糖尿病', '高血压'],
        attachments: [{ id: 'att-1', displayName: '方案.pdf' }]
      },
      audit: {
        message: '患者详情页内联编辑',
        changes: ['patientName', 'phone', 'followUpPlan']
      }
    });

    expect(result.success).toBe(true);
    expect(result.data.patientKey).toBe(patientKey);

    const updatedPatient = cloud.__getCollectionDoc(PATIENT_COLLECTION, patientKey);
    expect(updatedPatient.patientName).toBe('李雷');
    expect(updatedPatient.address).toBe('新地址');
    expect(updatedPatient.updatedAt).toBe(1700000000000);
    expect(updatedPatient.lastIntakeNarrative).toBe('最新情况');

    const updatedIntake = cloud.__getCollectionDoc(INTAKE_COLLECTION, intakeId);
    expect(updatedIntake.intakeInfo.followUpPlan).toBe('新的计划');
    expect(updatedIntake.intakeInfo.medicalHistory).toEqual(['糖尿病', '高血压']);
    expect(updatedIntake.metadata.lastModifiedAt).toBe(1700000000000);
    expect(updatedIntake.updatedAt).toBe(1700000000000);

    const logs = await getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].changes).toEqual(['patientName', 'phone', 'followUpPlan']);
    expect(logs[0].patientKey).toBe(patientKey);
  });

  test('throws version conflict when patient timestamp mismatches', async () => {
    const patientKey = 'patient-2';
    const intakeId = 'intake-2';
    seedPatient(patientKey);
    seedIntake(intakeId, patientKey);

    const result = await patientIntake.main({
      action: 'updatePatient',
      patientKey,
      patientUpdates: {
        patientName: '李雷',
        expectedUpdatedAt: 1500000000000
      },
      intakeUpdates: {
        intakeId,
        expectedUpdatedAt: 1600000000000
      },
      audit: {}
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('VERSION_CONFLICT');
  });

  test('throws intake version conflict when intake timestamp mismatches', async () => {
    const patientKey = 'patient-3';
    const intakeId = 'intake-3';
    seedPatient(patientKey);
    seedIntake(intakeId, patientKey);

    const result = await patientIntake.main({
      action: 'updatePatient',
      patientKey,
      patientUpdates: {
        expectedUpdatedAt: 1600000000000
      },
      intakeUpdates: {
        intakeId,
        expectedUpdatedAt: 1500000000000
      },
      audit: {}
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INTAKE_VERSION_CONFLICT');
  });

  test('returns error when no field changes detected', async () => {
    const patientKey = 'patient-4';
    const intakeId = 'intake-4';
    seedPatient(patientKey);
    seedIntake(intakeId, patientKey);

    const result = await patientIntake.main({
      action: 'updatePatient',
      patientKey,
      patientUpdates: {
        expectedUpdatedAt: 1600000000000
      },
      intakeUpdates: {
        intakeId,
        expectedUpdatedAt: 1600000000000
      },
      audit: {}
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('NO_CHANGES');
  });
});

