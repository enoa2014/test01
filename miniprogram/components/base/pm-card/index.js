const VALID_VARIANTS = ['default', 'outlined', 'elevated'];
const VALID_STATUSES = ['default', 'success', 'warning', 'danger', 'info'];

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    title: {
      type: String,
      value: '',
    },
    description: {
      type: String,
      value: '',
    },
    status: {
      type: String,
      value: 'default',
    },
    variant: {
      type: String,
      value: 'default',
    },
    clickable: {
      type: Boolean,
      value: false,
    },
    padding: {
      type: String,
      value: '',
    },
    useSlot: {
      type: Boolean,
      value: false,
    },
    useHeaderSlot: {
      type: Boolean,
      value: false,
    },
    useFooterSlot: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    cardClass: 'pm-card--variant-default',
    hoverClass: '',
    cardStyle: '--pm-card-padding: var(--space-5);',
    normalizedStatus: '',
    hasStatusAccent: false,
  },
  lifetimes: {
    attached() {
      this._applyClasses(this.data.variant, this.data.status, this.data.clickable);
      this._applyPadding(this.data.padding);
    },
  },
  observers: {
    'variant,status,clickable': function observer(variant, status, clickable) {
      this._applyClasses(variant, status, clickable);
    },
    padding(padding) {
      this._applyPadding(padding);
    },
  },
  methods: {
    handleTap() {
      if (!this.data.clickable) {
        return;
      }
      this.triggerEvent('tap');
    },
    _applyClasses(variant, status, clickable) {
      const safeVariant = VALID_VARIANTS.includes(variant) ? variant : 'default';
      let normalizedStatus = VALID_STATUSES.includes(status) ? status : '';
      if (normalizedStatus === 'default') {
        normalizedStatus = '';
      }

      const classes = [`pm-card--variant-${safeVariant}`];
      if (normalizedStatus) {
        classes.push(`pm-card--status-${normalizedStatus}`);
      }
      if (clickable) {
        classes.push('pm-card--interactive');
      }

      this.setData({
        cardClass: classes.join(' '),
        hoverClass: clickable ? 'pm-card--hover' : '',
        normalizedStatus,
        hasStatusAccent: Boolean(normalizedStatus),
      });
    },
    _applyPadding(padding) {
      const value =
        typeof padding === 'string' && padding.trim() ? padding.trim() : 'var(--space-5)';
      this.setData({
        cardStyle: `--pm-card-padding: ${value};`,
      });
    },
  },
});
