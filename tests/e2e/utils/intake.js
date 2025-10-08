const {
  waitForElement,
  waitForCondition,
  waitForPage,
  inputValue,
  randomString,
  generateIdNumber,
  generateMobile,
  situationText,
  delay,
} = require('./miniapp');

async function createPatientViaWizard(miniProgram, options = {}) {
  const patientData = {
    patientName: randomString('PATIENT'),
    idNumber: generateIdNumber(),
    birthDate: '2012-04-16',
    phone: generateMobile(),
    address: 'Automation Rehab Center, Beijing',
    emergencyContact: 'Automation Caregiver',
    emergencyPhone: generateMobile(),
    emergencyRelation: '家属',
    situation: `${situationText()} Follow-up observation in progress.`,
  };

  await miniProgram.reLaunch('/pages/patient-intake/wizard/wizard?mode=new');
  await delay(600);
  const wizardPage = await waitForPage(miniProgram, 'pages/patient-intake/wizard/wizard');

  await wizardPage.setData({
    'formData.idType': '\\u8eab\\u4efd\\u8bc1',
    idTypeIndex: 0,
    'formData.gender': '\\u7537',
    'formData.birthDate': patientData.birthDate,
  });

  const nameInput = await waitForElement(wizardPage, 'input[data-field="patientName"]');
  await inputValue(nameInput, patientData.patientName);
  const idNumberInput = await waitForElement(wizardPage, 'input[data-field="idNumber"]');
  await inputValue(idNumberInput, patientData.idNumber);
  const phoneInput = await waitForElement(wizardPage, 'input[data-field="phone"]');
  await inputValue(phoneInput, patientData.phone);

  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.canProceedToNext === true;
    },
    { timeout: 5000, message: 'Basic info step requirements not satisfied' }
  );

  await (await waitForElement(wizardPage, '.btn-primary')).tap();
  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.currentStep === 1;
    },
    { timeout: 5000, message: 'Wizard did not enter contact step' }
  );

  const addressTextarea = await waitForElement(wizardPage, 'textarea[data-field="address"]');
  await inputValue(addressTextarea, patientData.address);
  const emergencyContactInput = await waitForElement(
    wizardPage,
    'input[data-field="emergencyContact"]'
  );
  await inputValue(emergencyContactInput, patientData.emergencyContact);
  const emergencyPhoneInput = await waitForElement(
    wizardPage,
    'input[data-field="emergencyPhone"]'
  );
  await inputValue(emergencyPhoneInput, patientData.emergencyPhone);

  const contactRelationInput = await waitForElement(
    wizardPage,
    '.pm-input__field[data-field="relationship"]'
  );
  await inputValue(contactRelationInput, patientData.emergencyRelation || '家属');

  const contactNameInput = await waitForElement(
    wizardPage,
    '.pm-input__field[data-field="name"]'
  );
  await inputValue(contactNameInput, patientData.emergencyContact);

  const contactPhoneInput = await waitForElement(
    wizardPage,
    '.pm-input__field[data-field="phone"]'
  );
  await inputValue(contactPhoneInput, patientData.emergencyPhone);

  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.canProceedToNext === true;
    },
    { timeout: 5000, message: 'Contact step requirements not satisfied' }
  );

  await (await waitForElement(wizardPage, '.btn-primary')).tap();
  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.currentStep === 2;
    },
    { timeout: 5000, message: 'Wizard did not enter situation step' }
  );

  const situationTextarea = await waitForElement(wizardPage, 'textarea[data-field="situation"]');
  await inputValue(situationTextarea, patientData.situation);

  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.canProceedToNext === true;
    },
    { timeout: 5000, message: 'Situation step requirements not satisfied' }
  );

  await (await waitForElement(wizardPage, '.btn-primary')).tap();
  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.currentStep === 3;
    },
    { timeout: 5000, message: 'Wizard did not enter review step' }
  );

  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.allRequiredCompleted === true;
    },
    { timeout: 5000, message: 'Review step reports missing required data' }
  );

  const submitButton = await waitForElement(wizardPage, '.btn-success');
  await submitButton.tap();

  const successPage = await waitForPage(miniProgram, 'pages/patient-intake/success/success', {
    timeout: 20000,
  });
  await waitForElement(successPage, '.success-title');

  return {
    successPage,
    wizardPage,
    patientData,
  };
}

module.exports = {
  createPatientViaWizard,
};
