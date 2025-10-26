import { test, expect } from '@playwright/test';

test.describe('API - patientMedia 端到端（服务端代理）', () => {
  const call = async (request: any, name: string, data: any) => {
    const resp = await request.post(`/api/func/${name}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { data }
    });
    const json = await resp.json();
    return { ok: resp.ok(), status: resp.status(), json };
  };

  let createdKey: string | null = null;

  test('summary / list（空记录容忍）', async ({ request }) => {
    // 创建测试住户
    const now = Date.now();
    const name = `TEST_AUTOMATION_${now}`;
    const idNumber = `${now}`.padEnd(18, '0');
    const create = await call(request, 'patientProfile', {
      action: 'create',
      data: { patientName: name, gender: '女', idNumber, birthDate: '2012-03-04', phone: '13800000002', address: '媒体测试' }
    });
    expect(create.ok).toBeTruthy();
    expect(create.json).toMatchObject({ success: true });
    createdKey = create.json.patientKey;
    expect(createdKey).toBeTruthy();

    // quota summary
    const summary = await call(request, 'patientMedia', { action: 'summary', patientKey: createdKey });
    expect(summary.ok).toBeTruthy();
    expect(summary.json).toHaveProperty('success');

    // list
    const list = await call(request, 'patientMedia', { action: 'list', patientKey: createdKey, limit: 20 });
    expect(list.ok).toBeTruthy();
    expect(list.json).toHaveProperty('success');
  });

  test.afterAll(async ({ request }) => {
    if (createdKey) {
      await call(request, 'patientProfile', { action: 'delete', patientKey: createdKey });
      createdKey = null;
    }
  });
});

