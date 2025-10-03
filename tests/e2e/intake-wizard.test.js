const {
  delay,
  waitForElement
} = require('./helpers/miniapp');
const {
  createPatientViaWizard,
  continueExistingPatientIntake
} = require('./helpers/patient-flow');
const {
  registerPatientRequirement,
  getPatientResource,
} = require('./helpers/resource-manager');

registerPatientRequirement('existing-intake-patient');

describe('patient intake wizard (mpflow)', () => {
  test('completes new patient intake', async () => {
    const { successPage, patientData } = await createPatientViaWizard(miniProgram);

    const titleNode = await waitForElement(successPage, '.success-title', { timeout: 10000 });
    const title = (await titleNode.text()).trim();
    expect(title).toContain('创建');

    const infoNodes = await successPage.$$('.info-value');
    const values = await Promise.all(infoNodes.map(async (node) => (await node.text()).trim()));
    expect(values.some((text) => text.length > 0)).toBe(true);

    const reminderNode = await waitForElement(successPage, '.reminder-title', { timeout: 10000 });
    const reminder = (await reminderNode.text()).trim();
    expect(reminder.length).toBeGreaterThan(0);

    const successData = await successPage.data();
    expect(successData.mode).toBe('create');

    expect(patientData.patientName.length).toBeGreaterThan(0);
    await delay(200);
  }, 300000);

  test('existing patient intake skips基础/联系人并能完成提交流程', async () => {
    const resource = await getPatientResource('existing-intake-patient');

    const {
      successPage,
      wizardSnapshot
    } = await continueExistingPatientIntake(miniProgram, resource.patientData);

    expect(Array.isArray(wizardSnapshot.visibleSteps)).toBe(true);
    expect(wizardSnapshot.visibleSteps[0].key).toBe('situation');
    expect(wizardSnapshot.steps[0].hidden).toBe(true);
    expect(wizardSnapshot.steps[1].hidden).toBe(true);
    expect(wizardSnapshot.currentVisibleStepNumber).toBe(1);
    expect(wizardSnapshot.totalVisibleSteps).toBeGreaterThanOrEqual(3);

    const titleNode = await waitForElement(successPage, '.success-title', { timeout: 10000 });
    const title = (await titleNode.text()).trim();
    expect(title).toContain('成功');

    await delay(200);
    if (typeof successPage.callMethod === 'function') {
      try {
        await successPage.callMethod('handleBackToList');
      } catch (error) {
        // ignore when method not available
      }
    }
  }, 300000);
});
