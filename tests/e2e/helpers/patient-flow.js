const { delay, waitForCondition, waitForElement, waitForPage, inputValue } = require('./miniapp');

let idCounter = 100;

async function waitForFieldElement(page, field, { timeout = 12000 } = {}) {
  const selectors = [
    `input[data-field="${field}"]`,
    `textarea[data-field="${field}"]`,
    `.pm-input__field[data-field="${field}"]`
  ];
  let lastError = null;
  for (const selector of selectors) {
    try {
      const node = await waitForElement(page, selector, { timeout });
      if (node) {
        return node;
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`Field ${field} not found`);
}

async function resolvePatientKey(miniProgram, patientData, successPage) {
  if (!patientData) {
    return '';
  }

  const evaluator = successPage || miniProgram;
  if (!evaluator || typeof evaluator.evaluate !== 'function') {
    return patientData.patientName;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await evaluator.evaluate(
        (payload) =>
          new Promise((resolve) => {
            if (!wx || !wx.cloud || typeof wx.cloud.callFunction !== 'function') {
              resolve({ error: 'wx.cloud unavailable' });
              return;
            }
            wx.cloud.callFunction({
              name: 'patientIntake',
              data: {
                action: 'getPatients',
                searchKeyword: payload.patientName,
                pageSize: 5,
              },
              success(res) {
                resolve({ result: res.result });
              },
              fail(err) {
                resolve({ error: err && err.errMsg ? err.errMsg : 'call_failed' });
              },
            });
          }),
        { patientName: patientData.patientName }
      );

      const list =
        response && response.result && Array.isArray(response.result.patients)
          ? response.result.patients
          : [];

      const matched = list.find((item) => {
        if (!item) return false;
        const sameName = item.patientName === patientData.patientName;
        const sameId = item.idNumber === patientData.idNumber;
        return sameName || sameId;
      });

      if (matched && matched.key) {
        return matched.key;
      }

      if (list.length && list[0].key) {
        return list[0].key;
      }
    } catch (error) {
      console.warn('[e2e] resolvePatientKey failed', error && error.message);
    }

    await delay(400);
  }

  return patientData.patientName;
}

function randomString(prefix = 'TEST_AUTOMATION') {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${now}_${rand}`;
}

function generateIdNumber(birthDate = '2012-04-16', gender = '女') {
  const regionCode = '110101';
  const birth = String(birthDate || '')
    .replace(/[^0-9]/g, '')
    .padEnd(8, '0')
    .slice(0, 8);
  idCounter = (idCounter % 900) + 101;
  let seqNumber = idCounter;
  const female = ['女', 'female', 'f'].includes(String(gender || '').toLowerCase());
  if (female && seqNumber % 2 === 1) {
    seqNumber = seqNumber === 999 ? 998 : seqNumber + 1;
  } else if (!female && seqNumber % 2 === 0) {
    seqNumber = seqNumber === 998 ? 997 : seqNumber + 1;
  }
  const sequence = String(seqNumber).padStart(3, '0');
  const partial = `${regionCode}${birth}${sequence}`;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const mods = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  const sum = partial
    .split('')
    .reduce((acc, digit, idx) => acc + Number(digit) * weights[idx], 0);
  const checksum = mods[sum % 11];
  return `${partial}${checksum}`;
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
  const { ...patientOverrides } = overrides || {};

  const birth = patientOverrides.birthDate || patientOverrides.birth || '2012-04-16';
  const gender = patientOverrides.gender || patientOverrides.sex || '女';

  const patientData = {
    patientName: randomString('TEST_AUTOMATION'),
    idNumber: generateIdNumber(birth, gender),
    birthDate: birth,
    phone: generateMobile(),
    address: 'Automation Rehab Center, Beijing',
    emergencyContact: 'Automation Caregiver',
    emergencyPhone: generateMobile(),
    situation: `${situationText()} Follow-up observation in progress.`,
    gender,
    ...patientOverrides,
  };

  const attemptWizard = async () => {
    await miniProgram.reLaunch('/pages/patient-intake/wizard/wizard?mode=create');
    const wizardPage = await waitForPage(miniProgram, 'pages/patient-intake/wizard/wizard', {
      timeout: 20000,
    });
    await delay(600);

    await wizardPage.setData({
      'formData.idType': '\u8eab\u4efd\u8bc1',
      idTypeIndex: 0,
      'formData.gender': patientData.gender || '\u5973',
      'formData.birthDate': patientData.birthDate,
    });

    if (typeof wizardPage.waitFor === 'function') {
      await wizardPage.waitFor(300);
    }

    const nameInput = await waitForFieldElement(wizardPage, 'patientName', { timeout: 12000 });
    await inputValue(nameInput, patientData.patientName);
    const idNumberInput = await waitForFieldElement(wizardPage, 'idNumber', { timeout: 12000 });
    await inputValue(idNumberInput, patientData.idNumber);
    const phoneInput = await waitForFieldElement(wizardPage, 'phone', { timeout: 12000 });
    await inputValue(phoneInput, patientData.phone);

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.canProceedToNext === true;
      },
      { timeout: 10000, message: 'Basic info step requirements not satisfied' }
    );

    if (typeof wizardPage.callMethod === 'function') {
      await wizardPage.callMethod('onNextStep');
    } else {
      const nextBtn = await waitForElement(wizardPage, '.action-buttons pm-button[type="primary"]');
      await nextBtn.tap();
    }
    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        if (!data || !Array.isArray(data.visibleSteps)) {
          return false;
        }
        const nextVisible = data.visibleSteps[1];
        return nextVisible && data.currentStep === nextVisible.originalIndex;
      },
      { timeout: 8000, message: 'Wizard did not enter contact step' }
    );

    const addressTextarea = await waitForFieldElement(wizardPage, 'address');
    await inputValue(addressTextarea, patientData.address);
    const emergencyContactInput = await waitForFieldElement(wizardPage, 'emergencyContact');
    await inputValue(emergencyContactInput, patientData.emergencyContact);
    const emergencyPhoneInput = await waitForFieldElement(wizardPage, 'emergencyPhone');
    await inputValue(emergencyPhoneInput, patientData.emergencyPhone);

    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        return data.canProceedToNext === true;
      },
      { timeout: 8000, message: 'Contact step requirements not satisfied' }
    );

    if (typeof wizardPage.callMethod === 'function') {
      await wizardPage.callMethod('onNextStep');
    } else {
      const nextBtn = await waitForElement(wizardPage, '.action-buttons pm-button[type="primary"]');
      await nextBtn.tap();
    }
    await waitForCondition(
      async () => {
        const data = await wizardPage.data();
        if (!data || !Array.isArray(data.visibleSteps)) {
          return false;
        }
        const reviewStep = data.visibleSteps[data.visibleSteps.length - 1];
        return reviewStep && data.currentStep === reviewStep.originalIndex;
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

    if (typeof wizardPage.callMethod === 'function') {
      await wizardPage.callMethod('onSubmit');
    } else {
      const submitButton = await waitForElement(wizardPage, '.action-buttons pm-button[type="primary"]');
      await submitButton.tap();
    }

    let successPage = null;
    try {
      successPage = await waitForPage(miniProgram, 'pages/patient-intake/success/success', {
        timeout: 20000,
      });
      await waitForElement(successPage, '.success-title');
    } catch (error) {
      successPage = await miniProgram.currentPage();
    }

    const successData = successPage && typeof successPage.data === 'function'
      ? await successPage.data()
      : {};

    let patientKey = successData?.patientKey;
    if (!patientKey) {
      patientKey = await resolvePatientKey(miniProgram, patientData, successPage);
    }

    const payload = {
      successPage,
      patientData: {
        ...patientData,
        patientKey: patientKey || patientData.patientName,
      },
    };

    return payload;
  };

  const maxAttempts = 3;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const result = await attemptWizard();
      return result;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) {
        break;
      }
      await delay(1000);
    }
  }
  throw lastError || new Error('createPatientViaWizard failed after retries');
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

  const situationTextarea = await waitForFieldElement(wizardPage, 'situation', {
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

  try {
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
  } catch (error) {
    const finalState = await wizardPage.data();
    console.error('[e2e] existing patient submission failed', {
      error: error && error.message,
      submitting: finalState && finalState.submitting,
      errors: finalState && finalState.errors,
      canProceedToNext: finalState && finalState.canProceedToNext,
      allRequiredCompleted: finalState && finalState.allRequiredCompleted,
      toast: finalState && finalState.toastMessage,
      patientKey: existingPatient.patientKey,
    });
    throw error;
  }
}

module.exports = {
  createPatientViaWizard,
  continueExistingPatientIntake,
  randomString,
  generateIdNumber,
  generateMobile,
  situationText,
};
