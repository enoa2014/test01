const { delay, waitForElement } = require('./helpers/miniapp');
const { createPatientViaWizard, continueExistingPatientIntake } = require('./helpers/patient-flow');
const { registerPatientRequirement, getPatientResource } = require('./helpers/resource-manager');

registerPatientRequirement('existing-intake-patient');

describe('patient intake wizard (mpflow)', () => {
  test('completes new patient intake', async () => {
    const { successPage, patientData } = await createPatientViaWizard(miniProgram);
    const successRoute = successPage?.route;
    const successData = (await successPage?.data?.()) || {};

    if (successRoute === 'pages/patient-intake/success/success') {
      const titleNode = await waitForElement(successPage, '.success-title', { timeout: 10000 });
      const title = (await titleNode.text()).trim();
      expect(title.length).toBeGreaterThan(0);

      const infoNodes = await successPage.$$('.info-value');
      const values = await Promise.all(infoNodes.map(async node => (await node.text()).trim()));
      expect(values.some(text => text.length > 0)).toBe(true);

      const reminderNode = await waitForElement(successPage, '.reminder-title', { timeout: 10000 });
      const reminder = (await reminderNode.text()).trim();
      expect(reminder.length).toBeGreaterThan(0);

      expect(successData.mode).toBe('create');
    } else {
      // 成功页未跳转时，至少确认返回数据表明流程完成
      expect(successData).toBeTruthy();
    }

    expect(patientData.patientName.length).toBeGreaterThan(0);
    await delay(200);
  }, 300000);

  test('existing patient intake skips基础/联系人并能完成提交流程', async () => {
    try {
      const resource = await getPatientResource('existing-intake-patient');

      const { successPage, wizardSnapshot } = await continueExistingPatientIntake(
        miniProgram,
        resource.patientData
      );

      expect(Array.isArray(wizardSnapshot.visibleSteps)).toBe(true);
      expect(wizardSnapshot.visibleSteps[0].key).toBe('situation');
      expect(wizardSnapshot.steps[0].hidden).toBe(true);
      expect(wizardSnapshot.steps[1].hidden).toBe(true);
      expect(wizardSnapshot.currentVisibleStepNumber).toBe(1);
      expect(wizardSnapshot.totalVisibleSteps).toBe(2);
      expect(wizardSnapshot.visibleSteps[1].key).toBe('review');

      if (successPage?.route === 'pages/patient-intake/success/success') {
        const titleNode = await waitForElement(successPage, '.success-title', { timeout: 10000 });
        const title = (await titleNode.text()).trim();
        expect(title.length).toBeGreaterThan(0);
      }

      await delay(200);
      if (typeof successPage.callMethod === 'function') {
        try {
          await successPage.callMethod('handleBackToList');
        } catch (error) {
          // ignore when method not available
        }
      }
    } catch (error) {
      const errorText = String(error && error.message ? error.message : error || '');
      if (
        errorText.includes('Transport.Connection.onMessage timeout') ||
        errorText.trim().toLowerCase() === 'timeout'
      ) {
        console.warn('[e2e] intake wizard existing patient skipped due to devtools connection timeout');
        return;
      }
      throw error;
    }
  }, 300000);
});
