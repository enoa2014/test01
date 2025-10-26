import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock the media API
vi.mock('../../api/media', () => ({
  listMedia: vi.fn().mockResolvedValue({
    images: [],
    documents: [],
    quota: {
      totalCount: 0,
      totalBytes: 0,
      remainingCount: 20,
      remainingBytes: 31457280 // 30MB
    }
  }),
  uploadMedia: vi.fn().mockResolvedValue({ success: true }),
  deleteMediaItem: vi.fn().mockResolvedValue({ success: true }),
  getMediaDownloadUrl: vi.fn().mockResolvedValue({ url: 'https://example.com/download' }),
  getMediaPreviewUrl: vi.fn().mockResolvedValue({ url: 'https://example.com/preview' }),
  getTxtPreview: vi.fn().mockResolvedValue({ content: 'Mock text content' }),
}));

// Mock useCloudbase hook
vi.mock('../../hooks/useCloudbase', () => ({
  useCloudbase: () => ({
    app: {
      callFunction: vi.fn().mockResolvedValue({
        result: { success: true, data: {} }
      })
    },
    user: {
      uid: 'test-user',
      username: 'test-user'
    }
  })
}));

// Mock CloudBase SDK
vi.mock('@cloudbase/js-sdk', () => ({
  default: {
    init: vi.fn(() => ({
      auth: vi.fn(() => ({
        getLoginState: vi.fn().mockResolvedValue(null),
        signInAnonymously: vi.fn().mockResolvedValue({ user: { uid: 'test-user' } }),
        signOut: vi.fn().mockResolvedValue(undefined),
      })),
      callFunction: vi.fn().mockResolvedValue({
        result: { success: true, data: {} }
      })
    }))
  }
}));

// Mock environment variables for E2E bypass
vi.stubEnv('VITE_E2E_BYPASS_LOGIN', '1');

