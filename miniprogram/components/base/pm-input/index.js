const VALID_SIZES = ['small', 'medium', 'large'];
const VALID_TYPES = ['text', 'number', 'digit', 'idcard', 'textarea'];
const VALID_LABEL_POSITIONS = ['top', 'left'];

Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    label: {
      type: String,
      value: '',
    },
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '请输入',
    },
    type: {
      type: String,
      value: 'text',
    },
    maxlength: {
      type: Number,
      value: -1,
    },
    size: {
      type: String,
      value: 'medium',
    },
    block: {
      type: Boolean,
      value: true,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    required: {
      type: Boolean,
      value: false,
    },
    clearable: {
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
    labelPosition: {
      type: String,
      value: 'top',
    },
    usePrefixSlot: {
      type: Boolean,
      value: false,
    },
    useSuffixSlot: {
      type: Boolean,
      value: false,
    },
    prefixIcon: {
      type: String,
      value: '',
    },
    suffixIcon: {
      type: String,
      value: '',
    },
    textareaAutoHeight: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    rootClass: 'pm-input--size-medium pm-input--layout-top pm-input--block',
    controlClass: 'pm-input__control',
    showClear: false,
    hasPrefix: false,
    hasSuffix: false,
    isTextarea: false,
    datasetKey: '',
    datasetField: '',
  },
  lifetimes: {
    attached() {
      const { key = '', field = '' } = this.dataset || {};
      if (key || field) {
        this.setData({ datasetKey: key, datasetField: field });
      }
      this._applyRootClasses(
        this.data.size,
        this.data.labelPosition,
        this.data.block,
        this.data.disabled,
        this.data.error,
        this.data.usePrefixSlot,
        this.data.useSuffixSlot,
        this.data.prefixIcon,
        this.data.suffixIcon,
        this.data.type
      );
      this._applyControlClasses(this.data.disabled, this.data.error, this.data.type);
      this._updateClearVisibility(this.data.value, this.data.clearable, this.data.disabled);
    },
  },
  observers: {
    'size,labelPosition,block,disabled,error,usePrefixSlot,useSuffixSlot,prefixIcon,suffixIcon,type':
      function observer(
        size,
        labelPosition,
        block,
        disabled,
        error,
        usePrefixSlot,
        useSuffixSlot,
        prefixIcon,
        suffixIcon,
        type
      ) {
        this._applyRootClasses(
          size,
          labelPosition,
          block,
          disabled,
          error,
          usePrefixSlot,
          useSuffixSlot,
          prefixIcon,
          suffixIcon,
          type
        );
        this._applyControlClasses(disabled, error, type);
      },
    'disabled,error': function observerControl(disabled, error) {
      this._applyControlClasses(disabled, error, this.data.type);
    },
    'value,clearable,disabled': function observerValue(value, clearable, disabled) {
      this._updateClearVisibility(value, clearable, disabled);
    },
    type(type) {
      if (!VALID_TYPES.includes(type)) {
        this.setData({ type: 'text' });
      }
    },
    error(newVal) {
      if (newVal == null) {
        this.setData({ error: '' });
      }
    },
    helper(newVal) {
      if (newVal == null) {
        this.setData({ helper: '' });
      }
    },
    hint(newVal) {
      if (newVal == null) {
        this.setData({ hint: '' });
      }
    },
  },
  methods: {
    handleInput(event) {
      const { value = '' } = event.detail || {};
      this._updateClearVisibility(value, this.data.clearable, this.data.disabled);
      this.triggerEvent('input', { value });
    },
    handleChange(event) {
      const { value = '' } = event.detail || {};
      this.triggerEvent('change', { value });
    },
    handleBlur(event) {
      const { value = '' } = event.detail || {};
      this._updateClearVisibility(value, this.data.clearable, this.data.disabled);
      this.triggerEvent('blur', { value });
      if (this.data.type === 'textarea') {
        this.triggerEvent('change', { value });
      }
    },
    handleFocus(event) {
      const { value = '' } = event.detail || {};
      this.triggerEvent('focus', { value });
    },
    handleClear() {
      if (!this.data.clearable || this.data.disabled) {
        return;
      }
      this._updateClearVisibility('', this.data.clearable, this.data.disabled);
      this.triggerEvent('input', { value: '' });
      this.triggerEvent('change', { value: '' });
      this.triggerEvent('clear');
    },
    _applyRootClasses(
      size,
      labelPosition,
      block,
      disabled,
      error,
      usePrefixSlot,
      useSuffixSlot,
      prefixIcon,
      suffixIcon,
      type
    ) {
      const safeSize = VALID_SIZES.includes(size) ? size : 'medium';
      const safeLabelPosition = VALID_LABEL_POSITIONS.includes(labelPosition)
        ? labelPosition
        : 'top';
      const classes = [`pm-input--size-${safeSize}`, `pm-input--layout-${safeLabelPosition}`];

      if (block) {
        classes.push('pm-input--block');
      }
      if (disabled) {
        classes.push('pm-input--disabled');
      }
      if (error) {
        classes.push('pm-input--error');
      }

      const isTextarea = type === 'textarea';
      if (isTextarea) {
        classes.push('pm-input--textarea');
      }

      const hasPrefix = Boolean(usePrefixSlot || prefixIcon);
      const hasSuffix = Boolean(useSuffixSlot || suffixIcon);
      if (hasPrefix) {
        classes.push('pm-input--has-prefix');
      }
      if (hasSuffix) {
        classes.push('pm-input--has-suffix');
      }

      this.setData({
        rootClass: classes.join(' '),
        hasPrefix,
        hasSuffix,
        isTextarea,
      });
    },
    _applyControlClasses(disabled, error, type) {
      const classes = ['pm-input__control'];
      if (disabled) {
        classes.push('pm-input__control--disabled');
      }
      if (error) {
        classes.push('pm-input__control--error');
      }
      if (type === 'textarea') {
        classes.push('pm-input__control--textarea');
      }
      this.setData({ controlClass: classes.join(' ') });
    },
    _updateClearVisibility(value, clearable, disabled) {
      const showClear = Boolean(clearable && !disabled && value);
      this.setData({ showClear });
    },
  },
});
