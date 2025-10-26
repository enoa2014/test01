import { test, expect } from '@playwright/test';

test.describe('API - patientMedia 上传流程（prepare -> upload -> complete -> list）', () => {
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

  let createdKey: string | null = null;

  test('完整上传流程', async ({ request }) => {
    // 1) 新建患者
    const now = Date.now();
    const name = `TEST_AUTOMATION_${now}`;
    const idNumber = `${now}`.padEnd(18, '0');
    const create = await call(request, 'patientProfile', {
      action: 'create',
      data: { patientName: name, gender: '男', idNumber, birthDate: '2013-05-06', phone: '13800000003', address: '上传用例' }
    });
    expect(create.ok).toBeTruthy();
    expect(create.json).toMatchObject({ success: true });
    createdKey = create.json.patientKey;
    expect(createdKey).toBeTruthy();

    // 2) 准备上传（图片类型）
    const fileName = 'e2e-upload.png';
    // 1x1 红色 PNG（base64）
    const redPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const sizeBytes = Buffer.from(redPngBase64, 'base64').length;
    const prep = await call(request, 'patientMedia', {
      action: 'prepareUpload',
      patientKey: createdKey,
      fileName,
      sizeBytes,
      mimeType: 'image/png'
    });
    expect(prep.ok).toBeTruthy();
    expect(prep.json).toMatchObject({ success: true });
    const fileUuid = prep.json?.data?.fileUuid;
    const storagePath = prep.json?.data?.storagePath;
    expect(fileUuid).toBeTruthy();
    expect(storagePath).toBeTruthy();

    // 3) 实际上传到云存储（服务端代理辅助）
    const up = await storageUpload(request, storagePath, redPngBase64, 'image/png');
    expect(up.ok).toBeTruthy();
    const fileID = up.json?.fileID;
    expect(fileID).toBeTruthy();

    // 4) 完成上传
    const complete = await call(request, 'patientMedia', {
      action: 'completeUpload',
      patientKey: createdKey,
      fileUuid,
      fileID,
      fileName,
      mimeType: 'image/png',
      storagePath
    });
    expect(complete.ok).toBeTruthy();
    expect(complete.json).toMatchObject({ success: true });

    // 5) 列表校验
    const list = await call(request, 'patientMedia', { action: 'list', patientKey: createdKey, limit: 20 });
    expect(list.ok).toBeTruthy();
    expect(list.json).toHaveProperty('data');
  });

  test.afterAll(async ({ request }) => {
    if (createdKey) {
      await call(request, 'patientProfile', { action: 'delete', patientKey: createdKey });
      createdKey = null;
    }
  });
});

