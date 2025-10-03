const path = require('path');

describe('patient intake select page search & pagination', () => {
  const samplePatients = [
    {
      key: 'patient-1',
      patientName: '张三',
      idNumber: 'ID-001',
      phone: '13800000001',
      admissionCount: 2,
      latestAdmissionDate: 1711929600000,
    },
    {
      key: 'patient-2',
      patientName: '李四',
      idNumber: 'ID-002',
      phone: '13800000002',
      admissionCount: 1,
      latestAdmissionDate: 1714521600000,
    },
    {
      key: 'patient-3',
      patientName: '王目标',
      idNumber: 'ID-003',
      phone: '13800000003',
      admissionCount: 0,
      latestAdmissionDate: 1709251200000,
    },
    {
      key: 'patient-4',
      patientName: '赵六',
      idNumber: 'ID-004',
      phone: '13800000004',
      admissionCount: 5,
      latestAdmissionDate: 1698777600000,
    },
  ];

  function createPageInstance() {
    jest.resetModules();
    global.wx.getStorageSync.mockReset();
    global.wx.getStorageSync.mockReturnValue(null);
    global.wx.setStorageSync.mockReset();
    global.Page.mockClear();

    const pagePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'miniprogram',
      'pages',
      'patient-intake',
      'select',
      'select.js'
    );

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(pagePath);
    });

    const config = global.Page.mock.calls[0][0];
    const data = JSON.parse(JSON.stringify(config.data));

    const instance = {
      data,
      setData(updates, callback) {
        const payload = typeof updates === 'function' ? updates(this.data) || {} : updates || {};
        Object.assign(this.data, payload);
        if (typeof callback === 'function') {
          callback.call(this);
        }
      },
    };

    Object.keys(config).forEach(key => {
      if (key === 'data') {
        return;
      }
      const value = config[key];
      if (typeof value === 'function') {
        instance[key] = value.bind(instance);
      } else {
        instance[key] = value;
      }
    });

    return instance;
  }

  test('search filters against the full dataset and can match non-visible entries', () => {
    const page = createPageInstance();
    page.setData(
      {
        loading: false,
        pageSize: 2,
        allPatients: samplePatients,
      },
      () => page.applySearch()
    );

    expect(page.data.displayPatients).toHaveLength(2);
    expect(page.data.filteredPatients).toHaveLength(4);
    expect(page.data.hasMore).toBe(true);

    page.onSearchInput({ detail: { value: '目标' } });

    expect(page.data.searchKeyword).toBe('目标');
    expect(page.data.filteredPatients.map(item => item.key)).toEqual(['patient-3']);
    expect(page.data.displayPatients.map(item => item.key)).toEqual(['patient-3']);
    expect(page.data.hasMore).toBe(false);
  });

  test('load more appends subsequent pages from filtered dataset', () => {
    const page = createPageInstance();
    page.setData(
      {
        loading: false,
        pageSize: 2,
        allPatients: samplePatients,
      },
      () => page.applySearch()
    );

    expect(page.data.displayPatients).toHaveLength(2);
    expect(page.data.hasMore).toBe(true);

    page.onLoadMore();

    expect(page.data.displayPatients.map(item => item.key)).toEqual([
      'patient-1',
      'patient-2',
      'patient-3',
      'patient-4',
    ]);
    expect(page.data.hasMore).toBe(false);
    expect(page.data.currentPage).toBe(1);
  });

  test('clearing search restores pagination baseline', () => {
    const page = createPageInstance();
    page.setData(
      {
        loading: false,
        pageSize: 2,
        allPatients: samplePatients,
      },
      () => page.applySearch()
    );

    page.onSearchInput({ detail: { value: '赵六' } });
    expect(page.data.displayPatients.map(item => item.key)).toEqual(['patient-4']);

    page.onClearSearch();

    expect(page.data.searchKeyword).toBe('');
    expect(page.data.displayPatients.map(item => item.key)).toEqual(['patient-1', 'patient-2']);
    expect(page.data.filteredPatients).toHaveLength(4);
    expect(page.data.hasMore).toBe(true);
    expect(page.data.currentPage).toBe(0);
  });
});
