Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    type: {
      type: String,
      value: 'default',
    },
    size: {
      type: String,
      value: 'medium',
    },
    loading: {
      type: Boolean,
      value: false,
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    text: {
      type: String,
      value: '按钮',
    },
    block: {
      type: Boolean,
      value: false,
    },
    ghost: {
      type: Boolean,
      value: false,
    },
    useSlot: {
      type: Boolean,
      value: false,
    },
    icon: {
      type: String,
      value: '',
    },
    iconPosition: {
      type: String,
      value: 'left',
    },
    elevated: {
      type: Boolean,
      value: false,
    },
    iconOnly: {
      type: Boolean,
      value: false,
    },
    ariaLabel: {
      type: String,
      value: '',
    },
  },
  data: {
    rippleActive: false,
  },
  lifetimes: {
    detached() {
      if (this.rippleTimer) {
        clearTimeout(this.rippleTimer);
        this.rippleTimer = null;
      }
    },
  },
  methods: {
    handleTouchStart() {
      if (this.data.disabled || this.data.loading) {
        return;
      }
      if (this.rippleTimer) {
        clearTimeout(this.rippleTimer);
        this.rippleTimer = null;
      }
      this.setData({ rippleActive: true });
      this.rippleTimer = setTimeout(() => {
        this.setData({ rippleActive: false });
        this.rippleTimer = null;
      }, 350);
    },
    handleTap(event) {
      if (this.data.disabled || this.data.loading) {
        return;
      }
      if (event && typeof event.stopPropagation === 'function') {
        event.stopPropagation();
      }
      this.triggerEvent('tap');
    },
  },
});
