const normalizeOptions = (list = []) => {
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(item => ({
    label: item && item.label != null ? String(item.label) : '',
    value: item ? item.value : '',
    description: item && item.description ? String(item.description) : '',
    disabled: Boolean(item && item.disabled),
  }));
};

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    value: {
      type: null,
      value: '',
    },
    options: {
      type: Array,
      value: [],
    },
    placeholder: {
      type: String,
      value: '请选择',
    },
    multiple: {
      type: Boolean,
      value: false,
    },
    searchable: {
      type: Boolean,
      value: false,
    },
    clearable: {
      type: Boolean,
      value: true,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    label: {
      type: String,
      value: '',
    },
    labelPosition: {
      type: String,
      value: 'top',
    },
    block: {
      type: Boolean,
      value: true,
    },
    helper: {
      type: String,
      value: '',
    },
    error: {
      type: String,
      value: '',
    },
    hint: {
      type: String,
      value: '',
    },
    dropdownPlacement: {
      type: String,
      value: 'auto',
    },
    maxTagCount: {
      type: Number,
      value: 3,
    },
    closeOnOverlay: {
      type: Boolean,
      value: true,
    },
    maskClosable: {
      type: Boolean,
      value: true,
    },
    required: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    opened: false,
    keyword: '',
    internalValue: [],
    filteredOptions: [],
    displayLabel: '',
    displayTags: [],
    extraTagCount: 0,
    hasSelection: false,
    panelTitle: '请选择',
  },
  observers: {
    options(newOptions) {
      this._setOptionsCache(newOptions);
      this.setData({
        filteredOptions: this._computeFilteredOptions(this.data.keyword),
      });
      this._syncFromValue(this.data.value, newOptions);
    },
    value(newValue) {
      this._syncFromValue(newValue, this.data.options);
    },
    label(newLabel) {
      this.setData({ panelTitle: newLabel || '请选择' });
    },
  },
  lifetimes: {
    attached() {
      this._setOptionsCache(this.data.options);
      this._syncFromValue(this.data.value, this.data.options);
      this.setData({
        filteredOptions: this._computeFilteredOptions(''),
        panelTitle: this.data.label || '请选择',
      });
    },
  },
  methods: {
    noop() {},
    handleControlTap() {
      if (this.data.disabled || this.data.loading) {
        return;
      }
      this.setData({ opened: true, keyword: '' });
      this.triggerEvent('open');
      this._refreshFilteredOptions('');
    },
    handleOverlayTap() {
      const closable = this.data.closeOnOverlay !== false && this.data.maskClosable !== false;
      if (!closable) {
        return;
      }
      this.handleCancel();
    },
    handleCancel() {
      this.setData({ opened: false, keyword: '' });
      this.triggerEvent('close');
      this._refreshFilteredOptions('');
    },
    handleConfirm() {
      const { multiple, internalValue } = this.data;
      const options = this._optionsCache || [];
      const resolvedValue = multiple ? internalValue.slice() : internalValue[0] || '';
      const selectedOptions = options.filter(item =>
        multiple ? internalValue.includes(item.value) : item.value === resolvedValue
      );
      this.triggerEvent('change', {
        value: resolvedValue,
        selectedOptions,
      });
      this.setData({ opened: false, keyword: '' });
      this.triggerEvent('close');
    },
    handleOptionTap(event) {
      const { value, disabled } = event.currentTarget.dataset;
      if (disabled) {
        return;
      }
      if (this.data.multiple) {
        const internal = this.data.internalValue.slice();
        const idx = internal.indexOf(value);
        if (idx >= 0) {
          internal.splice(idx, 1);
        } else {
          internal.push(value);
        }
        this.setData({ internalValue: internal });
        this._updateActiveStates(internal);
      } else {
        this.setData({ internalValue: [value] });
        this._updateActiveStates([value]);
        this.handleConfirm();
      }
    },
    handleClear(event) {
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      if (this.data.disabled) {
        return;
      }
      const cleared = this.data.multiple ? [] : '';
      this.triggerEvent('clear');
      this.triggerEvent('change', { value: cleared, selectedOptions: [] });
      this.setData({
        internalValue: [],
        hasSelection: false,
        displayLabel: '',
        displayTags: [],
        extraTagCount: 0,
      });
    },
    handleSearch(event) {
      const keyword = (event.detail.value || '').trim();
      this.setData({ keyword });
      this._refreshFilteredOptions(keyword);
      this.triggerEvent('search', { keyword });
    },
    _refreshFilteredOptions(keyword) {
      const filtered = this._computeFilteredOptions(keyword);
      this.setData({ filteredOptions: filtered });
      this._updateActiveStates(this.data.internalValue, filtered);
    },
    _computeFilteredOptions(keyword) {
      const normalized = this._optionsCache || [];
      if (!keyword) {
        return normalized.map(item => ({ ...item, active: false }));
      }
      const lower = keyword.toLowerCase();
      return normalized
        .filter(item => item.label.toLowerCase().includes(lower))
        .map(item => ({ ...item, active: false }));
    },
    _syncFromValue(rawValue, optionSource) {
      this._setOptionsCache(optionSource);
      const options = this._optionsCache || [];
      const multiple = this.data.multiple;
      let normalizedValue = [];
      if (multiple) {
        if (Array.isArray(rawValue)) {
          normalizedValue = rawValue.slice();
        } else if (rawValue != null && rawValue !== '') {
          normalizedValue = [rawValue];
        }
      } else if (rawValue != null && rawValue !== '') {
        normalizedValue = [rawValue];
      }
      const activeOptions = options.filter(item => normalizedValue.includes(item.value));
      const displayLabel = !multiple && activeOptions.length ? activeOptions[0].label : '';
      const displayTags = multiple ? activeOptions.map(item => item.label) : [];
      const extraTagCount =
        multiple && displayTags.length > this.data.maxTagCount
          ? displayTags.length - this.data.maxTagCount
          : 0;
      const trimmedTags = multiple ? displayTags.slice(0, this.data.maxTagCount) : [];
      const hasSelection = multiple ? normalizedValue.length > 0 : Boolean(displayLabel);
      this.setData({
        internalValue: normalizedValue,
        displayLabel,
        displayTags: trimmedTags,
        extraTagCount,
        hasSelection,
      });
      this._updateActiveStates(normalizedValue);
    },
    _updateActiveStates(currentValues, filtered = this.data.filteredOptions) {
      const activeSet = new Set(currentValues);
      const next = filtered.map(item => ({ ...item, active: activeSet.has(item.value) }));
      this.setData({ filteredOptions: next });
    },
    _setOptionsCache(optionSource) {
      this._optionsCache = normalizeOptions(optionSource);
    },
  },
});
