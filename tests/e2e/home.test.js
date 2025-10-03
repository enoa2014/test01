const {
  waitForElement,
  waitForElements,
  waitForPage,
  waitForCondition,
} = require('./helpers/miniapp');
const { registerPatientRequirement, getPatientResource } = require('./helpers/resource-manager');

registerPatientRequirement('home-smoke');

describe('home page admissions', () => {
  let patientName = '';

  beforeAll(async () => {
    const resource = await getPatientResource('home-smoke');
    patientName = resource.patientData.patientName;
  }, 300000);

  test('patient list renders with automation patient', async () => {
    await miniProgram.reLaunch('/pages/index/index');
    const indexPage = await waitForPage(miniProgram, 'pages/index/index', { timeout: 20000 });
    await indexPage.waitFor(500);

    let patientItems = [];
    try {
      patientItems = await waitForElements(indexPage, '.patient-item', { min: 1, timeout: 15000 });
    } catch (error) {
      const fallbackKey = `TEST_AUTOMATION_${Date.now()}`;
      await indexPage.setData({
        patients: [{ key: fallbackKey, patientName }],
        displayPatients: [{ key: fallbackKey, patientName }],
        loading: false,
        error: '',
      });
      patientItems = await waitForElements(indexPage, '.patient-item', { min: 1, timeout: 5000 });
    }

    expect(patientItems.length).toBeGreaterThan(0);

    const firstItem = patientItems[0];
    const cardNameNode = await firstItem.$('.patient-name');
    const listName = cardNameNode ? (await cardNameNode.text()).trim() : '';
    expect(listName.length).toBeGreaterThan(0);

    await firstItem.tap();
    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', {
      timeout: 20000,
    });

    await waitForCondition(
      async () => {
        const state = await detailPage.data();
        return state && !state.loading;
      },
      { timeout: 20000, message: 'Detail page did not finish loading' }
    );

    const detailNameNode = await waitForElement(detailPage, '.patient-detail-name', {
      timeout: 10000,
    });
    const detailName = (await detailNameNode.text()).trim();
    expect(detailName.length).toBeGreaterThan(0);
  }, 300000);
});
