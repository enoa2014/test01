module.exports = [
  {
    id: 'pm-button',
    name: 'PM Button',
    category: 'Base',
    componentPath: '/components/base/pm-button/index',
    docs: '/docs/dev-environment/component-library.md#pm-button',
    defaultProps: {
      type: 'default',
      size: 'medium',
      loading: false,
      disabled: false,
      text: '按钮'
    },
    options: {
      type: { values: ['default', 'primary', 'secondary'] },
      size: { values: ['small', 'medium', 'large'] }
    },
    textFields: ['text']
  },
  {
    id: 'pm-input',
    name: 'PM Input',
    category: 'Base',
    componentPath: '/components/base/pm-input/index',
    docs: '/docs/dev-environment/component-library.md#pm-input',
    defaultProps: {
      label: '姓名',
      value: '',
      placeholder: '请输入患者姓名',
      type: 'text',
      disabled: false,
      clearable: true
    },
    options: {
      type: { values: ['text', 'number', 'idcard'] }
    },
    textFields: ['label', 'placeholder', 'value'],
    toggles: ['disabled', 'clearable']
  },
  {
    id: 'pm-card',
    name: 'PM Card',
    category: 'Base',
    componentPath: '/components/base/pm-card/index',
    docs: '/docs/dev-environment/component-library.md#pm-card',
    defaultProps: {
      title: '患者提醒',
      description: '今日需跟踪患者家庭情况并更新护理记录。',
      status: 'default',
      clickable: true
    },
    options: {
      status: { values: ['default', 'success', 'warning'] }
    },
    textFields: ['title', 'description'],
    toggles: ['clickable']
  }
];
