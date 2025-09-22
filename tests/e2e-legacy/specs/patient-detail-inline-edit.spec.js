const {
  connectDevtools,
  waitForElement,
  waitForCondition,
  waitForElements,
  waitForPage,
  inputValue,
  generateMobile,
  situationText,
  delay
} = require('../utils/miniapp');
const { createPatientViaWizard } = require('../utils/intake');

describe('patient detail inline edit (story 1.4)', () => {
  let miniProgram;
  const createdPatient = {};

  beforeAll(async () => {
    miniProgram = await connectDevtools();
    const { successPage, patientData } = await createPatientViaWizard(miniProgram);
    Object.assign(createdPatient, patientData);

    const backHomeBtn = await waitForElement(successPage, '.primary-btn');
    await backHomeBtn.tap();
    await delay(600);
  }, 300000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  });

  test('allows inline editing and persists changes', async () => {
    await miniProgram.reLaunch('/pages/index/index');
    await delay(500);
    const indexPage = await waitForPage(miniProgram, 'pages/index/index');

    const patientItems = await waitForElements(indexPage, '.patient-item', { timeout: 20000 });
    const targetItem = patientItems[0];
    if (!targetItem) {
      throw new Error('No patient records available for editing');
    }
    await targetItem.tap();

    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail');
    await waitForElement(detailPage, '.patient-detail-name');

    const editButton = await waitForElement(detailPage, '.edit-button');
    await editButton.tap();

    await waitForCondition(async () => {
      const data = await detailPage.data();
      return data.editMode === true;
    }, { timeout: 5000, message: 'Edit mode did not activate' });

    const newPhone = generateMobile();
    const newAddress = `${createdPatient.address || 'Automation Rehab Center'} updated`;
    const newNarrative = `${situationText()} Automation inline edit validation.`;

    const phoneInput = await waitForElement(detailPage, 'input[data-key="phone"]');
    await inputValue(phoneInput, newPhone);
    const addressTextarea = await waitForElement(detailPage, 'textarea[data-key="address"]');
    await inputValue(addressTextarea, newAddress);
    const narrativeTextarea = await waitForElement(detailPage, 'textarea[data-key="narrative"]');
    await inputValue(narrativeTextarea, newNarrative);

    await waitForCondition(async () => {
      const data = await detailPage.data();
      return data.editCanSave === true;
    }, { timeout: 5000, message: 'Save action not enabled after editing' });

    const saveButton = await waitForElement(detailPage, '.edit-button.primary');
    const saveClass = await saveButton.attribute('class');
    expect(saveClass).not.toContain('disabled');
    await saveButton.tap();
    await delay(1000);

    const finalData = await detailPage.data();
    expect(finalData.editForm?.phone).toBe(newPhone);
    expect(finalData.editForm?.address || '').toContain('updated');
    const latestSituation = finalData.editForm?.narrative || '';
    expect(latestSituation).toContain('\u62a4\u7406');
  }, 300000);
});
