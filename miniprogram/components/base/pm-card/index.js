Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },
  properties: {
    title: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    status: {
      type: String,
      value: 'default'
    },
    clickable: {
      type: Boolean,
      value: false
    },
    useSlot: {
      type: Boolean,
      value: false
    },
    useHeaderSlot: {
      type: Boolean,
      value: false
    },
    useFooterSlot: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    handleTap() {
      if (!this.data.clickable) {
        return;
      }
      this.triggerEvent('tap');
    }
  }
});
