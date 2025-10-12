import { CloudBase } from '@cloudbase/js-sdk';
import { MediaItem, MediaQuota } from '../types/patient';

const FUNCTION_NAME = 'patientMedia';

type MediaListResult = {
  success?: boolean;
  data?: {
    images?: MediaItem[];
    documents?: MediaItem[];
    quota?: MediaQuota;
  };
  error?: { message?: string };
};

export async function listMedia(app: CloudBase, patientKey: string, sessionToken: string) {
  const res = await app.callFunction({
    name: FUNCTION_NAME,
    data: { action: 'list', patientKey, sessionToken }
  });
  const result = res.result as MediaListResult;
  if (!result?.success) {
    throw new Error(result?.error?.message || '加载附件失败');
  }
  const images = result.data?.images || [];
  const documents = result.data?.documents || [];
  const quota = result.data?.quota;
  return {
    images,
    documents,
    quota
  };
}

type PrepareResponse = {
  success?: boolean;
  data?: {
    fileUuid: string;
    storagePath: string;
    category: string;
    mimeType?: string;
    quota?: MediaQuota;
  };
  error?: { message?: string };
};

type CompleteResponse = {
  success?: boolean;
  data?: {
    media: MediaItem;
    quota: MediaQuota;
  };
  error?: { message?: string };
};

export async function uploadMedia(
  app: CloudBase,
  patientKey: string,
  sessionToken: string,
  file: File
) {
  const prepareRes = await app.callFunction({
    name: FUNCTION_NAME,
    data: {
      action: 'prepareUpload',
      patientKey,
      fileName: file.name,
      sizeBytes: file.size,
      mimeType: file.type,
      sessionToken
    }
  });
  const prepare = prepareRes.result as PrepareResponse;
  if (!prepare?.success || !prepare.data) {
    throw new Error(prepare?.error?.message || '无法准备上传');
  }

  const uploadResult = await app.uploadFile({
    cloudPath: prepare.data.storagePath,
    filePath: file
  });
  const fileId = uploadResult.fileID;
  if (!fileId) {
    throw new Error('云存储上传失败');
  }

  const completeRes = await app.callFunction({
    name: FUNCTION_NAME,
    data: {
      action: 'completeUpload',
      patientKey,
      sessionToken,
      fileUuid: prepare.data.fileUuid,
      storagePath: prepare.data.storagePath,
      fileId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size
    }
  });
  const complete = completeRes.result as CompleteResponse;
  if (!complete?.success || !complete.data) {
    throw new Error(complete?.error?.message || '完成上传失败');
  }
  return complete.data;
}

export async function deleteMediaItem(
  app: CloudBase,
  patientKey: string,
  sessionToken: string,
  mediaId: string
) {
  const res = await app.callFunction({
    name: FUNCTION_NAME,
    data: { action: 'delete', patientKey, sessionToken, mediaId }
  });
  const result = res.result as { success?: boolean; error?: { message?: string } };
  if (!result?.success) {
    throw new Error(result?.error?.message || '删除附件失败');
  }
}

type SignedUrlResponse = {
  success?: boolean;
  data?: { url: string; expiresAt?: number };
  error?: { message?: string };
};

export async function getMediaDownloadUrl(
  app: CloudBase,
  patientKey: string,
  sessionToken: string,
  mediaId: string
) {
  const res = await app.callFunction({
    name: FUNCTION_NAME,
    data: { action: 'download', patientKey, sessionToken, mediaId }
  });
  const result = res.result as SignedUrlResponse;
  if (!result?.success || !result.data?.url) {
    throw new Error(result?.error?.message || '无法生成下载链接');
  }
  return result.data;
}

export async function getMediaPreviewUrl(
  app: CloudBase,
  patientKey: string,
  sessionToken: string,
  mediaId: string
) {
  const res = await app.callFunction({
    name: FUNCTION_NAME,
    data: { action: 'preview', patientKey, sessionToken, mediaId }
  });
  const result = res.result as SignedUrlResponse;
  if (!result?.success || !result.data?.url) {
    throw new Error(result?.error?.message || '无法生成预览链接');
  }
  return result.data;
}

type TxtPreviewResponse = {
  success?: boolean;
  data?: { content: string };
  error?: { message?: string };
};

export async function getTxtPreview(
  app: CloudBase,
  patientKey: string,
  sessionToken: string,
  mediaId: string
) {
  const res = await app.callFunction({
    name: FUNCTION_NAME,
    data: { action: 'previewTxt', patientKey, sessionToken, mediaId }
  });
  const result = res.result as TxtPreviewResponse;
  if (!result?.success || !result.data) {
    throw new Error(result?.error?.message || '无法预览TXT文件');
  }
  return result.data;
}

