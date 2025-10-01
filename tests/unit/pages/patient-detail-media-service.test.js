const path = require('path');

const { createMediaService } = require(path.resolve(
  __dirname,
  '../../../miniprogram/pages/patient-detail/media-service.js'
));

describe('patient-detail media service dispose lifecycle', () => {
  let page;

  beforeEach(() => {
    page = {
      patientKey: 'patient-001',
      setData: jest.fn(function setData(patch) {
        // 模拟微信 setData 合并行为，便于后续读取最新状态
        if (!this.data) {
          this.data = {};
        }
        Object.keys(patch).forEach(key => {
          const segments = key.split('.');
          let cursor = this.data;
          while (segments.length > 1) {
            const segment = segments.shift();
            cursor[segment] = cursor[segment] || {};
            cursor = cursor[segment];
          }
          cursor[segments[0]] = patch[key];
        });
      }),
      data: {
        media: {
          images: [
            {
              id: 'img-1',
              previewUrl: '',
              previewExpiresAt: 0,
            },
          ],
          documents: [],
          quota: {
            remainingCount: 2,
            remainingBytes: 10 * 1024,
          },
        },
      },
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('setMediaState 不会在 dispose 后调用 setData', () => {
    const service = createMediaService(page);
    service.setMediaState({ loading: true });
    expect(page.setData).toHaveBeenCalledWith({ 'media.loading': true });

    page.setData.mockClear();
    service.dispose();
    expect(() => service.setMediaState({ loading: false })).not.toThrow();
    expect(page.setData).not.toHaveBeenCalled();
  });

  test('updateMediaRecord 在 dispose 后静默返回', () => {
    const service = createMediaService(page);
    service.updateMediaRecord('image', 0, { previewUrl: 'foo' });
    expect(page.setData).toHaveBeenLastCalledWith({
      'media.images': [{ id: 'img-1', previewExpiresAt: 0, previewUrl: 'foo' }],
    });

    page.setData.mockClear();
    service.dispose();
    expect(() => service.updateMediaRecord('image', 0, { previewUrl: 'bar' })).not.toThrow();
    expect(page.setData).not.toHaveBeenCalled();
  });

  test('callPatientMedia 在页面卸载后直接抛错', async () => {
    const service = createMediaService(page);
    service.dispose();
    await expect(service.callPatientMedia('list')).rejects.toThrow('页面已卸载');
  });
});
