import { test, expect } from '@playwright/test';

test.describe('UI - 患者资料管理（列表/删除，预先通过API上传）', () => {
  const call = async (request: any, name: string, data: any) => {
    const resp = await request.post(`/api/func/${name}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { data }
    });
    const json = await resp.json();
    return { ok: resp.ok(), status: resp.status(), json };
  };

  const storageUpload = async (request: any, cloudPath: string, contentBase64: string, contentType = 'image/png') => {
    const resp = await request.post('/api/storage/upload', {
      headers: { 'Content-Type': 'application/json' },
      data: { cloudPath, contentBase64, contentType }
    });
    const json = await resp.json();
    return { ok: resp.ok(), status: resp.status(), json };
  };

  let patientKey: string | null = null;

  test.beforeAll(async ({ request }) => {
    // 创建患者并通过API完成一次上传
    const now = Date.now();
    const name = `TEST_AUTOMATION_${now}`;
    const idNumber = `${now}`.padEnd(18, '0');
    const create = await call(request, 'patientProfile', {
      action: 'create',
      data: { patientName: name, gender: '女', idNumber, birthDate: '2015-09-10', phone: '13800000005', address: 'UI删除用例' }
    });
    if (!create.ok || !create.json?.patientKey) throw new Error('创建患者失败');
    patientKey = create.json.patientKey;

    const fileName = 'api-preupload.png';
    const redPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const sizeBytes = Buffer.from(redPngBase64, 'base64').length;
    const prep = await call(request, 'patientMedia', {
      action: 'prepareUpload',
      patientKey,
      fileName,
      sizeBytes,
      mimeType: 'image/png'
    });
    if (!prep.ok || !prep.json?.data?.storagePath) throw new Error('prepare失败');
    const up = await storageUpload(request, prep.json.data.storagePath, redPngBase64, 'image/png');
    if (!up.ok || !up.json?.fileID) {
      console.warn('预上传失败，跳过本用例');
      patientKey = null;
      return;
    }
    const complete = await call(request, 'patientMedia', {
      action: 'completeUpload',
      patientKey,
      fileUuid: prep.json.data.fileUuid,
      fileID: up.json.fileID,
      fileName,
      mimeType: 'image/png',
      storagePath: prep.json.data.storagePath
    });
    if (!complete.ok || !complete.json?.success) throw new Error('complete失败');
  });

  test('UI 列表可见并能删除', async ({ page }) => {
    if (!patientKey) test.skip(true, '预上传失败，跳过');

    page.on('dialog', d => d.accept());
    await page.goto(`/patients/${patientKey}`);
    await expect(page.getByText('患者资料管理')).toBeVisible();
    await expect(page.getByText(/附件数量/)).toBeVisible({ timeout: 15000 });

    // 确保有删除按钮
    const delButtons = page.locator('button.danger-button', { hasText: '删除' });
    await expect(delButtons.first()).toBeVisible({ timeout: 15000 });

    const before = await delButtons.count();
    await delButtons.first().click();

    // 删除后数量减少或提示出现
    await expect(async () => {
      const after = await delButtons.count();
      expect(after).toBeLessThan(before);
    }).toPass({ timeout: 15000 });
  });

  test.afterAll(async ({ request }) => {
    if (patientKey) {
      await call(request, 'patientProfile', { action: 'delete', patientKey });
      patientKey = null;
    }
  });
});
