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
    displayCount: '',
  },
  observers: {
    type(newType) {
      this.setData({ styleType: this._normalizeType(newType) });
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
      this.setData({ styleType: this._normalizeType(this.data.type) });
      this._syncCount();
    },
  },
  methods: {
    _normalizeType(type) {
      const allowed = ['primary', 'success', 'warning', 'danger', 'secondary'];
      return allowed.includes(type) ? type : 'primary';
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
