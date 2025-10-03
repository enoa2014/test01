const path = require('path');

const componentPath = path.resolve(
  __dirname,
  '../../..',
  'miniprogram/components/business/smart-search-bar/index.js'
);

describe('smart-search-bar component', () => {
  beforeEach(() => {
    jest.resetModules();
    global.Component = jest.fn();
    global.wx = {
      getStorageSync: jest.fn(() => []),
      setStorageSync: jest.fn(),
      removeStorageSync: jest.fn(),
    };
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete global.Component;
    delete global.wx;
  });

  function loadComponent() {
    require(componentPath);
    expect(global.Component).toHaveBeenCalledTimes(1);
    return global.Component.mock.calls[0][0];
  }

  it('registers default properties and data', () => {
    const config = loadComponent();
    expect(config.properties.value.value).toBe('');
    expect(config.properties.placeholder.value).toContain('搜索住户');
    expect(config.properties.suggestions.value).toEqual([]);
    expect(config.properties.filters.value).toEqual([]);
    expect(config.properties.loading.value).toBe(false);
    expect(config.properties.historyEnabled.value).toBe(true);
    expect(config.properties.debounce.value).toBe(300);
    expect(config.data.internalValue).toBe('');
    expect(config.data.debouncedSuggestions).toEqual([]);
  });

  it('debounces input and emits suggest/input events once timer completes', () => {
    const config = loadComponent();
    const triggerEvent = jest.fn();
    const ctx = {
      data: { debounce: 120, debounceTimer: null },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      triggerEvent,
    };
    ctx.safeString = config.methods.safeString.bind(ctx);
    ctx.clearDebounce = config.methods.clearDebounce.bind(ctx);
    ctx.emitInput = config.methods.emitInput.bind(ctx);

    config.methods.handleInput.call(ctx, { detail: { value: ' Alice ' } });

    expect(ctx.data.internalValue).toBe(' Alice ');
    jest.advanceTimersByTime(120);

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'input', { value: 'Alice' });
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'suggest', { value: 'Alice', source: 'input' });
    expect(ctx.data.debounceTimer).toBeNull();
  });

  it('clears value and emits clear plus input/suggest with empty string', () => {
    const config = loadComponent();
    const triggerEvent = jest.fn();
    const ctx = {
      data: { debounceTimer: 111, internalValue: '数据', debounce: 200 },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      triggerEvent,
    };
    ctx.safeString = config.methods.safeString.bind(ctx);
    ctx.clearDebounce = config.methods.clearDebounce.bind(ctx);
    ctx.emitInput = config.methods.emitInput.bind(ctx);

    config.methods.handleClear.call(ctx);

    expect(triggerEvent).toHaveBeenCalledWith('clear');
    expect(triggerEvent).toHaveBeenCalledWith('input', { value: '' });
    expect(triggerEvent).toHaveBeenCalledWith('suggest', { value: '', source: 'input' });
    expect(ctx.data.internalValue).toBe('');
    expect(ctx.data.debounceTimer).toBeNull();
  });

  it('persists search history when historyEnabled is true', () => {
    const config = loadComponent();
    const ctx = {
      data: { historyEnabled: true, searchHistory: [] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };
    ctx.safeString = config.methods.safeString.bind(ctx);
    global.wx.getStorageSync.mockReturnValue(['肺炎']);

    config.methods.saveHistory.call(ctx, ' 心血管 ');

    expect(global.wx.setStorageSync).toHaveBeenCalledWith(
      'smart_search_history',
      ['心血管', '肺炎']
    );
    expect(ctx.data.searchHistory).toEqual(['心血管', '肺炎']);
  });

  it('emits filtertap and toggleadv events', () => {
    const config = loadComponent();
    const triggerEvent = jest.fn();
    const ctx = {
      data: {},
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      triggerEvent,
    };
    ctx.safeString = config.methods.safeString.bind(ctx);

    config.methods.handleFilterTap.call(ctx, { currentTarget: { dataset: { filter: { id: 'risk' } } } });
    config.methods.handleToggleAdvanced.call(ctx);

    expect(triggerEvent).toHaveBeenNthCalledWith(1, 'filtertap', { filter: { id: 'risk' } });
    expect(triggerEvent).toHaveBeenNthCalledWith(2, 'toggleadv');
  });

  // 增强测试: 连续输入防抖场景 (TODO.md 阶段3.2.5要求)
  it('only triggers once when user types continuously (debounce)', () => {
    const config = loadComponent();
    const triggerEvent = jest.fn();
    const ctx = {
      data: { debounce: 300, debounceTimer: null, internalValue: '' },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      triggerEvent,
    };
    ctx.safeString = config.methods.safeString.bind(ctx);
    ctx.clearDebounce = config.methods.clearDebounce.bind(ctx);
    ctx.emitInput = config.methods.emitInput.bind(ctx);

    // 模拟连续快速输入3次
    config.methods.handleInput.call(ctx, { detail: { value: '张' } });
    jest.advanceTimersByTime(100); // 100ms后继续输入

    config.methods.handleInput.call(ctx, { detail: { value: '张三' } });
    jest.advanceTimersByTime(100); // 再100ms后继续输入

    config.methods.handleInput.call(ctx, { detail: { value: '张三丰' } });

    // 在300ms完成之前,应该没有触发事件
    expect(triggerEvent).not.toHaveBeenCalled();

    // 等待防抖完成
    jest.advanceTimersByTime(300);

    // 应只触发一次,且值为最后输入的内容
    expect(triggerEvent).toHaveBeenCalledTimes(2); // input + suggest
    expect(triggerEvent).toHaveBeenCalledWith('input', { value: '张三丰' });
    expect(triggerEvent).toHaveBeenCalledWith('suggest', { value: '张三丰', source: 'input' });
  });

  // 增强测试: 搜索历史持久化测试 (TODO.md 阶段3.2.5要求)
  it('persists search history across sessions using wx storage', () => {
    const config = loadComponent();

    // 模拟首次加载时有历史记录
    const existingHistory = ['患者A', '患者B', '患者C'];
    global.wx.getStorageSync.mockReturnValue(existingHistory);

    const ctx = {
      data: { historyEnabled: true, searchHistory: [] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    // 加载历史记录
    config.methods.loadHistory.call(ctx);

    expect(global.wx.getStorageSync).toHaveBeenCalledWith('smart_search_history');
    expect(ctx.data.searchHistory).toEqual(existingHistory);
  });

  it('limits search history to MAX_HISTORY (10 items)', () => {
    const config = loadComponent();

    // 模拟超过10条的历史记录
    const longHistory = Array.from({ length: 15 }, (_, i) => `患者${i}`);
    global.wx.getStorageSync.mockReturnValue(longHistory);

    const ctx = {
      data: { historyEnabled: true, searchHistory: [] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods.loadHistory.call(ctx);

    // 应只保留前10条
    expect(ctx.data.searchHistory).toHaveLength(10);
    expect(ctx.data.searchHistory).toEqual(longHistory.slice(0, 10));
  });

  it('deduplicates search history and moves duplicate to front', () => {
    const config = loadComponent();

    const existingHistory = ['患者A', '患者B', '患者C'];
    global.wx.getStorageSync.mockReturnValue(existingHistory);

    const ctx = {
      data: { historyEnabled: true, searchHistory: existingHistory },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };
    ctx.safeString = config.methods.safeString.bind(ctx);

    // 搜索已存在的关键词
    config.methods.saveHistory.call(ctx, '患者B');

    // 应将重复项移到最前面
    expect(global.wx.setStorageSync).toHaveBeenCalledWith('smart_search_history', [
      '患者B',
      '患者A',
      '患者C',
    ]);
  });

  it('handles storage errors gracefully without throwing', () => {
    const config = loadComponent();

    // 模拟存储异常
    global.wx.getStorageSync.mockImplementation(() => {
      throw new Error('Storage quota exceeded');
    });

    const ctx = {
      data: { historyEnabled: true, searchHistory: [] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    // 不应抛出异常
    expect(() => config.methods.loadHistory.call(ctx)).not.toThrow();
    expect(ctx.data.searchHistory).toEqual([]);
  });

  it('emits search event with correct source (button/confirm/suggestion/history)', () => {
    const config = loadComponent();
    const triggerEvent = jest.fn();

    const ctx = {
      data: { internalValue: '测试患者', historyEnabled: true, searchHistory: [] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
      triggerEvent,
    };
    ctx.safeString = config.methods.safeString.bind(ctx);
    ctx.clearDebounce = config.methods.clearDebounce.bind(ctx);
    ctx.saveHistory = config.methods.saveHistory.bind(ctx);

    // 测试来源: button
    config.methods.handleSearch.call(ctx);
    expect(triggerEvent).toHaveBeenCalledWith('search', { value: '测试患者', source: 'button' });

    triggerEvent.mockClear();

    // 测试来源: confirm
    config.methods.handleConfirm.call(ctx, { detail: { value: '确认搜索' } });
    expect(triggerEvent).toHaveBeenCalledWith('search', { value: '确认搜索', source: 'confirm' });

    triggerEvent.mockClear();

    // 测试来源: suggestion
    config.methods.handleSuggestionTap.call(ctx, {
      currentTarget: { dataset: { suggestion: '建议项' } },
    });
    expect(triggerEvent).toHaveBeenCalledWith('search', { value: '建议项', source: 'suggestion' });

    triggerEvent.mockClear();

    // 测试来源: history
    config.methods.handleHistoryTap.call(ctx, {
      currentTarget: { dataset: { keyword: '历史搜索' } },
    });
    expect(triggerEvent).toHaveBeenCalledWith('search', { value: '历史搜索', source: 'history' });
  });

  it('limits suggestions to MAX_SUGGESTIONS (8 items)', () => {
    const config = loadComponent();

    const longSuggestions = Array.from({ length: 15 }, (_, i) => `建议${i}`);

    const ctx = {
      data: { debouncedSuggestions: [] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    // 模拟 observer 逻辑
    config.observers.suggestions.call(ctx, longSuggestions);

    expect(ctx.data.debouncedSuggestions).toHaveLength(8);
    expect(ctx.data.debouncedSuggestions).toEqual(longSuggestions.slice(0, 8));
  });

  it('clears history correctly', () => {
    const config = loadComponent();

    const ctx = {
      data: { searchHistory: ['A', 'B', 'C'] },
      setData(update) {
        this.data = { ...this.data, ...update };
      },
    };

    config.methods.handleClearHistory.call(ctx);

    expect(global.wx.removeStorageSync).toHaveBeenCalledWith('smart_search_history');
    expect(ctx.data.searchHistory).toEqual([]);
  });
});
