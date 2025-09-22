const {
  delay,
  waitForElement
} = require('./helpers/miniapp');
const { createPatientViaWizard } = require('./helpers/patient-flow');

describe('patient intake wizard (mpflow)', () => {
  test('completes new patient intake', async () => {
    const { successPage, patientData } = await createPatientViaWizard(miniProgram);

    const titleNode = await waitForElement(successPage, '.success-title', { timeout: 10000 });
    const title = (await titleNode.text()).trim();
    expect(title).toContain('成功');

    const infoNodes = await successPage.$$('.info-value');
    const values = await Promise.all(infoNodes.map(async (node) => (await node.text()).trim()));
    expect(values.some((text) => text.length > 0)).toBe(true);

    const reminderNode = await waitForElement(successPage, '.reminder-title', { timeout: 10000 });
    const reminder = (await reminderNode.text()).trim();
    expect(reminder.length).toBeGreaterThan(0);

    expect(patientData.patientName.length).toBeGreaterThan(0);
    await delay(200);
  }, 300000);
});
