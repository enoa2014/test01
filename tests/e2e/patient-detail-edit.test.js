const {
  delay,
  waitForElement,
  waitForCondition,
  inputValue,
  waitForPage,
} = require('./helpers/miniapp');
const { generateMobile, situationText } = require('./helpers/patient-flow');
const { registerPatientRequirement, getPatientResource } = require('./helpers/resource-manager');

registerPatientRequirement('patient-detail-edit');

describe('patient detail inline edit (mpflow)', () => {
  let createdPatient;
  let patientKey;

  beforeAll(async () => {
    const resource = await getPatientResource('patient-detail-edit');
    createdPatient = resource.patientData;
    patientKey =
      createdPatient.patientKey ||
      createdPatient.key ||
      createdPatient.recordKey ||
      createdPatient.patientName;
  }, 300000);

  test('allows editing contact information', async () => {
    await miniProgram.reLaunch(
      `/pages/patient-detail/detail?key=${encodeURIComponent(patientKey)}`
    );
    const detailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', {
      timeout: 20000,
    });
    await waitForElement(detailPage, '.patient-detail-name');

    const editButton = await waitForElement(detailPage, '.edit-button');
    await editButton.tap();

    await waitForCondition(
      async () => {
        const data = await detailPage.data();
        return data.editMode === true;
      },
      { timeout: 8000, message: 'Edit mode did not activate' }
    );

    await detailPage.setData({
      'editForm.patientName': createdPatient.patientName || '自动化患者',
      'editForm.idType': '身份证',
      'editForm.idNumber': createdPatient.idNumber || '110101201204166321',
      'editForm.gender': createdPatient.gender || '女',
      'editForm.birthDate': createdPatient.birthDate || '2012-04-16',
      'editForm.emergencyContact': createdPatient.emergencyContact || 'Automation Caregiver',
      'editForm.emergencyPhone': createdPatient.emergencyPhone || generateMobile(),
      'editPickerIndex.idType': 0,
      'editPickerIndex.gender': createdPatient.gender === '男' ? 0 : 1,
      editErrors: {},
    });
    await detailPage.waitFor?.(100);

    const newPhone = generateMobile();
    const newAddress = `${createdPatient.address || 'Automation Rehab Center'} updated`;
    const newNarrative = `${situationText()} Inline edit via mpflow.`;

    const phoneInput = await waitForElement(detailPage, 'input[data-key="phone"]');
    await inputValue(phoneInput, newPhone);
    const addressTextarea = await waitForElement(detailPage, 'textarea[data-key="address"]');
    await inputValue(addressTextarea, newAddress);
    const narrativeTextarea = await waitForElement(detailPage, 'textarea[data-key="narrative"]');
    await inputValue(narrativeTextarea, newNarrative);

    try {
      await waitForCondition(
        async () => {
          const data = await detailPage.data();
          const hasErrors = data && data.editErrors && Object.keys(data.editErrors).length > 0;
          return data.editCanSave === true && !hasErrors;
        },
        { timeout: 12000, message: 'Save action not enabled' }
      );
    } catch (error) {
      const debugState = await detailPage.data();
      console.error('[e2e] detail edit not ready', debugState);
      throw error;
    }

    await detailPage.callMethod('onSaveTap');

    try {
      await waitForCondition(
        async () => {
          const data = await detailPage.data();
          return data && data.editMode === false && data.saving === false;
        },
        {
          timeout: 30000,
          message: 'Detail page did not退出编辑模式',
        }
      );
    } catch (error) {
      const debugState = await detailPage.data();
      console.error('[e2e] detail edit still in progress', debugState);
      throw error;
    }

    if (patientKey) {
      await miniProgram.reLaunch(
        `/pages/patient-detail/detail?key=${encodeURIComponent(patientKey)}`
      );
    } else {
      await miniProgram.reLaunch('/pages/patient-detail/detail');
    }

    const refreshedDetailPage = await waitForPage(miniProgram, 'pages/patient-detail/detail', {
      timeout: 20000,
    });

    await waitForCondition(
      async () => {
        const data = await refreshedDetailPage.data();
        return data && data.loading === false && data.patient?.phone;
      },
      {
        timeout: 20000,
        message: 'Refreshed detail page未完成加载',
      }
    );

    const refreshedData = await refreshedDetailPage.data();
    expect(refreshedData.editMode).toBe(false);
    expect(refreshedData.patient?.phone).toBe(newPhone);
    expect((refreshedData.patient?.address || '').includes('updated')).toBe(true);

    await miniProgram.reLaunch('/pages/index/index');
    const refreshedIndex = await waitForPage(miniProgram, 'pages/index/index', {
      timeout: 20000,
    });

    await waitForCondition(
      async () => {
        const data = await refreshedIndex.data();
        if (!data || data.loading) {
          return false;
        }
        const list = Array.isArray(data.displayPatients) ? data.displayPatients : [];
        const target = list.find(item => item.patientName === createdPatient.patientName);
        if (!target) {
          await miniProgram
            .callWxMethod('cloud.callFunction', {
              name: 'patientIntake',
              data: { action: 'getPatients', forceRefresh: true, pageSize: 10 },
            })
            .catch(() => {});
          return false;
        }
        if (target.phone === newPhone) {
          return true;
        }
        if (target.address && target.address.includes('updated')) {
          return true;
        }
        return false;
      },
      {
        timeout: 20000,
        message: '患者列表未刷新出更新后的联系方式',
      }
    );
  }, 300000);
});
