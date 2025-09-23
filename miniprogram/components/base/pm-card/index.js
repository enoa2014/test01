Component({
  options: {
    addGlobalClass: true
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
