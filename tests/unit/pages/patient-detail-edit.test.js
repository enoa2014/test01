const path = require('path');

describe('patient detail edit flow', () => {
  function createDetailInstance() {
    jest.resetModules();
    global.Page.mockClear();

    const detailPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'miniprogram',
      'pages',
      'patient-detail',
      'detail.js'
    );

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(detailPath);
    });

    const configCall = global.Page.mock.calls[0];
    if (!configCall) {
      throw new Error('Detail Page config not registered');
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
            const parts = key.split('.');
            let cursor = this.data;
            for (let i = 0; i < parts.length - 1; i += 1) {
              const part = parts[i];
              if (cursor[part] === undefined) {
                cursor[part] = {};
              }
              cursor = cursor[part];
            }
            cursor[parts[parts.length - 1]] = value;
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

  test('onEditStart loads original form and toggles edit mode', () => {
    const page = createDetailInstance();
    page.originalEditForm = { patientName: '张三', phone: '13800000000' };
    page.setData({ editMode: false, editForm: {} });

    page.onEditStart();

    expect(page.data.editMode).toBe(true);
    expect(page.data.editForm.patientName).toBe('张三');
    expect(page.data.editDirty).toBe(false);
    expect(page.data.editCanSave).toBe(false);
  });

  test('updateEditFormValue validates phone format and marks dirty', () => {
    const page = createDetailInstance();
    page.originalEditForm = { phone: '13800000000' };
    page.setData({ editForm: { phone: '13800000000' }, editErrors: {}, editDirty: false });

    page.updateEditFormValue('phone', '1234');

    expect(page.data.editErrors.phone).toBe('手机号格式不正确');
    expect(page.data.editDirty).toBe(true);
  });

  test('clearable input resets value and clears error state', () => {
    const page = createDetailInstance();
    page.originalEditForm = { phone: '13800000000' };
    page.setData({
      editForm: { phone: '13800000000' },
      editErrors: { phone: '手机号格式不正确' },
      editDirty: true,
      editCanSave: false,
    });

    page.updateEditFormValue('phone', '');

    expect(page.data.editForm.phone).toBe('');
    expect(page.data.editErrors.phone).toBeUndefined();
    expect(page.data.editDirty).toBe(true);
    expect(page.data.editCanSave).toBe(true);
  });

  test('onSaveTap blocks when validation errors exist', async () => {
    const page = createDetailInstance();
    page.patientKey = 'patient-001';
    page.originalEditForm = {
      patientName: '张三',
      idType: '身份证',
      idNumber: '440101199001011234',
      gender: '男',
      birthDate: '2000-01-01',
      address: '广州市',
    };
    page.setData({
      editMode: true,
      editForm: {
        patientName: '',
        idType: '身份证',
        idNumber: '',
        gender: '男',
        birthDate: '2000-01-01',
        address: '',
      },
      editErrors: {},
    });
    page.familyInfoSource = [];
    page.patientForEditSource = {};
    page.patientDisplaySource = {};
    global.wx.showToast.mockClear();
    global.wx.cloud.callFunction.mockClear();

    await page.onSaveTap();

    expect(global.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '请修正校验错误后再保存' })
    );
    expect(global.wx.cloud.callFunction).not.toHaveBeenCalled();
  });

  test('onSaveTap submits changes when form is valid and dirty', async () => {
    const page = createDetailInstance();
    page.patientKey = 'patient-002';
    page.originalEditForm = {
      patientName: '张三',
      idType: '身份证',
      idNumber: '440101199001011234',
      gender: '男',
      birthDate: '2000-01-01',
      phone: '13800000000',
      address: '广州市',
      intakeDocId: 'intake-123',
      intakeUpdatedAt: 1700000000000,
    };
    page.setData({
      editMode: true,
      editForm: {
        ...page.originalEditForm,
        phone: '13800000002',
      },
      editErrors: {},
    });
    page.markPatientListDirty = jest.fn();
    page.updateDetailSummary = jest.fn();
    page.fetchPatientDetail = jest.fn().mockResolvedValue();
    global.wx.showToast.mockClear();
    global.wx.cloud.callFunction.mockResolvedValue({ result: { success: true } });

    await page.onSaveTap();

    expect(global.wx.cloud.callFunction).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'patientIntake',
        data: expect.objectContaining({
          patientKey: 'patient-002',
          patientUpdates: expect.objectContaining({ phone: '13800000002' }),
        }),
      })
    );
    expect(global.wx.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '保存成功' })
    );
    expect(page.markPatientListDirty).toHaveBeenCalled();
    expect(page.updateDetailSummary).toHaveBeenCalled();
    expect(page.fetchPatientDetail).toHaveBeenCalled();
    expect(page.data.editMode).toBe(false);
  });
});
