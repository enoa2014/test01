import { test, expect } from '@playwright/test';

test.describe('API - patientIntake 端到端（服务端代理）', () => {
  const call = async (request: any, name: string, data: any) => {
    const resp = await request.post(`/api/func/${name}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { data }
    });
    const json = await resp.json();
    return { ok: resp.ok(), status: resp.status(), json };
  };

  let createdKey: string | null = null;

  test('create(profile) / updateCareStatus / updateIntakeRecord / list & delete', async ({ request }) => {
    const now = Date.now();
    const name = `TEST_AUTOMATION_${now}`;
    const idNumber = `${now}`.padEnd(18, '0');

    // 1) 通过 patientProfile 创建，保障与列表/详情一致
    const create = await call(request, 'patientProfile', {
      action: 'create',
      data: {
        patientName: name,
        gender: '男',
        idNumber,
        birthDate: '2011-02-03',
        phone: '13800000001',
        address: '测试地址',
        careStatus: 'in_care',
        createdFrom: 'web-admin-e2e'
      }
    });
    expect(create.ok).toBeTruthy();
    expect(create.json).toMatchObject({ success: true });

    // createPatient 返回数据结构可能位于 data 或 patientKey，做宽松兼容
    createdKey = create.json?.patientKey || create.json?.data?.patientKey || null;
    expect(createdKey).toBeTruthy();

    // 2) updateCareStatus
    const upd1 = await call(request, 'patientIntake', {
      action: 'updateCareStatus',
      patientKey: createdKey,
      status: 'pending',
    });
    expect(upd1.ok).toBeTruthy();
    expect(upd1.json).toMatchObject({ success: true });

    // 3) updateIntakeRecord（新增一条就诊记录）
    const updRecord = await call(request, 'patientIntake', {
      action: 'updateIntakeRecord',
      patientKey: createdKey,
      intakeTime: Date.now(),
      hospital: '自动化医院',
      diagnosis: '自动化诊断',
      doctor: '测试医生',
      note: '自动化测试记录'
    });
    expect(updRecord.ok).toBeTruthy();
    expect(updRecord.json).toMatchObject({ success: true });

    // 4) listIntakeRecords
    const list = await call(request, 'patientIntake', {
      action: 'listIntakeRecords',
      patientKey: createdKey,
      limit: 50,
    });
    expect(list.ok).toBeTruthy();
    expect(Array.isArray(list.json?.data?.items) || Array.isArray(list.json?.items)).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (createdKey) {
      await call(request, 'patientProfile', { action: 'delete', patientKey: createdKey });
      createdKey = null;
    }
  });
});
