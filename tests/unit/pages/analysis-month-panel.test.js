const path = require('path');

describe('analysis month panel ordering', () => {
  function loadPageConfig() {
    jest.resetModules();
    global.Page.mockClear();

    const pagePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'wx-project',
      'pages',
      'analysis',
      'index.js'
    );

    jest.isolateModules(() => {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require(pagePath);
    });

    const configCall = global.Page.mock.calls[0];
    if (!configCall) {
      throw new Error('Page configuration not registered');
    }
    return configCall[0];
  }

  test('orders months by recency and keeps unknown at the end', () => {
    const pageConfig = loadPageConfig();
    const buildPanels = pageConfig.buildPanels;

    const samplePatients = [
      {
        key: 'latest',
        patientName: '甲',
        latestAdmissionTimestamp: Date.UTC(2024, 7, 10), // 2024-08
      },
      {
        key: 'mid',
        patientName: '乙',
        latestAdmissionDateFormatted: '2024-07-05',
      },
      {
        key: 'old',
        patientName: '丙',
        latestAdmissionDate: '2023-12-20',
      },
      {
        key: 'unknown',
        patientName: '丁',
      },
    ];

    const panels = buildPanels.call(pageConfig, samplePatients);
    const monthPanel = panels.find(panel => panel.panelKey === 'month');
    expect(monthPanel).toBeTruthy();

    const labels = monthPanel.stats.map(stat => stat.label);
    const knownMonths = labels.slice(0, -1);
    const sortedByTime = [...knownMonths].sort();
    expect(knownMonths).toEqual(sortedByTime);
    expect(labels[labels.length - 1]).toBe('未知月份');
  });
});
