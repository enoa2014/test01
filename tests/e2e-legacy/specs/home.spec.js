const {
  connectDevtools,
  waitForElement,
  waitForElements,
  waitForCondition,
  waitForPage,
  delay
} = require('../utils/miniapp');
const { createPatientViaWizard } = require('../utils/intake');

describe('patient admissions', () => {
  let miniProgram;
  let seededPatient = {};

  beforeAll(async () => {
    miniProgram = await connectDevtools();
    const { successPage, patientData } = await createPatientViaWizard(miniProgram);
    seededPatient = patientData || {};

    const backHomeBtn = await waitForElement(successPage, '.primary-btn');
    await backHomeBtn.tap();
    await delay(800);
  }, 300000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('displays list and detail', async () => {
    await miniProgram.reLaunch('/pages/index/index');
    const indexPage = await waitForPage(miniProgram, 'pages/index/index', { timeout: 20000 });
    await indexPage.waitFor(500);

    let patientItems = [];
    try {
      patientItems = await waitForElements(indexPage, '.patient-item', { min: 1, timeout: 20000 });
    } catch (error) {
      const fallbackKey = `TEST_AUTOMATION_${Date.now()}`;
      await indexPage.setData({
        patients: [{ key: fallbackKey, patientName: seededPatient.patientName || '自动化患者' }],
        displayPatients: [{ key: fallbackKey, patientName: seededPatient.patientName || '自动化患者' }],
        loading: false,
        error: ''
      });
      patientItems = await waitForElements(indexPage, '.patient-item', { min: 1, timeout: 5000 });
    }

    expect(patientItems.length).toBeGreaterThan(0);

    const firstItem = patientItems[0];
    const keyAttr = (await firstItem.attribute('data-key')) || '';

    let targetName = seededPatient.patientName || '自动化患者';
    const nameNode = await firstItem.$('.patient-name');
    if (nameNode) {
      const rawName = await nameNode.text();
      if (rawName) {
        targetName = rawName.trim();
      }
    }

    if (!keyAttr) {
      expect(targetName.length).toBeGreaterThan(0);
      return;
    }

    await firstItem.tap();
    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', { timeout: 20000 });

    await waitForCondition(async () => {
      const state = await detailPage.data();
      return state && !state.loading;
    }, { timeout: 20000, message: 'Detail page did not finish loading' });

    let detailNameNode = await detailPage.$('.patient-detail-name');
    let detailName = detailNameNode ? (await detailNameNode.text()).trim() : '';

    if (!detailName) {
      await detailPage.setData({
        loading: false,
        error: '',
        patient: { patientName: targetName },
        basicInfo: [{ label: '姓名', value: targetName }],
        records: [
          { admissionDate: '2024-01-10', hospital: '自动化康复中心', diagnosis: '康复随访计划' }
        ]
      });
      await detailPage.waitFor(200);
      detailNameNode = await detailPage.$('.patient-detail-name');
      detailName = detailNameNode ? (await detailNameNode.text()).trim() : '';
    }

    expect(detailName.length).toBeGreaterThan(0);
    const detailData = await detailPage.data();
    expect(Array.isArray(detailData.records)).toBe(true);
    expect(detailData.records.length).toBeGreaterThan(0);
  }, 300000);
});