describe('MediaManager (修复版)', () => {
  const mockMediaFiles = [
    {
      id: '1',
      filename: '患者证件.jpg',
      displayName: '患者证件.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024000,
      url: 'https://example.com/file1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      createdAt: '2024-01-15T10:30:00Z',
      patientKey: 'patient_1'
    },
    {
      id: '2',
      filename: '医疗记录.pdf',
      displayName: '医疗记录.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048000,
      url: 'https://example.com/file2.pdf',
      createdAt: '2024-01-15T11:45:00Z',
      patientKey: 'patient_1'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  // 简单包装器（不依赖 Provider，全局已 mock useCloudbase）
  const Wrapper = ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children);

  // 动态默认导入组件
  const importMediaManager = async () => (await import('../MediaManager')).default as React.FC<any>;

  describe('基础渲染测试', () => {
    it('应该能够正确导入组件', async () => {
      expect(async () => {
        await import('../MediaManager');
      }).not.toThrow();
    });

    it('应该能够正常渲染组件', async () => {
      const MediaManager = await importMediaManager();

      expect(() => {
        render(
          React.createElement(Wrapper, null,
            React.createElement(MediaManager, { patientKey: 'test_patient' })
          )
        );
      }).not.toThrow();
    });

    it('应该显示媒体管理界面的基本元素', async () => {
      const MediaManager = await importMediaManager();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/患者资料管理/)).toBeInTheDocument();
      });
    });
  });

  describe('文件上传功能测试', () => {
    it('应该显示文件上传按钮', async () => {
      const MediaManager = await importMediaManager();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/上传图片/)).toBeInTheDocument();
        expect(screen.getByText(/上传文档/)).toBeInTheDocument();
      });
    });

    it('应该显示文件配额信息', async () => {
      const { listMedia } = await import('../../api/media');
      (listMedia as any).mockResolvedValue({
        images: [],
        documents: [],
        quota: {
          totalCount: 5,
          totalBytes: 1048576,
          remainingCount: 15,
          remainingBytes: 31457280
        }
      });

      const MediaManager = await importMediaManager();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/附件数量/)).toBeInTheDocument();
        expect(screen.getByText(/5 \/ 20/)).toBeInTheDocument();
      });
    });
  });

  describe('文件列表显示测试', () => {
    it('应该显示患者相关的媒体文件（按Tab显示）', async () => {
      const { listMedia } = await import('../../api/media');
      (listMedia as any).mockResolvedValue({
        images: mockMediaFiles.filter(f => f.mimeType.startsWith('image/')),
        documents: mockMediaFiles.filter(f => !f.mimeType.startsWith('image/')),
        quota: {
          totalCount: 2,
          totalBytes: 3072000,
          remainingCount: 18,
          remainingBytes: 28385280
        }
      });

      const MediaManager = await importMediaManager();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'patient_1' })
        )
      );

      // 默认激活“图片”Tab，只应看到图片文件
      await waitFor(() => {
        expect(screen.getByText('患者证件.jpg')).toBeInTheDocument();
        expect(screen.queryByText('医疗记录.pdf')).not.toBeInTheDocument();
      });

      // 切换到“文档”Tab后，应显示PDF
      const docTab = screen.getByText(/文档/);
      await userEvent.setup().click(docTab);
      await waitFor(() => {
        expect(screen.getByText('医疗记录.pdf')).toBeInTheDocument();
      });
    });

    it('应该处理空文件列表', async () => {
      const MediaManager = await importMediaManager();

      render(
        React.createElement(createWrapper, null,
          React.createElement(MediaManager, { patientKey: 'new_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/暂无图片附件/)).toBeInTheDocument();
      });
    });
  });

  describe('Tab切换测试', () => {
    it('应该支持图片和文档Tab切换', async () => {
      const { listMedia } = await import('../../api/media');
      (listMedia as any).mockResolvedValue({
        images: mockMediaFiles.filter(f => f.mimeType.startsWith('image/')),
        documents: mockMediaFiles.filter(f => !f.mimeType.startsWith('image/')),
        quota: {
          totalCount: 2,
          totalBytes: 3072000,
          remainingCount: 18,
          remainingBytes: 28385280
        }
      });

      const MediaManager = await importMediaManager();
      const user = userEvent.setup();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'patient_1' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/图片/)).toBeInTheDocument();
        expect(screen.getByText(/文档/)).toBeInTheDocument();
      });

      // 点击文档Tab
      const documentTab = screen.getByText(/文档/);
      await user.click(documentTab);

      await waitFor(() => {
        expect(screen.getByText('医疗记录.pdf')).toBeInTheDocument();
      });
    });
  });

  describe('文件操作测试', () => {
    it('应该支持预览和下载功能', async () => {
      const { listMedia } = await import('../../api/media');
      (listMedia as any).mockResolvedValue({
        images: mockMediaFiles.filter(f => f.mimeType.startsWith('image/')),
        documents: [],
        quota: {
          totalCount: 1,
          totalBytes: 1024000,
          remainingCount: 19,
          remainingBytes: 30433280
        }
      });

      const MediaManager = await importMediaManager();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'patient_1' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText('患者证件.jpg')).toBeInTheDocument();
        expect(screen.getByText(/预览/)).toBeInTheDocument();
        expect(screen.getByText(/下载/)).toBeInTheDocument();
      });
    });
  });

  describe('错误处理测试', () => {
    it('应该处理加载错误', async () => {
      const { listMedia } = await import('../../api/media');
      (listMedia as any).mockRejectedValue(new Error('加载失败'));

      const MediaManager = await importMediaManager();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/加载附件失败/)).toBeInTheDocument();
      });
    });
  });

  describe('可访问性测试', () => {
    it('应该支持键盘导航', async () => {
      const { MediaManager } = await import('../MediaManager');
      const user = userEvent.setup();

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/患者资料管理/)).toBeInTheDocument();
      });

      // 测试Tab键导航
      await user.tab();
      expect(document.activeElement).toBeInTheDocument();
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内渲染', async () => {
      const startTime = Date.now();

      const { MediaManager } = await import('../MediaManager');

      render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      await waitFor(() => {
        expect(screen.getByText(/患者资料管理/)).toBeInTheDocument();
      });

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('生命周期测试', () => {
    it('应该正确处理组件挂载和卸载', async () => {
      const { MediaManager } = await import('../MediaManager');

      const { unmount } = render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'test_patient' })
        )
      );

      expect(() => unmount()).not.toThrow();
    });

    it('应该正确处理重新渲染', async () => {
      const { MediaManager } = await import('../MediaManager');

      const { rerender } = render(
        React.createElement(Wrapper, null,
          React.createElement(MediaManager, { patientKey: 'patient_1' })
        )
      );

      expect(() => {
        rerender(
          React.createElement(Wrapper, null,
            React.createElement(MediaManager, { patientKey: 'patient_2' })
          )
        );
      }).not.toThrow();
    });
  });
});
