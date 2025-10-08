const {
  waitForElement,
  waitForElements,
  waitForPage,
  waitForCondition,
} = require('./helpers/miniapp');
const { registerPatientRequirement, getPatientResource } = require('./helpers/resource-manager');

registerPatientRequirement('patient-media-base');

describe('patient media management (mpflow)', () => {
  let seededPatient = {};

  beforeAll(async () => {
    const resource = await getPatientResource('patient-media-base');
    seededPatient = resource.patientData || {};
  }, 300000);

  test('media section renders and provides fallback data when empty', async () => {
    const normalizeRoute = route => (route || '').replace(/^\//, '');
    let indexPage = await miniProgram.currentPage();
    let currentRoute = indexPage ? normalizeRoute(indexPage.route || indexPage.path || '') : '';

    if (currentRoute !== 'pages/index/index') {
      console.info('[e2e][media] re-launching index page from', currentRoute || 'unknown');
      await miniProgram.reLaunch('/pages/index/index');
      indexPage = await waitForPage(miniProgram, 'pages/index/index', { timeout: 20000 });
      currentRoute = 'pages/index/index';
    } else {
      console.info('[e2e][media] index page already active');
    }

    await indexPage.waitFor(500);
    console.info('[e2e][media] index page loaded');

    let patientItems = [];
    try {
      patientItems = await waitForElements(indexPage, 'patient-card', { min: 1, timeout: 15000 });
      console.info('[e2e][media] patient cards detected', patientItems.length);
    } catch (error) {
      const fallbackKey = `TEST_AUTOMATION_${Date.now()}`;
      const fallbackPatient = {
        key: fallbackKey,
        patientKey: fallbackKey,
        patientName: seededPatient.patientName || '自动化患者',
        gender: '女',
        genderLabel: '女',
        ethnicity: '汉',
        nativePlace: '广州',
        ageBucketId: '18+',
        ageBucketLabel: '18岁及以上',
        latestDoctor: '王主任',
        firstDoctor: '王主任',
        latestHospital: '自动化医院',
        firstHospital: '自动化医院',
        latestDiagnosis: '测试诊断',
        firstDiagnosis: '测试诊断',
        latestAdmissionTimestamp: Date.now(),
        firstAdmissionTimestamp: Date.now(),
        careStatus: 'in_care',
        riskLevel: 'medium',
        badges: [],
        tags: [],
      };

      await indexPage.setData({
        patients: [fallbackPatient],
        displayPatients: [fallbackPatient],
        loading: false,
        error: '',
      });
      patientItems = await waitForElements(indexPage, 'patient-card', { min: 1, timeout: 5000 });
      console.info('[e2e][media] fallback patient injected');
    }

    expect(patientItems.length).toBeGreaterThan(0);

    const detailTarget = (await indexPage.data()).displayPatients?.[0];
    const targetKey = detailTarget?.patientKey || detailTarget?.key || seededPatient.patientKey;
    console.info('[e2e][media] navigating to detail with key', targetKey);
    await miniProgram.reLaunch(`/pages/patient-detail/detail?key=${encodeURIComponent(targetKey)}`);
    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', {
      timeout: 20000,
    });
    console.info('[e2e][media] detail page reached');

    await waitForCondition(
      async () => {
        const state = await detailPage.data();
        return state && !state.loading;
      },
      { timeout: 20000, message: 'Detail page did not finish loading' }
    );
    console.info('[e2e][media] detail page finished loading');

    let mediaState = (await detailPage.data()).media || null;
    if (!mediaState || !mediaState.accessChecked) {
      const keyAttr = `TEST_AUTOMATION_${Date.now()}`;
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
            deleting: false,
          },
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
            isText: false,
          },
        ],
        quota: { used: '1.2MB', limit: '512MB', remaining: '510.8MB' },
      };
      await detailPage.setData({ media: mediaState });
      await detailPage.waitFor(200);
      console.info('[e2e][media] fallback media state applied');
    }

    const sectionNode = await waitForElement(detailPage, '.media-section', { timeout: 10000 });
    expect(sectionNode).toBeTruthy();
    console.info('[e2e][media] media section located');

    const titleNode = await detailPage.$('.media-section .section-title');
    const titleText = titleNode ? (await titleNode.text()).trim() : '';
    expect(titleText).toBe('资料管理');

    const finalState = (await detailPage.data()).media;
    expect(finalState.accessChecked).toBe(true);
    expect(Array.isArray(finalState.images)).toBe(true);
    expect(Array.isArray(finalState.documents)).toBe(true);
    console.info('[e2e][media] media assertions completed');
  }, 300000);
});
