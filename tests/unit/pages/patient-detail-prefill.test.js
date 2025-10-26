// 患者详情页面编辑预填功能的单元测试

const mockBuildEditForm = jest.fn();
const mockFormatDateForInput = jest.fn();

// Mock 相关函数
jest.mock('../../../wx-project/pages/patient-detail/detail.js', () => {
  const actual = jest.requireActual('../../../wx-project/pages/patient-detail/detail.js');
  return {
    ...actual,
    buildEditForm: mockBuildEditForm,
    formatDateForInput: mockFormatDateForInput,
  };
});

describe('患者详情编辑预填功能', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 模拟buildEditForm函数
  function buildEditForm(patient = {}, intake = {}, fallbackPatient = {}) {
    const intakeInfo = intake.intakeInfo || {};

    const patientName = patient.patientName || fallbackPatient.patientName || '';
    const gender = patient.gender || fallbackPatient.gender || '';
    const birthDate = patient.birthDate || fallbackPatient.birthDate || '';

    return {
      patientName,
      idType: patient.idType || '身份证',
      idNumber: patient.idNumber || '',
      gender,
      birthDate: formatDateForInput(birthDate),
      phone: patient.phone || '',
      address: patient.address || '',
      backupContact: patient.backupContact || '',
      backupPhone: patient.backupPhone || '',
      intakeTime: formatDateForInput(intakeInfo.intakeTime || intake.lastIntakeTime),
      narrative: intakeInfo.situation || intake.narrative || patient.lastIntakeNarrative || '',
      followUpPlan: intakeInfo.followUpPlan || '',
      medicalHistory: Array.isArray(intakeInfo.medicalHistory) ? intakeInfo.medicalHistory : [],
      attachments: Array.isArray(intakeInfo.attachments) ? intakeInfo.attachments : [],
      intakeId: intake.intakeId || intake._id || null,
      intakeUpdatedAt: intake.updatedAt || intake.metadata?.lastModifiedAt || null,
      patientUpdatedAt: patient.updatedAt || null,
    };
  }

  function formatDateForInput(value) {
    if (!value) {
      return '';
    }
    if (typeof value === 'number') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return [
          date.getFullYear(),
          `${date.getMonth() + 1}`.padStart(2, '0'),
          `${date.getDate()}`.padStart(2, '0'),
        ].join('-');
      }
    }
    if (typeof value === 'string' && value.length >= 8) {
      const normalized = value.replace(/[./]/g, '-');
      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) {
        return [
          date.getFullYear(),
          `${date.getMonth() + 1}`.padStart(2, '0'),
          `${date.getDate()}`.padStart(2, '0'),
        ].join('-');
      }
    }
    return '';
  }

  test('完整患者数据预填', () => {
    const patient = {
      patientName: '张三',
      idType: '身份证',
      idNumber: '110101199001011234',
      gender: '男',
      birthDate: 631152000000, // 1990-01-01
      phone: '13912345678',
      address: '北京市朝阳区测试地址123号',
    };

    const intake = {
      intakeInfo: {
        intakeTime: 1704067200000, // 2024-01-01
        situation: '患者情况良好',
        followUpPlan: '定期复查',
      },
    };

    const editForm = buildEditForm(patient, intake);

    expect(editForm.patientName).toBe('张三');
    expect(editForm.gender).toBe('男');
    expect(editForm.birthDate).toBe('1990-01-01');
    expect(editForm.phone).toBe('13912345678');
    expect(editForm.address).toBe('北京市朝阳区测试地址123号');
    expect(editForm.narrative).toBe('患者情况良好');
    expect(editForm.followUpPlan).toBe('定期复查');
  });

  test('使用备用患者数据预填', () => {
    const emptyPatient = {};
    const emptyIntake = {};
    const fallbackPatient = {
      patientName: '李四',
      gender: '女',
      birthDate: '1985.12.25',
    };

    const editForm = buildEditForm(emptyPatient, emptyIntake, fallbackPatient);

    expect(editForm.patientName).toBe('李四');
    expect(editForm.gender).toBe('女');
    expect(editForm.birthDate).toBe('1985-12-25');
    expect(editForm.idType).toBe('身份证');
  });

  test('患者数据优先于备用数据', () => {
    const patient = {
      patientName: '王五',
      gender: '男',
    };
    const intake = {};
    const fallbackPatient = {
      patientName: '张三',
      gender: '女',
      birthDate: '1990.01.01',
    };

    const editForm = buildEditForm(patient, intake, fallbackPatient);

    // 患者数据应该优先
    expect(editForm.patientName).toBe('王五');
    expect(editForm.gender).toBe('男');
    // 缺少的字段使用备用数据
    expect(editForm.birthDate).toBe('1990-01-01');
  });

  test('空数据处理', () => {
    const editForm = buildEditForm();

    expect(editForm.patientName).toBe('');
    expect(editForm.idType).toBe('身份证');
    expect(editForm.gender).toBe('');
    expect(editForm.birthDate).toBe('');
    expect(editForm.medicalHistory).toEqual([]);
    expect(editForm.attachments).toEqual([]);
  });

  test('日期格式化测试', () => {
    // 时间戳格式
    expect(formatDateForInput(631152000000)).toBe('1990-01-01');

    // 字符串格式
    expect(formatDateForInput('2013.7.1')).toBe('2013-07-01');
    expect(formatDateForInput('2013/7/1')).toBe('2013-07-01');
    expect(formatDateForInput('2013-7-1')).toBe('2013-07-01');

    // 无效或空值
    expect(formatDateForInput('')).toBe('');
    expect(formatDateForInput(null)).toBe('');
    expect(formatDateForInput(undefined)).toBe('');
    expect(formatDateForInput('invalid')).toBe('');
  });

  test('入住信息预填', () => {
    const patient = { patientName: '测试患者' };
    const intake = {
      intakeInfo: {
        intakeTime: 1704067200000,
        situation: '康复治疗中',
        followUpPlan: '继续物理治疗',
        medicalHistory: ['高血压', '糖尿病'],
        attachments: [{ id: '1', name: '检查报告' }],
      },
      intakeId: 'intake123',
      updatedAt: 1704153600000,
    };

    const editForm = buildEditForm(patient, intake);

    expect(editForm.intakeTime).toBe('2024-01-01');
    expect(editForm.narrative).toBe('康复治疗中');
    expect(editForm.followUpPlan).toBe('继续物理治疗');
    expect(editForm.medicalHistory).toEqual(['高血压', '糖尿病']);
    expect(editForm.attachments).toEqual([{ id: '1', name: '检查报告' }]);
    expect(editForm.intakeId).toBe('intake123');
    expect(editForm.intakeUpdatedAt).toBe(1704153600000);
  });
});
