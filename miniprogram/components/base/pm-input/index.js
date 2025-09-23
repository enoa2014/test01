Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    label: {
      type: String,
      value: ''
    },
    value: {
      type: String,
      value: ''
    },
    placeholder: {
      type: String,
      value: '请输入'
    },
    type: {
      type: String,
      value: 'text'
    },
    disabled: {
      type: Boolean,
      value: false
    },
    clearable: {
      type: Boolean,
      value: true
    }
  },
  methods: {
    handleInput(event) {
      const { value } = event.detail || {};
      this.triggerEvent('change', value);
    },
    handleBlur(event) {
      const { value } = event.detail || {};
      this.triggerEvent('blur', value);
    },
    handleClear() {
      if (!this.data.clearable || this.data.disabled) {
        return;
      }
      this.triggerEvent('change', '');
    }
  }
});
