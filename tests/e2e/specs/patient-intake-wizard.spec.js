const {
  connectDevtools,
  waitForElement,
  waitForCondition,
  waitForPage,
  delay
} = require('../utils/miniapp');
const { createPatientViaWizard } = require('../utils/intake');

describe('patient intake wizard (story 1.3)', () => {
  let miniProgram;

  beforeAll(async () => {
    miniProgram = await connectDevtools();
  }, 300000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('completes multi-step intake flow with validation guards', async () => {
    const { successPage } = await createPatientViaWizard(miniProgram);

    const titleNode = await waitForElement(successPage, '.success-title');
    const titleText = (await titleNode.text()).trim();
    expect(titleText).toContain('\u6210\u529f');

    const infoValueNodes = await successPage.$$('.info-value');
    const displayedValues = await Promise.all(infoValueNodes.map(async (node) => (await node.text()).trim()));
    const hasNonEmptyValue = displayedValues.some((text) => text.length > 0);
    expect(hasNonEmptyValue).toBe(true);

    const reminderNode = await waitForElement(successPage, '.reminder-title');
    const reminderText = (await reminderNode.text()).trim();
    expect(reminderText).toContain('\u63d0\u9192');

    const backHomeBtn = await waitForElement(successPage, '.primary-btn');
    await backHomeBtn.tap();
    await delay(600);
  }, 300000);
});
