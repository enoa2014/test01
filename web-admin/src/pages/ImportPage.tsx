import React, { useState, useCallback } from 'react';
import { useCloudFunction } from '../hooks/useCloudFunction';
import { useRBAC } from '../contexts/RBACContext';
import { AdminRouteGuard } from '../components/AdminRouteGuard';
import { uploadFile } from '../services/uploadService';
import { AlertCircle, CheckCircle, FileSpreadsheet, Upload, X, AlertTriangle, Download } from 'lucide-react';

interface ImportJob {
  _id: string;
  fileId: string;
  mode: 'smart' | 'createOnly' | 'updateOnly';
  state: 'parsed' | 'running' | 'succeeded' | 'failed' | 'completed_with_errors';
  validationResult?: {
    sheetName: string;
    headers: Array<{
      original: string;
      field: string;
      required: boolean;
    }>;
    sampleRows: Array<{
      index: number;
      data: any;
      warnings: string[];
    }>;
    totalRows: number;
    warnings: string[];
    missingRequiredFields: string[];
  };
  stats?: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
  errors?: Array<{
    row: number;
    error: string;
  }>;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

interface ParseResult {
  sheetName: string;
  headers: Array<{
    original: string;
    field: string;
    required: boolean;
  }>;
  sampleRows: Array<{
    index: number;
    data: any;
    warnings: string[];
  }>;
  totalRows: number;
  warnings: string[];
  missingRequiredFields: string[];
}

const ImportPage: React.FC = () => {
  const { isAdmin } = useRBAC();
  const { callFunction } = useCloudFunction();

  const [currentStep, setCurrentStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [fileId, setFileId] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [importMode, setImportMode] = useState<'smart' | 'createOnly' | 'updateOnly'>('smart');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  // 加载历史导入任务
  const loadImportJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const response = await callFunction('importExcel', {
        action: 'listJobs',
        page: 1,
        pageSize: 20
      });

      if (response.success) {
        setImportJobs(response.data.items);
      }
    } catch (error) {
      console.error('加载导入历史失败:', error);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [callFunction]);

  // 文件上传
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      alert('请选择Excel文件（.xlsx或.xls格式）');
      return;
    }

    setFileName(file.name);
    setUploadProgress(0);
    setIsProcessing(true);

