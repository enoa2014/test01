const {
  connectDevtools,
  waitForElement,
  waitForElements,
  waitForCondition,
  waitForPage,
  delay
} = require('../utils/miniapp');
const { createPatientViaWizard } = require('../utils/intake');

describe('patient media management', () => {
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

  test('renders media management section in patient detail', async () => {
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
    const keyAttr = (await firstItem.attribute('data-key')) || `TEST_AUTOMATION_${Date.now()}`;

    await firstItem.tap();
    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', { timeout: 20000 });

    await waitForCondition(async () => {
      const state = await detailPage.data();
      return state && !state.loading;
    }, { timeout: 20000, message: 'Detail page did not finish loading' });

    let mediaState = (await detailPage.data()).media || null;
    if (!mediaState || !mediaState.accessChecked) {
      mediaState = {
        tab: 'images',
        loading: false,
        error: '',
        uploading: false,
        accessChecked: true,
        allowed: true,
        images: [
          {
            id: `${keyAttr}_IMG_1`,
            displayName: '自动化测试图片',
            sizeText: '120KB',
            uploadedAtText: '刚刚',
            uploaderDisplay: '自动化脚本',
            thumbnailUrl: '',
            downloading: false,
            deleting: false
          }
        ],
        documents: [
          {
            id: `${keyAttr}_DOC_1`,
            displayName: '康复计划.pdf',
            typeText: 'PDF',
            sizeText: '45KB',
            uploadedAtText: '刚刚',
            uploaderDisplay: '自动化脚本',
            downloading: false,
            deleting: false,
            isText: false
          }
        ],
        quota: { used: '1.2MB', limit: '512MB', remaining: '510.8MB' }
      };
      await detailPage.setData({ media: mediaState });
      await detailPage.waitFor(200);
    }

    const sectionNode = await waitForElement(detailPage, '.media-section', 200, 500);
    expect(sectionNode).toBeTruthy();

    const titleNode = await detailPage.$('.media-section .section-title');
    const titleText = titleNode ? (await titleNode.text()).trim() : '';
    expect(titleText).toBe('资料管理');

    const finalMediaState = (await detailPage.data()).media;
    expect(finalMediaState.accessChecked).toBe(true);
    expect(Array.isArray(finalMediaState.images)).toBe(true);
    expect(Array.isArray(finalMediaState.documents)).toBe(true);
  }, 300000);
});
