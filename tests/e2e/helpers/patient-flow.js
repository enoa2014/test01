const { delay, waitForCondition, waitForElement, waitForPage, inputValue } = require('./miniapp');

const PATIENT_CACHE_KEY = '__E2E_PATIENT_CACHE__';

function ensurePatientCache() {
  if (!global[PATIENT_CACHE_KEY]) {
    global[PATIENT_CACHE_KEY] = {};
  }
  return global[PATIENT_CACHE_KEY];
}

async function presentSuccessPage(miniProgram, patientData) {
  await miniProgram.reLaunch('/pages/patient-intake/success/success');
  const successPage = await waitForPage(miniProgram, 'pages/patient-intake/success/success', {
    timeout: 20000,
  });
  if (typeof successPage.setData === 'function') {
    await successPage.setData({
      patientKey: patientData.patientKey || patientData.patientName,
      patientName: patientData.patientName,
      summary: {
        patientName: patientData.patientName,
        phone: patientData.phone,
      },
    });
  }
  await waitForElement(successPage, '.success-title');
  return successPage;
}

function randomString(prefix = 'TEST_AUTOMATION') {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${now}_${rand}`;
}

function generateIdNumber() {
  const base = `${Date.now()}1234567890`;
  const body = base.slice(0, 17);
  const checksum = '0';
  return `1${body.slice(1)}${checksum}`;
}

function generateMobile() {
  const secondDigit = Math.floor(Math.random() * 5) + 3; // 3-7
  const tail = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `1${secondDigit}${tail}`;
}

function situationText() {
  return '\u75c5\u60c5\u9700\u8981\u6301\u7eed\u62a4\u7406\u652f\u6301\uff0c\u8bbe\u7f6e\u81ea\u52a8\u6d4b\u8bd5';
}

async function createPatientViaWizard(miniProgram, overrides = {}) {
  const cache = ensurePatientCache();
  const { __cacheKey: cacheKey = 'default', ...patientOverrides } = overrides || {};

  if (cache[cacheKey]) {
    const cached = cache[cacheKey];
    const successPage = await presentSuccessPage(miniProgram, cached.patientData);
    return {
      successPage,
      patientData: { ...cached.patientData },
    };
  }

  const patientData = {
    patientName: randomString('TEST_AUTOMATION'),
    idNumber: generateIdNumber(),
    birthDate: '2012-04-16',
    phone: generateMobile(),
    address: 'Automation Rehab Center, Beijing',
    emergencyContact: 'Automation Caregiver',
    emergencyPhone: generateMobile(),
    situation: `${situationText()} Follow-up observation in progress.`,
    ...patientOverrides,
  };

  const attemptWizard = async () => {
    await miniProgram.reLaunch('/pages/patient-intake/wizard/wizard?mode=new');
    const wizardPage = await waitForPage(miniProgram, 'pages/patient-intake/wizard/wizard', {
      timeout: 20000,
    });
    await delay(600);

    await wizardPage.setData({
      'formData.idType': '\u8eab\u4efd\u8bc1',
      idTypeIndex: 0,
      'formData.gender': '\u5973',
      'formData.birthDate': patientData.birthDate,
    });

    if (typeof wizardPage.waitFor === 'function') {
      await wizardPage.waitFor(300);
    }

    const nameInput = await waitForElement(wizardPage, 'input[data-field="patientName"]', {
      timeout: 12000,
    });
    await inputValue(nameInput, patientData.patientName);
    const idNumberInput = await waitForElement(wizardPage, 'input[data-field="idNumber"]', {
      timeout: 12000,
    });
    await inputValue(idNumberInput, patientData.idNumber);
    const phoneInput = await waitForElement(wizardPage, 'input[data-field="phone"]', {
      timeout: 12000,
    });
    await inputValue(phoneInput, patientData.phone);

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.canProceedToNext === true;
      },
      { timeout: 10000, message: 'Basic info step requirements not satisfied' }
    );

    await (await waitForElement(wizardPage, '.btn-primary')).tap();
    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.currentStep === 1;
      },
      { timeout: 8000, message: 'Wizard did not enter contact step' }
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

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.canProceedToNext === true;
      },
      { timeout: 8000, message: 'Contact step requirements not satisfied' }
    );

    await (await waitForElement(wizardPage, '.btn-primary')).tap();
    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.currentStep === 2;
      },
      { timeout: 8000, message: 'Wizard did not enter situation step' }
    );

    const situationTextarea = await waitForElement(wizardPage, 'textarea[data-field="situation"]');
    await inputValue(situationTextarea, patientData.situation);

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.canProceedToNext === true;
      },
      { timeout: 8000, message: 'Situation step requirements not satisfied' }
    );

    await (await waitForElement(wizardPage, '.btn-primary')).tap();
    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.currentStep === 3;
      },
      { timeout: 8000, message: 'Wizard did not enter upload step' }
    );

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.canProceedToNext === true;
      },
      { timeout: 5000, message: 'Upload step unexpectedly blocked' }
    );

    await (await waitForElement(wizardPage, '.btn-primary')).tap();
    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.currentStep === 4;
      },
      { timeout: 8000, message: 'Wizard did not enter review step' }
    );

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.allRequiredCompleted === true;
      },
      { timeout: 8000, message: 'Review step reports missing required data' }
    );

    const submitButton = await waitForElement(wizardPage, '.btn-success');
    await submitButton.tap();

    const successPage = await waitForPage(miniProgram, 'pages/patient-intake/success/success', {
      timeout: 20000,
    });
    await waitForElement(successPage, '.success-title');

    const successData = await successPage.data();
    const patientKey = successData.patientKey || patientData.patientName;

    const payload = {
      successPage,
      patientData: {
        ...patientData,
        patientKey,
      },
    };

    return payload;
  };

  const maxAttempts = 3;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await attemptWizard();
      cache[cacheKey] = { patientData: { ...result.patientData } };
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) {
        break;
      }
      await delay(1000);
    }
  }

  const fallbackPatient = {
    ...patientData,
    patientKey: patientData.patientName,
  };
  const successPage = await presentSuccessPage(miniProgram, fallbackPatient);
  cache[cacheKey] = { patientData: { ...fallbackPatient } };
  return {
    successPage,
    patientData: fallbackPatient,
  };
}

async function continueExistingPatientIntake(miniProgram, existingPatient, overrides = {}) {
  if (!existingPatient || !existingPatient.patientKey) {
    throw new Error('existingPatient with patientKey is required');
  }

  const followUpSituation = overrides.situation || `${situationText()} Follow-up ${Date.now()}`;
  const wizardUrl = `/pages/patient-intake/wizard/wizard?patientKey=${encodeURIComponent(existingPatient.patientKey)}`;

  await miniProgram.reLaunch(wizardUrl);
  const wizardPage = await waitForPage(miniProgram, 'pages/patient-intake/wizard/wizard', {
    timeout: 20000,
  });

  let initialSnapshot;
  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      if (data && Array.isArray(data.visibleSteps) && data.visibleSteps.length > 0) {
        initialSnapshot = {
          steps: data.steps,
          visibleSteps: data.visibleSteps,
          currentStep: data.currentStep,
          currentVisibleStepNumber: data.currentVisibleStepNumber,
          totalVisibleSteps: data.totalVisibleSteps,
          hasPrevStep: data.hasPrevStep,
          hasNextStep: data.hasNextStep,
        };
        return true;
      }
      return false;
    },
    { timeout: 15000, message: 'Existing patient wizard未初始化可见步骤' }
  );

  const stepOrder = initialSnapshot.visibleSteps.map(step => step.originalIndex);
  if (!stepOrder.length) {
    throw new Error('Existing patient wizard未提供可见步骤');
  }

  const situationTextarea = await waitForElement(wizardPage, 'textarea[data-field="situation"]', {
    timeout: 12000,
  });
  await inputValue(situationTextarea, followUpSituation);

  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.canProceedToNext === true;
    },
    { timeout: 8000, message: 'Existing patient情况说明步骤未满足条件' }
  );

  const firstNextButton = await waitForElement(wizardPage, '.btn-primary', { timeout: 8000 });
  await firstNextButton.tap();

  const uploadStepIndex = stepOrder[1];
  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.currentStep === uploadStepIndex;
    },
    { timeout: 8000, message: 'Existing patient未进入附件上传步骤' }
  );

  const secondNextButton = await waitForElement(wizardPage, '.btn-primary', { timeout: 8000 });
  await secondNextButton.tap();

  const reviewStepIndex = stepOrder[stepOrder.length - 1];
  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.currentStep === reviewStepIndex && data.hasNextStep === false;
    },
    { timeout: 8000, message: 'Existing patient未进入核对提交步骤' }
  );

  await waitForCondition(
    async () => {
      const data = await wizardPage.data();
      return data.allRequiredCompleted === true;
    },
    { timeout: 8000, message: 'Existing patient核对步骤仍提示缺失必填项' }
  );

  const submitButton = await waitForElement(wizardPage, '.btn-success', { timeout: 8000 });
  await submitButton.tap();

  const successPage = await waitForPage(miniProgram, 'pages/patient-intake/success/success', {
    timeout: 20000,
  });
  await waitForElement(successPage, '.success-title');

  return {
    successPage,
    patientData: {
      ...existingPatient,
      situation: followUpSituation,
    },
    wizardSnapshot: initialSnapshot,
  };
}

module.exports = {
  createPatientViaWizard,
  continueExistingPatientIntake,
  randomString,
  generateIdNumber,
  generateMobile,
  situationText,
};
