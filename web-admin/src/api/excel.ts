import { CloudBase } from '@cloudbase/js-sdk';

type ImportResponse = {
  action?: string;
  imported?: Record<string, unknown>;
  totalPatients?: number;
  sync?: Record<string, unknown>;
  error?: { message?: string };
};

export async function importExcelFromFile(app: CloudBase, file: File) {
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/\s+/g, '-');
  const cloudPath = `excel-imports/${timestamp}-${sanitizedName}`;

  const uploadRes = await app.uploadFile({ cloudPath, filePath: file });
  const fileId = uploadRes.fileID;
  if (!fileId) {
    throw new Error('上传 Excel 到云存储失败');
  }

  const res = await app.callFunction({
    name: 'readExcel',
    data: { action: 'import', fileId }
  });

  const result = res.result as ImportResponse;
  if (result?.error) {
    throw new Error(result.error.message || '导入 Excel 失败');
  }
  return result;
}

