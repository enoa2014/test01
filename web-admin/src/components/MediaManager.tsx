import React, { useEffect, useRef, useState } from 'react';
import {
  deleteMediaItem,
  getMediaDownloadUrl,
  getMediaPreviewUrl,
  getTxtPreview,
  listMedia,
  uploadMedia
} from '../api/media';
import { useCloudbase } from '../hooks/useCloudbase';
import { MediaItem, MediaQuota } from '../shared/types';

type MediaManagerProps = {
  patientKey: string;
};

const MAX_UPLOAD_BATCH = 5; // 一次最多上传5个文件

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

// 获取文件类型图标
const getFileIcon = (mimeType?: string, filename?: string) => {
  const type = mimeType || '';
  const name = filename || '';

  if (type.startsWith('image/')) return '🖼️';
  if (type.includes('pdf') || name.endsWith('.pdf')) return '📄';
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
  if (type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx')) return '📊';
  if (type.includes('text') || name.endsWith('.txt')) return '📃';
  return '📎';
};

// 判断是否可以内联预览TXT
const isTxtFile = (mimeType?: string, filename?: string) => {
  return mimeType?.includes('text/plain') || filename?.toLowerCase().endsWith('.txt');
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
  const [activeTab, setActiveTab] = useState<'images' | 'documents'>('images');

  // TXT预览对话框
  const [txtPreview, setTxtPreview] = useState<{
    visible: boolean;
    title: string;
    content: string;
  }>({ visible: false, title: '', content: '' });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, category: 'image' | 'document') => {
    if (!app || !sessionToken) {
      setError('会话信息缺失，无法上传');
      return;
    }
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    // 检查配额
    if (quota && quota.remainingCount < files.length) {
      setError(`最多还可上传 ${quota.remainingCount} 个文件`);
      return;
    }

    setUploading(true);
    setMessage(null);
    setError(null);

    const fileArray = Array.from(files).slice(0, MAX_UPLOAD_BATCH);
    let successCount = 0;
    let failedCount = 0;

    for (const file of fileArray) {
      try {
        await uploadMedia(app, patientKey, sessionToken, file);
        successCount++;
      } catch (err) {
        failedCount++;
        console.error(`上传 ${file.name} 失败:`, err);
      }
    }

    if (successCount > 0) {
      setMessage(`成功上传 ${successCount} 个文件${failedCount > 0 ? `，失败 ${failedCount} 个` : ''}`);
      await loadMedia();
    } else {
      setError('上传失败');
    }

    setUploading(false);
    event.target.value = '';
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

  const handlePreview = async (item: MediaItem) => {
    if (!app || !sessionToken || !item.id) {
      return;
    }

    // 如果是TXT文件，使用内联预览
    if (isTxtFile(item.mimeType, item.filename)) {
      try {
        const result = await getTxtPreview(app, patientKey, sessionToken, item.id);
        setTxtPreview({
          visible: true,
          title: item.displayName || item.filename || '文本预览',
          content: result.content || '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'TXT预览失败');
      }
      return;
    }

    // 其他文件类型打开新窗口预览
    try {
      const link = await getMediaPreviewUrl(app, patientKey, sessionToken, item.id);
      openUrl(link.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '预览链接生成失败');
    }
  };

  const closeTxtPreview = () => {
    setTxtPreview({ visible: false, title: '', content: '' });
  };

  const renderMediaList = (items: MediaItem[], category: 'image' | 'document') => {
    if (items.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
          {category === 'image' ? '暂无图片附件' : '暂无文档附件'}
        </div>
      );
    }

    return (
      <div className="media-grid">
        {items.map(item => (
          <div key={item.id} className="media-card">
            {category === 'image' && item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={item.displayName}
                className="media-thumb"
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: 160,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3f4f6',
                  borderRadius: 6,
                  fontSize: 48,
                }}
              >
                {getFileIcon(item.mimeType, item.filename)}
              </div>
            )}
            <h5 style={{
              marginTop: 12,
              marginBottom: 4,
              fontSize: 14,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {item.displayName || item.filename || '未命名'}
            </h5>
            <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
              {formatSize(item.sizeBytes)}
            </p>
            <div className="flex-row" style={{ gap: 8 }}>
              <button className="link-button" onClick={() => handlePreview(item)}>
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
    );
  };

  return (
    <div className="card">
      <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>患者资料管理</h3>
        <div className="flex-row" style={{ gap: 8 }}>
          <button
            className="secondary-button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploading || !quota || quota.remainingCount <= 0}
          >
            上传图片
          </button>
          <button
            className="secondary-button"
            onClick={() => documentInputRef.current?.click()}
            disabled={uploading || !quota || quota.remainingCount <= 0}
          >
            上传文档
          </button>
        </div>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e, 'image')}
          disabled={uploading}
        />
        <input
          ref={documentInputRef}
          type="file"
          accept=".txt,.pdf,.doc,.docx,.xls,.xlsx"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e, 'document')}
          disabled={uploading}
        />
      </div>

      {quota && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            padding: 12,
            backgroundColor: '#f9fafb',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          <span>
            附件数量：<strong>{quota.totalCount} / 20</strong>
            {quota.remainingCount <= 5 && quota.remainingCount > 0 && (
              <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                (剩余 {quota.remainingCount} 个)
              </span>
            )}
          </span>
          <span>
            已用空间：<strong>{formatSize(quota.totalBytes)} / 30 MB</strong>
          </span>
        </div>
      )}

      {loading && <p style={{ color: '#6b7280' }}>附件加载中...</p>}
      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}
      {uploading && <p style={{ color: '#2563eb' }}>上传中，请稍候...</p>}

      {/* Tab切换 */}
      <div style={{ borderBottom: '2px solid #e5e7eb', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <button
            onClick={() => setActiveTab('images')}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === 'images' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'images' ? '#2563eb' : '#6b7280',
              fontWeight: activeTab === 'images' ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            图片 ({images.length})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === 'documents' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'documents' ? '#2563eb' : '#6b7280',
              fontWeight: activeTab === 'documents' ? 600 : 400,
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            文档 ({documents.length})
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      {activeTab === 'images' && renderMediaList(images, 'image')}
      {activeTab === 'documents' && renderMediaList(documents, 'document')}

      {/* TXT预览对话框 */}
      {txtPreview.visible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={closeTxtPreview}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              width: '90%',
              maxWidth: 800,
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{txtPreview.title}</h3>
              <button
                onClick={closeTxtPreview}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#6b7280',
                }}
              >
                ×
              </button>
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                fontSize: 14,
                lineHeight: 1.6,
                color: '#374151',
                maxHeight: 'calc(80vh - 100px)',
                overflow: 'auto',
              }}
            >
              {txtPreview.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaManager;

