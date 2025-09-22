const {
  delay,
  waitForElement,
  waitForCondition,
  inputValue,
  waitForPage
} = require('./helpers/miniapp');
const { createPatientViaWizard, generateMobile, situationText } = require('./helpers/patient-flow');

describe('patient detail inline edit (mpflow)', () => {
  let createdPatient;

  beforeAll(async () => {
    const { successPage, patientData } = await createPatientViaWizard(miniProgram);
    createdPatient = patientData;
    const backBtn = await waitForElement(successPage, '.primary-btn');
    await backBtn.tap();
    await delay(600);
  }, 300000);

  test('allows editing contact information', async () => {
    await miniProgram.reLaunch('/pages/index/index');
    const indexPage = await waitForPage(miniProgram, 'pages/index/index', { timeout: 20000 });
    await indexPage.waitFor(500);

    const patientItems = await indexPage.$$('.patient-item');
    expect(patientItems.length).toBeGreaterThan(0);
    await patientItems[0].tap();

    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', { timeout: 20000 });
    await waitForElement(detailPage, '.patient-detail-name');

    const editButton = await waitForElement(detailPage, '.edit-button');
    await editButton.tap();

    await waitForCondition(async () => {
      const data = await detailPage.data();
      return data.editMode === true;
    }, { timeout: 8000, message: 'Edit mode did not activate' });

    const newPhone = generateMobile();
    const newAddress = `${createdPatient.address || 'Automation Rehab Center'} updated`;
    const newNarrative = `${situationText()} Inline edit via mpflow.`;

    const phoneInput = await waitForElement(detailPage, 'input[data-key="phone"]');
    await inputValue(phoneInput, newPhone);
    const addressTextarea = await waitForElement(detailPage, 'textarea[data-key="address"]');
    await inputValue(addressTextarea, newAddress);
    const narrativeTextarea = await waitForElement(detailPage, 'textarea[data-key="narrative"]');
    await inputValue(narrativeTextarea, newNarrative);

    await waitForCondition(async () => {
      const data = await detailPage.data();
      return data.editCanSave === true;
    }, { timeout: 8000, message: 'Save action not enabled' });

    const saveButton = await waitForElement(detailPage, '.edit-button.primary');
    await saveButton.tap();
    await delay(1200);

    const finalData = await detailPage.data();
    expect(finalData.editForm?.phone).toBe(newPhone);
    expect((finalData.editForm?.address || '').includes('updated')).toBe(true);
  }, 300000);
});
