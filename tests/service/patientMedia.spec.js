const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEklEQVR42mP8/5+hHgAHggJ/Pqe3RQAAAABJRU5ErkJggg==';
const ONE_PIXEL_PNG = Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64');

const TXT_LIMIT = 1024 * 1024;

jest.mock('wx-server-sdk');

describe('patientMedia cloud function service tests', () => {
  let patientMedia;
  let cloud;

  const loadModule = () => {
    patientMedia = require('../../cloudfunctions/patientMedia/index.js');
  };

  beforeEach(() => {
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    process.env.PATIENT_MEDIA_ALLOW_DEV_BYPASS = 'true';
    process.env.PATIENT_MEDIA_ADMIN_TOKEN = '';
    process.env.PATIENT_MEDIA_ADMIN_OPENIDS = '';
    loadModule();
  });

  afterAll(() => {
    delete process.env.PATIENT_MEDIA_ALLOW_DEV_BYPASS;
    delete process.env.PATIENT_MEDIA_ADMIN_TOKEN;
    delete process.env.PATIENT_MEDIA_ADMIN_OPENIDS;
  });

  test('prepareUpload rejects unsupported file type', async () => {
    const result = await patientMedia.main({
      action: 'prepareUpload',
      patientKey: 'p-unsupported',
      fileName: 'malware.exe',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  test('prepareUpload rejects files exceeding size limit', async () => {
    const result = await patientMedia.main({
      action: 'prepareUpload',
      patientKey: 'p-large',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 11 * 1024 * 1024,
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('FILE_TOO_LARGE');
  });

  test('prepareUpload enforces remaining quota before upload', async () => {
    const patientKey = 'p-quota';
    cloud.__setCollectionDoc('patient_media_quota', patientKey, {
      patientKey,
      totalCount: 20,
      totalBytes: 30 * 1024 * 1024,
      updatedAt: Date.now(),
    });

    const result = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'note.txt',
      mimeType: 'text/plain',
      sizeBytes: 1024,
    });

    expect(result.success).toBe(false);
    expect(result.error.code).toBe('MEDIA_QUOTA_EXCEEDED');
  });

  test('successful upload updates quota and second upload exceeds limit', async () => {
    const patientKey = 'p-concurrency';
    const largeQuotaBytes = 29 * 1024 * 1024;

    cloud.__setCollectionDoc('patient_media_quota', patientKey, {
      patientKey,
      totalCount: 19,
      totalBytes: largeQuotaBytes,
      updatedAt: Date.now(),
    });

    const prepare = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: ONE_PIXEL_PNG.length,
    });

    expect(prepare.success).toBe(true);

    const fileId = 'mock://upload/image.png';
    cloud.__setFile(fileId, ONE_PIXEL_PNG);

    const complete = await patientMedia.main({
      action: 'completeUpload',
      patientKey,
      fileUuid: prepare.data.fileUuid,
      storagePath: prepare.data.storagePath,
      fileID: fileId,
      fileName: 'image.png',
      displayName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: ONE_PIXEL_PNG.length,
    });

    expect(complete.success).toBe(true);
    const quotaAfter = cloud.__getCollectionDoc('patient_media_quota', patientKey);
    expect(quotaAfter.totalCount).toBe(20);

    const secondPrepare = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'another.png',
      mimeType: 'image/png',
      sizeBytes: ONE_PIXEL_PNG.length,
    });

    expect(secondPrepare.success).toBe(false);
    expect(secondPrepare.error.code).toBe('MEDIA_QUOTA_EXCEEDED');
  });

  test('open access mode allows listing even when dev bypass disabled', async () => {
    process.env.PATIENT_MEDIA_ALLOW_DEV_BYPASS = 'false';
    jest.resetModules();
    cloud = require('wx-server-sdk');
    cloud.__reset();
    patientMedia = require('../../cloudfunctions/patientMedia/index.js');

    const result = await patientMedia.main({
      action: 'list',
      patientKey: 'p-auth',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeTruthy();
    expect(Array.isArray(result.data.items || [])).toBe(true);
  });

  test('previewTxt rejects files exceeding preview size limit', async () => {
    const patientKey = 'p-text';
    const prepare = await patientMedia.main({
      action: 'prepareUpload',
      patientKey,
      fileName: 'big.txt',
      mimeType: 'text/plain',
      sizeBytes: TXT_LIMIT + 1,
    });

    expect(prepare.success).toBe(true);

    const fileId = 'mock://upload/big.txt';
    cloud.__setFile(fileId, Buffer.alloc(TXT_LIMIT + 1, 65));

    const complete = await patientMedia.main({
      action: 'completeUpload',
      patientKey,
      fileUuid: prepare.data.fileUuid,
      storagePath: prepare.data.storagePath,
      fileID: fileId,
      fileName: 'big.txt',
      displayName: 'big.txt',
      mimeType: 'text/plain',
      sizeBytes: TXT_LIMIT + 1,
    });

    expect(complete.success).toBe(true);
    const mediaId = complete.data.media.id;

    const preview = await patientMedia.main({
      action: 'previewTxt',
      mediaId,
    });

    expect(preview.success).toBe(false);
    expect(preview.error.code).toBe('TXT_TOO_LARGE');
  });
});
