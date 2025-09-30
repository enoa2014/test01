Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    type: {
      type: String,
      value: 'default'
    },
    size: {
      type: String,
      value: 'medium'
    },
    loading: {
      type: Boolean,
      value: false
    },
    disabled: {
      type: Boolean,
      value: false
    },
    text: {
      type: String,
      value: '按钮'
    },
    block: {
      type: Boolean,
      value: false
    },
    ghost: {
      type: Boolean,
      value: false
    },
    useSlot: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleTap() {
      if (this.data.disabled || this.data.loading) {
        return;
      }
      this.triggerEvent('tap');
    }
  }
});
