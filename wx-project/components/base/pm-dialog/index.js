Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true,
  },
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '',
    },
    content: {
      type: String,
      value: '',
    },
    confirmText: {
      type: String,
      value: '确定',
    },
    cancelText: {
      type: String,
      value: '取消',
    },
    confirmType: {
      type: String,
      value: 'primary',
    },
    cancelType: {
      type: String,
      value: 'ghost',
    },
    showClose: {
      type: Boolean,
      value: true,
    },
    closeOnOverlay: {
      type: Boolean,
      value: true,
    },
    maskClosable: {
      type: Boolean,
      value: true,
    },
    scrollable: {
      type: Boolean,
      value: false,
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
    closeOnConfirm: {
      type: Boolean,
      value: true,
    },
    closeOnCancel: {
      type: Boolean,
      value: true,
    },
  },
  data: {
    showHeader: false,
    showFooter: false,
    showCancel: true,
    showConfirm: true,
    hasButtons: true,
  },
  observers: {
    'title, useHeaderSlot': function observer(title, useHeaderSlot) {
      this.setData({ showHeader: Boolean(useHeaderSlot || title) });
    },
    'useFooterSlot, cancelText, confirmText': function observerFooter(
      useFooterSlot,
      cancelText,
      confirmText
    ) {
      const showCancel = Boolean(cancelText);
      const showConfirm = Boolean(confirmText);
      const hasButtons = showCancel || showConfirm;
      this.setData({
        showFooter: Boolean(useFooterSlot || hasButtons),
        hasButtons,
        showCancel,
        showConfirm,
      });
    },
  },
  methods: {
    noop() {},
    handleOverlayTap() {
      const closable = this.data.closeOnOverlay !== false && this.data.maskClosable !== false;
      if (!closable) {
        return;
      }
      this._emitClose();
    },
    handleClose() {
      this._emitClose();
    },
    handleCancel() {
      this.triggerEvent('cancel');
      if (this.data.closeOnCancel !== false) {
        this._emitClose();
      }
    },
    handleConfirm() {
      this.triggerEvent('confirm');
      if (this.data.closeOnConfirm !== false) {
        this._emitClose();
      }
    },
    _emitClose() {
      this.triggerEvent('close');
    },
  },
});
