import React, { useEffect, useState } from 'react';
import {
  deleteMediaItem,
  getMediaDownloadUrl,
  getMediaPreviewUrl,
  listMedia,
  uploadMedia
} from '../api/media';
import { useCloudbase } from '../hooks/useCloudbase';
import { MediaItem, MediaQuota } from '../types/patient';

type MediaManagerProps = {
  patientKey: string;
};

const formatSize = (size?: number) => {
  if (!size) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = 0;
  let value = size;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
};

const MediaManager: React.FC<MediaManagerProps> = ({ patientKey }) => {
  const { app, user } = useCloudbase();
  const [images, setImages] = useState<MediaItem[]>([]);
  const [documents, setDocuments] = useState<MediaItem[]>([]);
  const [quota, setQuota] = useState<MediaQuota | undefined>();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const sessionToken = user?.uid || user?.username || '';

  const loadMedia = async () => {
    if (!app || !sessionToken) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listMedia(app, patientKey, sessionToken);
      setImages(result.images.map(item => ({ ...item, id: item.id || item._id })));
      setDocuments(result.documents.map(item => ({ ...item, id: item.id || item._id })));
      setQuota(result.quota);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载附件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, sessionToken, patientKey]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!app || !sessionToken) {
      setError('会话信息缺失，无法上传');
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploading(true);
    setMessage(null);
    setError(null);
    try {
      const result = await uploadMedia(app, patientKey, sessionToken, file);
      setMessage(`上传成功：${result.media.displayName || result.media.filename}`);
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDelete = async (mediaId?: string) => {
    if (!app || !sessionToken || !mediaId) {
      return;
    }
    const confirmDelete = window.confirm('确认删除该附件？');
    if (!confirmDelete) {
      return;
    }
    try {
      await deleteMediaItem(app, patientKey, sessionToken, mediaId);
      setMessage('附件已删除');
      await loadMedia();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const openUrl = (url: string) => {
    window.open(url, '_blank', 'noopener');
  };

  const handleDownload = async (mediaId?: string) => {
    if (!app || !sessionToken || !mediaId) {
      return;
    }
    try {
      const link = await getMediaDownloadUrl(app, patientKey, sessionToken, mediaId);
      openUrl(link.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '下载链接生成失败');
    }
  };

  const handlePreview = async (mediaId?: string) => {
    if (!app || !sessionToken || !mediaId) {
      return;
    }
    try {
      const link = await getMediaPreviewUrl(app, patientKey, sessionToken, mediaId);
      openUrl(link.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览链接生成失败');
    }
  };

  return (
    <div className="card">
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>患者资料管理</h3>
        <label className="primary-button" style={{ cursor: 'pointer' }}>
          {uploading ? '上传中...' : '上传附件'}
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {quota && (
        <div className="flex-row" style={{ marginBottom: 16 }}>
          <span>附件数量：{quota.totalCount} / 20</span>
          <span>已用空间：{formatSize(quota.totalBytes)} / 30 MB</span>
        </div>
      )}

      {loading && <p>附件加载中...</p>}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      <section>
        <h4>图片</h4>
        {images.length === 0 && <p>暂无图片附件</p>}
        <div className="media-grid">
          {images.map(item => (
            <div key={item.id} className="media-card">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.displayName} className="media-thumb" />
              ) : (
                <div className="media-thumb" />
              )}
              <h5>{item.displayName || item.filename || '未命名'}</h5>
              <p style={{ fontSize: 12, color: '#64748b' }}>{formatSize(item.sizeBytes)}</p>
              <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                <button className="link-button" onClick={() => handlePreview(item.id)}>
                  预览
                </button>
                <button className="link-button" onClick={() => handleDownload(item.id)}>
                  下载
                </button>
                <button className="danger-button" onClick={() => handleDelete(item.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h4>文档</h4>
        {documents.length === 0 && <p>暂无文档附件</p>}
        <div className="media-grid">
          {documents.map(item => (
            <div key={item.id} className="media-card">
              <h5>{item.displayName || item.filename || '未命名'}</h5>
              <p style={{ fontSize: 12, color: '#64748b' }}>{formatSize(item.sizeBytes)}</p>
              <div className="flex-row" style={{ justifyContent: 'space-between' }}>
                <button className="link-button" onClick={() => handlePreview(item.id)}>
                  预览
                </button>
                <button className="link-button" onClick={() => handleDownload(item.id)}>
                  下载
                </button>
                <button className="danger-button" onClick={() => handleDelete(item.id)}>
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default MediaManager;

