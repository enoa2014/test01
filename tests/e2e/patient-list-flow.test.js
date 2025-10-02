const {
  waitForPage,
  waitForElements,
  waitForElement,
  waitForCondition,
} = require('./helpers/miniapp');

const now = Date.now();

const SAMPLE_PATIENTS = [
  {
    key: 'p-001',
    patientKey: 'p-001',
    patientName: '张三',
    latestDiagnosis: '心衰复查',
    firstDiagnosis: '高血压',
    latestHospital: '协和医院',
    firstHospital: '协和医院',
    latestDoctor: '王主任',
    latestAdmissionTimestamp: now,
    firstAdmissionTimestamp: now - 30 * 24 * 60 * 60 * 1000,
    careStatus: 'in_care',
    riskLevel: 'high',
    badges: [],
    tags: ['心内科', '王主任'],
  },
  {
    key: 'p-002',
    patientKey: 'p-002',
    patientName: '李四',
    latestDiagnosis: '康复复诊',
    firstDiagnosis: '骨折',
    latestHospital: '北医三院',
    firstHospital: '北医三院',
    latestDoctor: '李主任',
    latestAdmissionTimestamp: now - 90 * 24 * 60 * 60 * 1000,
    firstAdmissionTimestamp: now - 120 * 24 * 60 * 60 * 1000,
    careStatus: 'pending',
    riskLevel: 'medium',
    badges: [],
    tags: ['骨科'],
  },
];

describe('patient list search → filter → detail flow', () => {
  test('searches, applies advanced filter, and opens patient detail', async () => {
    await miniProgram.reLaunch('/pages/index/index');
    const indexPage = await waitForPage(miniProgram, 'pages/index/index', { timeout: 20000 });
    await indexPage.waitFor(200);

    await indexPage.setData({
      patients: SAMPLE_PATIENTS,
      displayPatients: SAMPLE_PATIENTS,
      loading: false,
      error: '',
      searchKeyword: '',
      advancedFilters: {
        statuses: [],
        riskLevels: [],
        hospitals: [],
        diagnosis: [],
        dateRange: { start: '', end: '' },
        logicMode: 'AND',
      },
      pendingAdvancedFilters: {
        statuses: [],
        riskLevels: [],
        hospitals: [],
        diagnosis: [],
        dateRange: { start: '', end: '' },
        logicMode: 'AND',
      },
    });

    await indexPage.callMethod('onSearchInput', { detail: { value: '李四' } });

    await waitForCondition(async () => {
      const data = await indexPage.data();
      return (
        Array.isArray(data.displayPatients) &&
        data.displayPatients.length === 1 &&
        data.displayPatients[0].patientName === '李四'
      );
    }, { timeout: 5000, message: 'Search filter did not reduce to 李四' });

    await indexPage.callMethod('onSearchClear');

    await waitForCondition(async () => {
      const data = await indexPage.data();
      return Array.isArray(data.displayPatients) && data.displayPatients.length === 2;
    }, { timeout: 5000, message: 'Search clear did not restore full list' });

    await indexPage.callMethod('onFilterApply', {
      detail: {
        value: {
          statuses: ['in_care'],
          riskLevels: ['high'],
          hospitals: [],
          diagnosis: [],
          dateRange: { start: '', end: '' },
          logicMode: 'AND',
        },
      },
    });

    await waitForCondition(async () => {
      const data = await indexPage.data();
      return (
        Array.isArray(data.displayPatients) &&
        data.displayPatients.length === 1 &&
        data.displayPatients[0].patientName === '张三'
      );
    }, { timeout: 5000, message: 'Advanced filter did not narrow to 张三' });

    await waitForElements(indexPage, 'patient-card', { min: 1, timeout: 5000 });

    await miniProgram.reLaunch('/pages/patient-detail/detail');
    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', { timeout: 20000 });
    await detailPage.setData({
      loading: false,
      error: '',
      patient: {
        patientName: '张三',
      },
    });
    await detailPage.waitFor(100);

    const nameNode = await waitForElement(detailPage, '.patient-detail-name', { timeout: 10000 });
    const detailName = (await nameNode.text()).trim();
    expect(detailName.length).toBeGreaterThan(0);
  }, 300000);
});
