const path = require('path');
const fs = require('fs');

describe('patient intake wizard validations', () => {
  function createWizardInstance() {
    jest.resetModules();
    global.Page.mockClear();
    const wizardPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'miniprogram',
      'pages',
      'patient-intake',
      'wizard',
      'wizard.js'
    );
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(wizardPath);
    });

    const configCall = global.Page.mock.calls[0];
    if (!configCall) {
      throw new Error('Wizard Page config not registered');
    }
    const config = configCall[0];
    const data = JSON.parse(JSON.stringify(config.data));

    const instance = {
      data,
      setData(updates, callback) {
        const payload =
          typeof updates === 'function' ? updates({ ...this.data }) || {} : updates || {};
        Object.keys(payload).forEach(key => {
          const value = payload[key];
          if (key.includes('.')) {
            const segments = key.split('.');
            let cursor = this.data;
            for (let i = 0; i < segments.length - 1; i += 1) {
              const segment = segments[i];
              if (cursor[segment] === undefined) {
                cursor[segment] = {};
              }
              cursor = cursor[segment];
            }
            cursor[segments[segments.length - 1]] = value;
          } else {
            this.data[key] = value;
          }
        });
        if (typeof callback === 'function') {
          callback.call(this);
        }
      },
    };

    Object.keys(config).forEach(key => {
      if (key === 'data') {
        return;
      }
      const prop = config[key];
      if (typeof prop === 'function') {
        instance[key] = prop.bind(instance);
      } else {
        instance[key] = prop;
      }
    });

    return instance;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks progression when required basic fields missing', () => {
    const page = createWizardInstance();
    page.setData({ currentStep: 0 });
    global.wx.showToast.mockClear();

    page.onNextStep();

    expect(page.data.currentStep).toBe(0);
    expect(page.data.errors.patientName).toBe('请输入住户姓名');
    expect(global.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '请输入住户姓名' })
    );
  });

  test('advances through basic and contact steps when required data present', () => {
    const page = createWizardInstance();

    page.setData({
      currentStep: 0,
      formData: {
        patientName: '张三',
        idType: '身份证',
        idNumber: '440101199901012233',
        gender: '男',
        birthDate: '2000-01-01',
        phone: '13800000000',
        address: '',
        emergencyContact: '',
        emergencyPhone: '',
        backupContact: '',
        backupPhone: '',
        situation: '',
      },
    });

    global.wx.showToast.mockClear();
    page.updateRequiredFields();
    page.onNextStep();

    expect(page.data.currentStep).toBe(1);

    page.setData({
      formData: {
        ...page.data.formData,
        address: '广州市天河区',
        emergencyContact: '李四',
        emergencyPhone: '13800000001',
      },
    });
    page.updateRequiredFields();
    page.onNextStep();

    expect(page.data.currentStep).toBe(2);

    // Steps 2 (situation) and 3 (upload) have no required fields
    page.updateRequiredFields();
    page.onNextStep();
    expect(page.data.currentStep).toBe(3);

    page.updateRequiredFields();
    page.onNextStep();
    expect(page.data.currentStep).toBe(4);

    expect(page.data.allRequiredCompleted).toBe(true);
  });

  test('phone number validation rejects invalid formats', () => {
    const page = createWizardInstance();
    page.setData({
      formData: {
        phone: '1234',
      },
    });

    const result = page.validateField('phone', '1234');
    expect(result).toBe(false);
    expect(page.data.errors.phone).toBe('手机号码格式不正确');
  });

  test('submit prevents submission when required fields incomplete', async () => {
    const page = createWizardInstance();
    page.setData({ allRequiredCompleted: false });
    page.submitIntakeData = jest.fn();
    global.wx.showToast.mockClear();

    await page.onSubmit();

    expect(global.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '请完成所有必填项' })
    );
    expect(page.submitIntakeData).not.toHaveBeenCalled();
  });

  test('submit calls cloud redirect when requirements met', async () => {
    const page = createWizardInstance();
    page.setData({
      allRequiredCompleted: true,
      submitting: false,
    });
    page.submitIntakeData = jest.fn().mockResolvedValue({
      data: {
        recordId: 'rec-01',
        patientName: '张三',
        intakeTime: '2024-10-01 10:00',
        emergencyContact: '李四',
        emergencyPhone: '13800000001',
      },
    });
    global.wx.redirectTo.mockClear();

    await page.onSubmit();

    expect(page.submitIntakeData).toHaveBeenCalled();
    expect(global.wx.redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/pages/patient-intake/success/success?'),
      })
    );
    expect(page.data.submitting).toBe(false);
  });

  test('existing patient submission keeps patientKey in redirect URL', async () => {
    const page = createWizardInstance();
    page.setData({
      allRequiredCompleted: true,
      submitting: false,
      patientKey: 'patient-existing-01',
    });
    page.submitIntakeData = jest.fn().mockResolvedValue({
      data: {
        recordId: 'rec-02',
        patientKey: 'patient-existing-01',
      },
    });
    global.wx.redirectTo.mockClear();

    await page.onSubmit();

    expect(page.submitIntakeData).toHaveBeenCalled();
    expect(global.wx.redirectTo).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('patientKey=patient-existing-01'),
      })
    );
  });

  test('wizard WXML marks numeric fields with number type', () => {
    const wxmlPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'miniprogram',
      'pages',
      'patient-intake',
      'wizard',
      'wizard.wxml'
    );
    const wxmlContent = fs.readFileSync(wxmlPath, 'utf8');

    expect(wxmlContent).toMatch(/data-field="phone"[\s\S]*?type="number"/);
    expect(wxmlContent).toMatch(/data-field="emergencyPhone"[\s\S]*?type="number"/);
    expect(wxmlContent).toMatch(/data-field="idNumber"[\s\S]*?clearable="\{\{true\}\}"/);
  });

  test('wizard inputs include hint text for guidance', () => {
    const wxmlPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'miniprogram',
      'pages',
      'patient-intake',
      'wizard',
      'wizard.wxml'
    );
    const wxmlContent = fs.readFileSync(wxmlPath, 'utf8');

    expect(wxmlContent).toMatch(/data-field="idNumber"[\s\S]*?hint="示例：身份证格式为18位数字"/);
    expect(wxmlContent).toMatch(/data-field="phone"[\s\S]*?hint="示例：13812345678"/);
  });

  test('emergency contact display ignores relationship-only input', () => {
    const page = createWizardInstance();
    page.setData({ currentStep: 1 });

    page.updateFormData({
      contacts: [{ relationship: '父亲', name: '', phone: '13800000000' }],
    });
    page.updateRequiredFields();

    expect(page.data.formData.contacts[0]).toEqual({
      relationship: '父亲',
      name: '',
      phone: '13800000000',
    });
    expect(page.data.formData.emergencyContact).toBe('');
  });

  test('emergency contact display keeps relationship when name present', () => {
    const page = createWizardInstance();
    page.setData({ currentStep: 1 });

    page.updateFormData({
      contacts: [{ relationship: '母亲', name: '张翠花', phone: '13800000001' }],
    });
    page.updateRequiredFields();

    expect(page.data.formData.contacts[0]).toEqual({
      relationship: '母亲',
      name: '张翠花',
      phone: '13800000001',
    });
    expect(page.data.formData.emergencyContact).toBe('母亲 张翠花');
  });

  test('existing intake allows relaxed contact validation with formatted phone', () => {
    const page = createWizardInstance();
    page.setData({
      isEditingExisting: true,
    });

    page.updateFormData({
      contacts: [{ relationship: '', name: '李四', phone: '138-0000-0001' }],
      emergencyContact: '李四',
      emergencyPhone: '138-0000-0001',
    });

    expect(page.data.formData.contacts[0].name).toBe('李四');
    expect(page.data.formData.contacts[0].phone).toBe('13800000001');
    expect(page.data.formData.emergencyPhone).toBe('13800000001');

    const missing = page.getAllMissingRequiredFields();
    const contactsMissing = missing.find(item => item.key === 'contacts');
    expect(contactsMissing).toBeUndefined();
  });

  test('_extractEmergencyContactFromProfile combines separate name and phone fields', () => {
    const page = createWizardInstance();

    const result = page._extractEmergencyContactFromProfile([
      { label: '紧急联系人', value: '王大锤' },
      { label: '紧急联系电话', value: '138 0000 1234' },
      { label: '家庭地址', value: '广州市白云区' },
    ]);

    expect(result).toEqual({ emergencyContact: '王大锤', emergencyPhone: '13800001234' });
  });

  test('_extractEmergencyContactFromProfile handles structured value objects', () => {
    const page = createWizardInstance();

    const result = page._extractEmergencyContactFromProfile([
      {
        label: '备用联系人',
        value: { name: '李小花', mobilePhone: '139-8888-7777' },
      },
    ]);

    expect(result).toEqual({ emergencyContact: '李小花', emergencyPhone: '13988887777' });
  });

  test('buildContactsFromFields parses guardian text fields', () => {
    const page = createWizardInstance();

    const contacts = page.buildContactsFromFields({
      additionalText: [
        { text: '黄华珍 18677071490', relation: '母亲' },
        { text: '黄华珍 18677071490', relation: '母亲' },
      ],
    });

    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toEqual({
      relationship: '母亲',
      name: '黄华珍',
      phone: '18677071490',
    });
  });
});