    try {
      // 上传到云存储
      setUploadProgress(25);
      const uploadResponse = await uploadFile(file, (progress) => {
        setUploadProgress(25 + Math.floor(progress * 0.5));
      });

      if (uploadResponse.success) {
        setFileId(uploadResponse.fileId || uploadResponse.fileID || '');
        setUploadProgress(75);

        // 解析Excel文件
        const parseResponse = await callFunction('importExcel', {
          action: 'parse',
          fileId: uploadResponse.fileId || uploadResponse.fileID
        });

        if (parseResponse.success) {
          setParseResult(parseResponse.validationResult);
          setCurrentJob({
            _id: parseResponse.jobId,
            fileId: uploadResponse.fileId || uploadResponse.fileID || '',
            mode: importMode,
            state: 'parsed',
            validationResult: parseResponse.validationResult,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
          setUploadProgress(100);
          setCurrentStep('preview');
        } else {
          throw new Error(parseResponse.error?.message || '文件解析失败');
        }
      } else {
        throw new Error('文件上传失败');
      }
    } catch (error) {
      console.error('文件上传失败:', error);
      alert('文件上传失败：' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [callFunction, importMode]);

  // 执行导入
  const handleImport = useCallback(async () => {
    if (!currentJob) return;

    setIsProcessing(true);
    try {
      const response = await callFunction('importExcel', {
        action: 'import',
        jobId: currentJob._id
      });

      if (response.success) {
        setCurrentStep('result');
        // 刷新历史记录
        loadImportJobs();
      } else {
        throw new Error(response.error?.message || '导入失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败：' + (error as Error).message);
    } finally {
      setIsProcessing(false);
    }
  }, [currentJob, callFunction, loadImportJobs]);

  // 重新开始
  const handleReset = useCallback(() => {
    setCurrentStep('upload');
    setFileId('');
    setFileName('');
    setParseResult(null);
    setCurrentJob(null);
    setIsProcessing(false);
    setUploadProgress(0);
  }, []);

  // 获取状态颜色
  const getStateColor = (state: string) => {
    switch (state) {
      case 'parsed': return 'text-yellow-600 bg-yellow-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'succeeded': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'completed_with_errors': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // 获取状态文本
  const getStateText = (state: string) => {
    switch (state) {
      case 'parsed': return '已解析';
      case 'running': return '导入中';
      case 'succeeded': return '导入成功';
      case 'failed': return '导入失败';
      case 'completed_with_errors': return '部分成功';
      default: return state;
    }
  };

  if (!isAdmin) {
    return (
      <AdminRouteGuard requireAdmin={true}>
        <div className="p-6">
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">无权限访问</h3>
            <p className="mt-1 text-sm text-gray-500">您没有导入Excel的权限</p>
          </div>
        </div>
      </AdminRouteGuard>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* 现代化页面头部 */}
      <div className="hero" style={{
        padding: 'var(--space-8) var(--space-5) var(--space-4)',
        background: 'linear-gradient(180deg, var(--color-bg-primary, #ffffff) 0%, var(--color-bg-secondary, #f8fafc) 100%)',
        borderRadius: 16,
        marginBottom: 24,
        border: '1px solid var(--color-border-secondary, #e2e8f0)',
        boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(15, 23, 42, 0.08))'
      }}>
        <div className="hero-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-3)',
          flexWrap: 'wrap'
        }}>
          <div>
            <h1 className="title" style={{
              fontSize: 'var(--text-xl, 20px)',
              fontWeight: 'var(--font-semibold, 600)',
              color: 'var(--color-text-primary, #1f2937)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              margin: 0
            }}>
              <span style={{ color: 'var(--color-primary, #3b82f6)' }}>📊</span>
              数据导入中心
            </h1>
            <p className="hero-subtitle" style={{
              margin: 'var(--space-1) 0 0',
              fontSize: 'var(--text-sm, 14px)',
              color: 'var(--color-text-secondary, #64748b)'
            }}>
              将Excel文件中的患者数据智能导入到系统中
            </p>
          </div>
        </div>
      </div>

      {/* 现代化Tab切换 */}
      <div className="modern-tabs" style={{
        backgroundColor: 'var(--color-bg-primary, #ffffff)',
        borderRadius: 12,
        padding: '4px',
        marginBottom: 24,
        border: '1px solid var(--color-border-secondary, #e2e8f0)',
        display: 'flex',
        gap: 4
      }}>
        <button
          onClick={() => setActiveTab('new')}
          className={`modern-tab ${activeTab === 'new' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            background: activeTab === 'new'
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
              : 'transparent',
            color: activeTab === 'new' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'new') {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#1e293b';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'new') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }
          }}
        >
          <span>📤</span>
          新建导入
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            loadImportJobs();
          }}
          className={`modern-tab ${activeTab === 'history' ? 'active' : ''}`}
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            background: activeTab === 'history'
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
              : 'transparent',
            color: activeTab === 'history' ? '#ffffff' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'history') {
              e.currentTarget.style.background = '#f1f5f9';
              e.currentTarget.style.color = '#1e293b';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'history') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#64748b';
            }
          }}
        >
          <span>📋</span>
          导入历史
        </button>
      </div>

      {activeTab === 'new' ? (
        <>
          {/* 现代化步骤指示器 */}
          <div className="modern-steps" style={{
            marginBottom: 32,
            padding: 24,
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            borderRadius: 16,
            border: '1px solid #e2e8f0'
          }}>
            <div className="flex items-center justify-between" style={{ position: 'relative' }}>
              {/* 进度线 */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: 2,
                background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                transform: 'translateY(-50%)',
                zIndex: 0,
                opacity: currentStep === 'result' ? 1 : currentStep === 'preview' ? 0.5 : 0.2,
                transition: 'opacity 0.3s ease'
              }} />

              {[
                { id: 'upload', label: '上传文件', icon: '📤', color: '#3b82f6' },
                { id: 'preview', label: '预览数据', icon: '📋', color: '#10b981' },
                { id: 'result', label: '导入结果', icon: '✅', color: '#22c55e' }
              ].map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = ['preview', 'result'].includes(currentStep) && index < 1 ||
                                   currentStep === 'result' && index < 2;

                return (
                  <div key={step.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                    zIndex: 1,
                    flex: 1
                  }}>
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      background: isActive
                        ? `linear-gradient(135deg, ${step.color} 0%, ${step.color}dd 100%)`
                        : isCompleted
                        ? `linear-gradient(135deg, #10b981 0%, #059669 100%)`
                        : '#ffffff',
                      color: isActive || isCompleted ? '#ffffff' : '#9ca3af',
                      border: `2px solid ${isActive ? step.color : isCompleted ? '#10b981' : '#e5e7eb'}`,
                      boxShadow: isActive
                        ? `0 8px 25px ${step.color}33, 0 0 0 1px ${step.color}22`
                        : isCompleted
                        ? '0 4px 12px rgba(16, 185, 129, 0.25)'
                        : '0 2px 8px rgba(0, 0, 0, 0.08)',
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                      {step.icon}
                    </div>
                    <span style={{
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? step.color : isCompleted ? '#059669' : '#9ca3af',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 步骤1: 上传文件 */}
          {currentStep === 'upload' && (
            <div className="modern-upload-section" style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(226, 232, 240, 0.5)',
              padding: 32,
              marginBottom: 24
            }}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <h2 style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: 8
                }}>
                  📤 选择Excel文件
                </h2>
                <p style={{ fontSize: 14, color: '#64748b' }}>
                  支持智能数据识别和多种导入模式
                </p>
              </div>

              {/* 导入模式选择 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16
                }}>
                  <div style={{
                    width: 6,
                    height: 24,
                    background: '#3b82f6',
                    borderRadius: 3
                  }} />
                  <h3 style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#111827',
                    margin: 0
                  }}>
                    选择导入方式
                  </h3>
                </div>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  请根据您的需求选择合适的导入模式：
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                  {[
                    {
                      value: 'smart',
                      label: '智能合并模式',
                      desc: '系统会自动识别已存在的患者信息并进行更新，同时创建新的患者记录',
                      icon: '🔄',
                      color: '#3b82f6',
                      features: ['更新已存在记录', '创建新记录', '智能重复检测']
                    },
                    {
                      value: 'createOnly',
                      label: '仅新增模式',
                      desc: '只创建新的患者记录，如果发现重复信息将自动跳过',
                      icon: '➕',
                      color: '#10b981',
                      features: ['只创建新记录', '跳过重复数据', '保证数据唯一']
                    },
                    {
                      value: 'updateOnly',
                      label: '仅更新模式',
                      desc: '只更新已存在的患者信息，不会创建任何新的患者记录',
                      icon: '✏️',
                      color: '#f59e0b',
                      features: ['只更新已存在', '不创建新记录', '数据更新专用']
                    }
                  ].map((mode) => (
                    <div
                      key={mode.value}
                      onClick={() => setImportMode(mode.value as any)}
                      style={{
                        padding: 20,
                        borderRadius: 12,
                        border: `3px solid ${importMode === mode.value ? mode.color : '#e5e7eb'}`,
                        background: importMode === mode.value
                          ? `${mode.color}15`
                          : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (importMode !== mode.value) {
                          e.currentTarget.style.background = '#f8fafc';
                          e.currentTarget.style.borderColor = mode.color;
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = `0 8px 25px ${mode.color}20`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (importMode !== mode.value) {
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = '#e5e7eb';
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      {importMode === mode.value && (
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: mode.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }}>
                          ✓
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: `${mode.color}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 24
                        }}>
                          {mode.icon}
                        </div>
                        <div>
                          <div style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: importMode === mode.value ? mode.color : '#1e293b'
                          }}>
                            {mode.label}
                          </div>
                        </div>
                      </div>
                      <p style={{
                        fontSize: 13,
                        color: '#6b7280',
                        lineHeight: 1.5,
                        marginBottom: 12
                      }}>
                        {mode.desc}
                      </p>
                      <div style={{
                        padding: '8px 12px',
                        background: '#f9fafb',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: '600' }}>
                          特点：
                        </div>
                        {mode.features.map((feature, idx) => (
                          <div key={idx} style={{
                            fontSize: 11,
                            color: '#374151',
                            marginBottom: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}>
                            <span style={{ color: mode.color }}>•</span>
                            {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 文件上传区域 */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16
                }}>
                  <div style={{
                    width: 6,
                    height: 24,
                    background: '#3b82f6',
                    borderRadius: 3
                  }} />
                  <h3 style={{
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#111827',
                    margin: 0
                  }}>
                    上传Excel文件
                  </h3>
                </div>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  请选择包含患者信息的Excel文件：
                </p>
                <div style={{
                  border: `3px dashed ${isProcessing ? '#94a3b8' : '#cbd5e1'}`,
                  borderRadius: 16,
                  padding: 48,
                  textAlign: 'center',
                  background: isProcessing
                    ? '#f1f5f9'
                    : '#ffffff',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {isProcessing && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)',
                      animation: 'shimmer 2s infinite'
                    }} />
                  )}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileUpload}
                    disabled={isProcessing}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" style={{ cursor: isProcessing ? 'not-allowed' : 'pointer' }}>
                    <div style={{
                      width: 80,
                      height: 80,
                      borderRadius: '50%',
                      background: isProcessing
                        ? '#e5e7eb'
                        : '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 20px',
                      fontSize: 32,
                      transition: 'all 0.3s ease'
                    }}>
                      📊
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{
                        fontSize: 18,
                        fontWeight: 'bold',
                        color: isProcessing ? '#94a3b8' : '#3b82f6',
                        marginRight: 8
                      }}>
                        {isProcessing ? '正在处理文件...' : '点击选择Excel文件'}
                      </span>
                      {!isProcessing && (
                        <span style={{ color: '#6b7280' }}>
                          或直接拖拽文件到此处
                        </span>
                      )}
                    </div>
                    <div style={{
                      background: '#f3f4f6',
                      padding: '12px 16px',
                      borderRadius: 8,
                      display: 'inline-block'
                    }}>
                      <p style={{ fontSize: 14, color: '#374151', margin: 0, fontWeight: '600' }}>
                        📋 支持格式：
                      </p>
                      <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
                        • .xlsx 格式（推荐）<br/>
                        • .xls 格式<br/>
                        • 文件大小：不超过10MB
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {fileName && (
                <div style={{
                  marginTop: 20,
                  padding: 16,
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                  borderRadius: 12,
                  border: '1px solid #bfdbfe'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                        color: 'white'
                      }}>
                        📊
                      </div>
                      <div>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#1e40af'
                        }}>
                          {fileName}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          Excel 文件
                        </div>
                      </div>
                    </div>
                    {isProcessing && (
                      <span style={{
                        fontSize: 13,
                        color: '#3b82f6',
                        fontWeight: 500
                      }}>
                        处理中... {uploadProgress}%
                      </span>
                    )}
                  </div>
                  {isProcessing && (
                    <div style={{
                      width: '100%',
                      height: 6,
                      backgroundColor: '#dbeafe',
                      borderRadius: 3,
                      overflow: 'hidden',
                      marginTop: 8
                    }}>
                      <div
                        style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
                          borderRadius: 3,
                          transition: 'width 0.3s ease',
                          width: `${uploadProgress}%`
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 步骤2: 预览数据 */}
          {currentStep === 'preview' && parseResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* 清晰的解析结果概览 */}
              <div style={{
                background: '#ffffff',
                borderRadius: 12,
                border: '2px solid #e5e7eb',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                padding: 24
              }}>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <h2 style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 8
                  }}>
                    Excel文件解析结果
                  </h2>
                  <p style={{ fontSize: 16, color: '#6b7280' }}>
                    请检查下方数据是否正确，确认无误后开始导入
                  </p>
                </div>

                {/* 数据统计卡片 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 16,
                  marginBottom: 24
                }}>
                  <div style={{
                    background: '#f0f9ff',
                    border: '2px solid #0ea5e9',
                    borderRadius: 8,
                    padding: 16,
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: 36,
                      fontWeight: 'bold',
                      color: '#0369a1',
                      marginBottom: 4
                    }}>
                      {parseResult.totalRows}
                    </div>
                    <div style={{ fontSize: 14, color: '#0369a1', fontWeight: '600' }}>
                      数据总行数
                    </div>
                  </div>
                  <div style={{
                    background: '#f0fdf4',
                    border: '2px solid #22c55e',
                    borderRadius: 8,
                    padding: 16,
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: 36,
                      fontWeight: 'bold',
                      color: '#15803d',
                      marginBottom: 4
                    }}>
                      {parseResult.headers.length}
                    </div>
                    <div style={{ fontSize: 14, color: '#15803d', fontWeight: '600' }}>
                      识别字段数
                    </div>
                  </div>
                  <div style={{
                    background: '#fefce8',
                    border: '2px solid #eab308',
                    borderRadius: 8,
                    padding: 16,
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: 36,
                      fontWeight: 'bold',
                      color: '#a16207',
                      marginBottom: 4
                    }}>
                      {parseResult.warnings.length}
                    </div>
                    <div style={{ fontSize: 14, color: '#a16207', fontWeight: '600' }}>
                      警告问题数
                    </div>
                  </div>
                </div>

                {/* 警告信息 */}
                {parseResult.warnings.length > 0 && (
                  <div style={{
                    background: '#fef3c7',
                    border: '2px solid #f59e0b',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        fontSize: 24,
                        color: '#d97706',
                        marginTop: 0,
                        fontWeight: 'bold'
                      }}>⚠️</div>
                      <div style={{ flex: 1 }}>
                        <h4 style={{
                          fontSize: 16,
                          fontWeight: 'bold',
                          color: '#92400e',
                          marginBottom: 8
                        }}>
                          发现以下问题需要处理：
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                          {parseResult.warnings.map((warning, index) => (
                            <li key={index} style={{
                              fontSize: 14,
                              color: '#92400e',
                              marginBottom: 6,
                              lineHeight: 1.5
                            }}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 字段对应关系 */}
              <div style={{
                background: '#ffffff',
                borderRadius: 12,
                border: '2px solid #e5e7eb',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                padding: 24
              }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  📋 字段对应关系
                </h3>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  以下是Excel表格列名与系统字段的对应关系：
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: 12
                }}>
                  {parseResult.headers.map((header, index) => (
                    <div key={index} style={{
                      padding: 12,
                      background: '#f9fafb',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f3f4f6';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: 'bold',
                          color: '#111827'
                        }}>
                          {header.original}
                        </span>
                        <span style={{
                          fontSize: 14,
                          color: '#6b7280'
                        }}>
                          →
                        </span>
                        <span style={{
                          fontSize: 13,
                          color: '#2563eb',
                          fontWeight: '600'
                        }}>
                          {header.field}
                        </span>
                      </div>
                      {header.required && (
                        <div style={{
                          fontSize: 12,
                          color: '#dc2626',
                          fontWeight: '600'
                        }}>
                          * 必填字段
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 数据预览表格 */}
              <div style={{
                background: '#ffffff',
                borderRadius: 12,
                border: '2px solid #e5e7eb',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                padding: 24
              }}>
                <h3 style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  👀 数据预览（前5行）
                </h3>
                <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                  以下是Excel文件中的前5行数据示例：
                </p>
                <div style={{
                  overflowX: 'auto',
                  borderRadius: 8,
                  border: '2px solid #d1d5db'
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 14
                  }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        {parseResult.headers.map((header, index) => (
                          <th key={index} style={{
                            padding: '12px 8px',
                            textAlign: 'left',
                            fontSize: 12,
                            fontWeight: 'bold',
                            color: '#374151',
                            borderBottom: '2px solid #d1d5db',
                            borderRight: '1px solid #d1d5db',
                            whiteSpace: 'nowrap'
                          }}>
                            {header.original}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.sampleRows.slice(0, 5).map((row, rowIndex) => (
                        <tr key={rowIndex} style={{
                          backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb',
                          borderBottom: '1px solid #e5e7eb'
                        }}>
                          {parseResult.headers.map((header, colIndex) => (
                            <td key={colIndex} style={{
                              padding: '10px 8px',
                              fontSize: 13,
                              color: '#1f2937',
                              borderRight: '1px solid #e5e7eb',
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {row.data[header.field] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 操作按钮区域 */}
              <div style={{
                background: '#f9fafb',
                borderRadius: 12,
                border: '2px solid #d1d5db',
                padding: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: 16, color: '#374151', fontWeight: '600', marginBottom: 4 }}>
                    确认导入操作
                  </p>
                  <p style={{ fontSize: 14, color: '#6b7280' }}>
                    请仔细检查上述数据，确认无误后点击"开始导入"
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={handleReset}
                    disabled={isProcessing}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: '600',
                      border: '2px solid #6b7280',
                      background: '#ffffff',
                      color: '#374151',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = '#f3f4f6';
                        e.currentTarget.style.borderColor = '#4b5563';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#6b7280';
                      }
                    }}
                  >
                    返回重新上传
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isProcessing}
                    style={{
                      padding: '12px 32px',
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 'bold',
                      border: 'none',
                      background: isProcessing
                        ? '#9ca3af'
                        : '#10b981',
                      color: '#ffffff',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = '#059669';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.background = '#10b981';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    {isProcessing ? (
                      <>
                        <div style={{
                          width: 16,
                          height: 16,
                          border: '2px solid #ffffff',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        正在导入...
                      </>
                    ) : (
                      <>
                        ✅ 开始导入
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤3: 导入结果 */}
          {currentStep === 'result' && currentJob && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center mb-6">
                {currentJob.state === 'succeeded' ? (
                  <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
                ) : currentJob.state === 'completed_with_errors' ? (
                  <AlertTriangle className="mx-auto h-16 w-16 text-yellow-500" />
                ) : (
                  <X className="mx-auto h-16 w-16 text-red-500" />
                )}
                <h2 className="text-xl font-medium text-gray-900 mt-4">
                  {currentJob.state === 'succeeded' ? '导入成功' :
                   currentJob.state === 'completed_with_errors' ? '部分数据导入成功' : '导入失败'}
                </h2>
              </div>

              {currentJob.stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-900">{currentJob.stats.total}</div>
                    <div className="text-sm text-gray-600">总数据量</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{currentJob.stats.success}</div>
                    <div className="text-sm text-green-900">成功导入</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">{currentJob.stats.skipped}</div>
                    <div className="text-sm text-yellow-900">跳过记录</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">{currentJob.stats.failed}</div>
                    <div className="text-sm text-red-900">失败记录</div>
                  </div>
                </div>
              )}

              {currentJob.errors && currentJob.errors.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">错误详情</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg max-h-60 overflow-y-auto">
                    {currentJob.errors.map((error, index) => (
                      <div key={index} className="p-3 border-b border-red-100 last:border-b-0">
                        <span className="text-sm font-medium text-red-900">第{error.row}行:</span>
                        <span className="text-sm text-red-700 ml-2">{error.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  导入新的文件
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* 导入历史 */
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">导入历史记录</h2>
          </div>

          {isLoadingJobs ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : importJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2">暂无导入记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      文件名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      导入模式
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      统计
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      创建时间
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {importJobs.map((job) => (
                    <tr key={job._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {job.fileId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.mode === 'smart' ? '智能合并' :
                         job.mode === 'createOnly' ? '仅新增' : '仅更新'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStateColor(job.state)}`}>
                          {getStateText(job.state)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {job.stats && (
                          <span>
                            成功: {job.stats.success} /
                            失败: {job.stats.failed} /
                            跳过: {job.stats.skipped}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(job.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button className="text-blue-600 hover:text-blue-900">
                          查看详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportPage;
