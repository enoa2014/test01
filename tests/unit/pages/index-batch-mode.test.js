const path = require('path');

describe('index page batch mode behaviour', () => {
  function createIndexPage() {
    jest.resetModules();
    global.Page.mockClear();

    const pagePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'miniprogram',
      'pages',
      'index',
      'index.js'
    );

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(pagePath);
    });

    const configCall = global.Page.mock.calls[0];
    if (!configCall) {
      throw new Error('Index Page config not registered');
    }

    const config = configCall[0];
    const data = JSON.parse(JSON.stringify(config.data || {}));

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
    wx.showToast.mockClear();
    wx.showActionSheet.mockClear();
  });

  test('onPatientTap toggles selection when provided patient detail', () => {
    const page = createIndexPage();
    page.setData({ batchMode: true, selectedPatientMap: {} });

    const patient = { patientKey: 'p1', patientName: '张三' };
    const setBatchStateSpy = jest.spyOn(page, 'setBatchState').mockImplementation(() => {});

    page.onPatientTap({ detail: { patient } });

    expect(setBatchStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ p1: patient }),
      true
    );

    setBatchStateSpy.mockRestore();
  });

  test('onPatientTap removes selection when patient already selected', () => {
    const page = createIndexPage();
    const patient = { patientKey: 'p1', patientName: '张三' };
    page.setData({ batchMode: true, selectedPatientMap: { p1: patient } });

    const setBatchStateSpy = jest.spyOn(page, 'setBatchState').mockImplementation(() => {});

    page.onPatientTap({ detail: { patient } });

    expect(setBatchStateSpy).toHaveBeenCalledWith({}, true);

    setBatchStateSpy.mockRestore();
  });

  test('onPatientTap toggles selection using dataset payload', () => {
    const page = createIndexPage();
    const patient = { key: 'p2', patientKey: 'p2', patientName: '李四' };
    page.setData({
      batchMode: true,
      selectedPatientMap: {},
      patients: [patient],
      displayPatients: [patient],
    });

    const setBatchStateSpy = jest.spyOn(page, 'setBatchState').mockImplementation(() => {});

    page.onPatientTap({
      currentTarget: {
        dataset: { key: 'p2', patientKey: 'p2', recordKey: 'p2' },
      },
    });

    expect(setBatchStateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ p2: expect.objectContaining({ patientKey: 'p2' }) }),
      true
    );

    setBatchStateSpy.mockRestore();
  });

  test('showPatientActionSheet batches expose only bulk operations', () => {
    const page = createIndexPage();
    const patientA = { patientKey: 'pa', patientName: '甲' };
    const patientB = { patientKey: 'pb', patientName: '乙' };

    page.setData({
      batchMode: true,
      selectedPatientMap: { pa: patientA, pb: patientB },
      testCaptureActionSheet: true,
      testLastActionSheet: [],
    });

    page.showPatientActionSheet(patientA, { batch: true });

    expect(page.data.testLastActionSheet).toEqual([
      '批量修改状态',
      '批量导出报告',
      '批量删除住户',
    ]);
  });
});
