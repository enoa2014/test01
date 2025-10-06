const HISTORY_KEY = 'smart_search_history';
const MAX_HISTORY = 10;
const DEFAULT_DEBOUNCE = 300;
const MAX_SUGGESTIONS = 8;

function clearHistoryState(ctx) {
  const wxApi = typeof wx !== 'undefined' ? wx : undefined;
  try {
    if (wxApi && typeof wxApi.removeStorageSync === 'function') {
      wxApi.removeStorageSync(HISTORY_KEY);
    }
  } catch (error) {
    // ignore storage errors
  }
  if (ctx && typeof ctx.setData === 'function') {
    ctx.setData({ searchHistory: [] });
  }
  if (ctx && typeof ctx.triggerEvent === 'function') {
    ctx.triggerEvent('historyclear');
  }
}

Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '搜索住户姓名/档案号/诊断标签',
    },
    suggestions: {
      type: Array,
      value: [],
    },
    filters: {
      type: Array,
      value: [],
    },
    loading: {
      type: Boolean,
      value: false,
    },
    historyEnabled: {
      type: Boolean,
      value: true,
    },
    debounce: {
      type: Number,
      value: DEFAULT_DEBOUNCE,
    },
    // P1-1: 高级筛选激活状态
    hasActiveFilters: {
      type: Boolean,
      value: false,
    },
    activeFilterCount: {
      type: Number,
      value: 0,
    },
  },
  observers: {
    value(newVal) {
      const next = this.safeString(newVal);
      if (next !== this.data.internalValue) {
        this.setData({ internalValue: next });
      }
    },
    suggestions(newList) {
      if (Array.isArray(newList)) {
        this.setData({ debouncedSuggestions: newList.slice(0, MAX_SUGGESTIONS) });
      } else {
        this.setData({ debouncedSuggestions: [] });
      }
    },
  },
  data: {
    internalValue: '',
    searchHistory: [],
    debouncedSuggestions: [],
    debounceTimer: null,
  },
  lifetimes: {
    attached() {
      this.setData({ internalValue: this.safeString(this.properties.value) });
      this.loadHistory();
    },
    detached() {
      this.clearDebounce();
    },
  },
  methods: {
    safeString(value) {
      if (value === null || value === undefined) {
        return '';
      }
      return String(value).trim();
    },

    clearDebounce() {
      const { debounceTimer } = this.data;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        this.setData({ debounceTimer: null });
      }
    },

    emitInput(value) {
      this.triggerEvent('input', { value });
      this.triggerEvent('suggest', { value, source: 'input' });
    },

    handleInput(event) {
      const value = event.detail && event.detail.value ? event.detail.value : '';
      this.setData({ internalValue: value });
      this.clearDebounce();
      const duration = Number(this.data.debounce) || DEFAULT_DEBOUNCE;
      const timer = setTimeout(() => {
        this.emitInput(this.safeString(value));
        this.setData({ debounceTimer: null });
      }, duration);
      this.setData({ debounceTimer: timer });
    },

    handleClear() {
      this.clearDebounce();
      this.triggerEvent('clear');
      this.setData({ internalValue: '' });
      this.emitInput('');
    },

    handleConfirm(event) {
      const value = event.detail && event.detail.value ? event.detail.value : '';
      const cleaned = this.safeString(value);
      this.triggerEvent('search', { value: cleaned, source: 'confirm' });
      this.saveHistory(cleaned);
    },

    handleSearch() {
      const value = this.safeString(this.data.internalValue);
      this.clearDebounce();
      this.triggerEvent('search', { value, source: 'button' });
      this.saveHistory(value);
    },

    handleSuggestionTap(event) {
      const suggestion =
        (event.currentTarget &&
          event.currentTarget.dataset &&
          event.currentTarget.dataset.suggestion) ||
        '';
      const keyword = this.safeString(suggestion);
      if (!keyword) {
        return;
      }
      this.clearDebounce();
      this.setData({ internalValue: keyword });
      this.triggerEvent('search', { value: keyword, source: 'suggestion' });
      this.saveHistory(keyword);
    },

    handleFilterTap(event) {
      const filter =
        (event.currentTarget &&
          event.currentTarget.dataset &&
          event.currentTarget.dataset.filter) ||
        null;
      this.triggerEvent('filtertap', { filter });
    },

    handleToggleAdvanced() {
      this.triggerEvent('toggleadv');
    },

    handleHistoryTap(event) {
      const keyword =
        (event.currentTarget &&
          event.currentTarget.dataset &&
          event.currentTarget.dataset.keyword) ||
        '';
      const cleaned = this.safeString(keyword);
      if (!cleaned) {
        return;
      }
      this.clearDebounce();
      this.setData({ internalValue: cleaned });
      this.triggerEvent('search', { value: cleaned, source: 'history' });
      this.saveHistory(cleaned);
    },

    // P0-2: 清空历史增加二次确认
    handleClearHistory() {
      const wxApi = typeof wx !== 'undefined' ? wx : undefined;
      if (wxApi && typeof wxApi.showModal === 'function') {
        wxApi.showModal({
          title: '确认清空',
          content: '清空后搜索历史将无法恢复',
          confirmText: '清空',
          confirmColor: '#FF4D4F',
          success: res => {
            if (res && res.confirm) {
              clearHistoryState(this);
            }
          },
        });
        return;
      }
      clearHistoryState(this);
    },

    // P0-2: 执行清空历史
    clearAllHistory() {
      clearHistoryState(this);
    },

    // P0-2: 删除单个历史记录
    handleDeleteHistoryItem(event) {
      const keyword =
        (event.currentTarget &&
          event.currentTarget.dataset &&
          event.currentTarget.dataset.keyword) ||
        '';
      const cleaned = this.safeString(keyword);
      if (!cleaned) {
        return;
      }

      try {
        const wxApi = typeof wx !== 'undefined' ? wx : undefined;
        const history =
          wxApi && typeof wxApi.getStorageSync === 'function'
            ? wxApi.getStorageSync(HISTORY_KEY) || []
            : [];
        const filtered = Array.isArray(history) ? history.filter(item => item !== cleaned) : [];
        if (wxApi && typeof wxApi.setStorageSync === 'function') {
          wxApi.setStorageSync(HISTORY_KEY, filtered);
        }
        this.setData({ searchHistory: filtered });
      } catch (error) {
        // ignore storage errors
      }
    },

    loadHistory() {
      if (!this.data.historyEnabled) {
        return;
      }
      try {
        const wxApi = typeof wx !== 'undefined' ? wx : undefined;
        const history =
          wxApi && typeof wxApi.getStorageSync === 'function'
            ? wxApi.getStorageSync(HISTORY_KEY) || []
            : [];
        if (Array.isArray(history)) {
          this.setData({ searchHistory: history.slice(0, MAX_HISTORY) });
        }
      } catch (error) {
        // ignore storage errors
      }
    },

    saveHistory(keyword) {
      if (!this.data.historyEnabled) {
        return;
      }
      const cleaned = this.safeString(keyword);
      if (!cleaned) {
        return;
      }
      try {
        const wxApi = typeof wx !== 'undefined' ? wx : undefined;
        let history =
          wxApi && typeof wxApi.getStorageSync === 'function'
            ? wxApi.getStorageSync(HISTORY_KEY) || []
            : [];
        if (!Array.isArray(history)) {
          history = [];
        }
        history = [cleaned, ...history.filter(item => item !== cleaned)].slice(0, MAX_HISTORY);
        if (wxApi && typeof wxApi.setStorageSync === 'function') {
          wxApi.setStorageSync(HISTORY_KEY, history);
        }
        this.setData({ searchHistory: history });
      } catch (error) {
        // ignore storage errors
      }
    },
  },
});
