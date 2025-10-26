export interface UploadResponse {
  success: boolean;
  fileId?: string;
  fileID?: string;
  cloudPath?: string;
  error?: {
    message: string;
  };
}

export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        const base64Content = base64.split(',')[1];

        // 使用云存储上传API
        const response = await fetch('/api/storage/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cloudPath: `import/${Date.now()}_${file.name}`,
            contentBase64: base64Content,
            contentType: file.type
          })
        });

        const result = await response.json();

        if (result.success) {
          resolve({
            success: true,
            fileId: result.fileID || result.fileId,
            cloudPath: result.cloudPath
          });
        } else {
          reject(new Error(result.error?.message || '上传失败'));
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
};