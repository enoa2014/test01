const components = require('./data/components.js');

Page({
  data: {
    components,
    activeId: components.length ? components[0].id : '',
    current: components.length ? components[0] : {},
    propsState: components.length ? { ...components[0].defaultProps } : {},
    optionIndexes: components.length ? buildOptionIndexes(components[0]) : {},
    toggles: components.length ? buildToggleState(components[0]) : {}
  },

  onLoad(options) {
    if (!components.length) {
      return;
    }
    const { id } = options || {};
    const initial = components.find((item) => item.id === id) || components[0];
    this._setCurrent(initial);
  },

  handleSelect(event) {
    const { id } = event.currentTarget.dataset;
    const target = components.find((item) => item.id === id);
    if (target) {
      this._setCurrent(target);
    }
  },

  handleOptionChange(event) {
    const { key } = event.currentTarget.dataset;
    const values = this.data.current?.options?.[key]?.values || [];
    const index = Number(event.detail.value);
    const next = values[index] ?? values[0] ?? '';
    const optionIndexes = { ...this.data.optionIndexes, [key]: index };
    this.setData({
      optionIndexes,
      [`propsState.${key}`]: next
    });
  },

  handleToggle(event) {
    const { prop } = event.currentTarget.dataset;
    const next = !this.data.propsState[prop];
    this.setData({
      [`propsState.${prop}`]: next
    });
  },

  handleTextInput(event) {
    const { key = 'text' } = event.currentTarget.dataset;
    this.setData({
      [`propsState.${key}`]: event.detail.value || ''
    });
  },

  handleDemoTap() {
    if (typeof wx?.showToast === 'function') {
      wx.showToast({ title: '演示点击', icon: 'none' });
    }
  },

  handleInputChange(event) {
    const { value } = event.detail || {};
    this.setData({
      'propsState.value': value
    });
  },

  _setCurrent(target) {
    const defaultProps = { ...target.defaultProps } || {};
    const optionIndexes = buildOptionIndexes(target, defaultProps);
    const toggles = buildToggleState(target, defaultProps);
    this.setData({
      activeId: target.id,
      current: target,
      propsState: defaultProps,
      optionIndexes,
      toggles
    });
  }
});

function buildOptionIndexes(component, props = {}) {
  const indexes = {};
  const options = component.options || {};
  Object.keys(options).forEach((key) => {
    const values = options[key]?.values || [];
    const currentValue = props[key];
    const position = values.indexOf(currentValue);
    indexes[key] = position >= 0 ? position : 0;
  });
  return indexes;
}

function buildToggleState(component, props = {}) {
  const toggles = {};
  const toggleKeys = component.toggles || [];
  toggleKeys.forEach((key) => {
    toggles[key] = Boolean(props[key]);
  });
  return toggles;
}
