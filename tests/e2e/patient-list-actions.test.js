const { waitForPage } = require('./helpers/miniapp');

const now = Date.now();

function buildPatient({ key, careStatus }) {
  return {
    key,
    patientKey: key,
    patientName: key,
    gender: careStatus === 'in_care' ? '男' : '女',
    genderLabel: careStatus === 'in_care' ? '男' : '女',
    ethnicity: '汉',
    nativePlace: careStatus === 'in_care' ? '上海' : '成都',
    ageBucketId: careStatus === 'in_care' ? '7-12' : '18+',
    ageBucketLabel: careStatus === 'in_care' ? '7-12岁' : '18岁及以上',
    latestDoctor: careStatus === 'in_care' ? '李主任' : '王主任',
    firstDoctor: careStatus === 'in_care' ? '李主任' : '王主任',
    latestHospital: '测试医院',
    firstHospital: '测试医院',
    latestDiagnosis: '自动化用例',
    firstDiagnosis: '自动化用例',
    latestAdmissionTimestamp: now,
    firstAdmissionTimestamp: now,
    careStatus,
    riskLevel: 'medium',
    badges: [],
    tags: [],
  };
}

describe('patient list actions', () => {
  let indexPage;

  beforeEach(async () => {
    await miniProgram.reLaunch('/pages/index/index');
    indexPage = await waitForPage(miniProgram, 'pages/index/index', { timeout: 20000 });
    await indexPage.waitFor?.(200);
    await indexPage.setData({
      testCaptureActionSheet: true,
      testCaptureNavigation: true,
      testCaptureToast: true,
      testLastActionSheet: [],
      testLastNavigation: '',
      testLastToast: '',
    });
  }, 120000);

  test('action sheet for pending patient exposes入住选项并跳转入住流程', async () => {
    const pending = buildPatient({ key: 'pending-001', careStatus: 'pending' });
    await indexPage.setData({
      patients: [pending],
      displayPatients: [pending],
      loading: false,
      error: '',
    });

    await indexPage.callMethod('showPatientActionSheet', pending);
    const latest = await indexPage.data();
    expect(latest.testLastActionSheet).toEqual([
      '入住',
      '详情',
      '修改状态',
      '导出报告',
      '删除住户',
    ]);
    await indexPage.callMethod('startIntakeForPatient', pending);
    const afterNav = await indexPage.data();
    expect(afterNav.testLastNavigation).toContain(
      '/pages/patient-intake/wizard/wizard?patientKey=pending-001'
    );
  }, 120000);

  test('action sheet for in-care patient展示离开与占位提示', async () => {
    const inCare = buildPatient({ key: 'care-001', careStatus: 'in_care' });
    await indexPage.setData({
      patients: [inCare],
      displayPatients: [inCare],
      loading: false,
      error: '',
    });

    await indexPage.callMethod('showPatientActionSheet', inCare);
    const latest = await indexPage.data();
    expect(latest.testLastActionSheet).toEqual([
      '详情',
      '离开',
      '修改状态',
      '导出报告',
      '删除住户',
    ]);
    await indexPage.callMethod('handlePatientCheckout', inCare);
    const afterToast = await indexPage.data();
    expect(afterToast.testLastToast).toBeFalsy();
  }, 120000);

  test('新建住户入口跳转到向导创建模式', async () => {
    await indexPage.callMethod('onCreatePatientTap');
    const latest = await indexPage.data();
    expect(latest.testLastNavigation).toContain('/pages/patient-intake/wizard/wizard?mode=create');
  }, 120000);

  test('批量操作菜单仅包含批量选项', async () => {
    const bulkPatient = buildPatient({ key: 'bulk-001', careStatus: 'pending' });
    await indexPage.setData({
      patients: [bulkPatient],
      displayPatients: [bulkPatient],
      batchMode: true,
      selectedPatientMap: { 'bulk-001': bulkPatient },
      testCaptureActionSheet: true,
      testLastActionSheet: [],
    });

    await indexPage.callMethod('showPatientActionSheet', bulkPatient, { batch: true });
    const latest = await indexPage.data();
    expect(latest.testLastActionSheet).toEqual([
      '批量修改状态',
      '批量导出报告',
      '批量删除住户',
    ]);
  }, 120000);
});
