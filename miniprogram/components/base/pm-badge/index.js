const MAX_COUNT = 99;

Component({
  options: {
    addGlobalClass: true,
  },
  properties: {
    text: {
      type: String,
      value: '',
    },
    count: {
      type: null,
      value: '',
    },
    max: {
      type: Number,
      value: MAX_COUNT,
    },
    type: {
      type: String,
      value: 'primary',
    },
    variant: {
      type: String,
      value: 'soft', // solid | soft | outline
    },
    size: {
      type: String,
      value: 'medium',
    },
    dotted: {
      type: Boolean,
      value: false,
    },
    block: {
      type: Boolean,
      value: false,
    },
    useSlot: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    styleType: 'primary',
    styleVariant: 'soft',
    displayCount: '',
  },
  observers: {
    type(newType) {
      this.setData({ styleType: this._normalizeType(newType) });
    },
    variant(newVariant) {
      this.setData({ styleVariant: this._normalizeVariant(newVariant) });
    },
    count() {
      this._syncCount();
    },
    max() {
      this._syncCount();
    },
  },
  lifetimes: {
    attached() {
      this.setData({
        styleType: this._normalizeType(this.data.type),
        styleVariant: this._normalizeVariant(this.data.variant),
      });
      this._syncCount();
    },
  },
  methods: {
    _normalizeType(type) {
      const map = {
        default: 'secondary',
        info: 'secondary',
      };
      const normalized = (type && String(type).toLowerCase()) || 'primary';
      const mapped = map[normalized] || normalized;
      const allowed = ['primary', 'success', 'warning', 'danger', 'secondary'];
      return allowed.includes(mapped) ? mapped : 'primary';
    },
    _normalizeVariant(variant) {
      const v = (variant && String(variant).toLowerCase()) || 'soft';
      const allowed = ['solid', 'soft', 'outline'];
      return allowed.includes(v) ? v : 'soft';
    },
    _syncCount() {
      const { count, max } = this.data;
      if (count === '' || count === null || count === undefined) {
        this.setData({ displayCount: '' });
        return;
      }
      const numeric = Number(count);
      if (Number.isNaN(numeric)) {
        this.setData({ displayCount: String(count) });
        return;
      }
      if (numeric > max) {
        this.setData({ displayCount: `${max}+` });
      } else {
        this.setData({ displayCount: String(numeric) });
      }
    },
  },
});
