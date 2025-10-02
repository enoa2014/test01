# SmartSearchBar 组件结构规划

## 目录结构
```
miniprogram/components/business/smart-search-bar/
├── index.js
├── index.json
├── index.wxml
├── index.wxss
└── README.md
```

## 属性接口建议
```javascript
properties: {
  value: { type: String, value: '' },
  placeholder: { type: String, value: '搜索患者姓名/病历号/诊断标签' },
  suggestions: { type: Array, value: [] },
  filters: { type: Array, value: [] },
  loading: { type: Boolean, value: false },
  historyEnabled: { type: Boolean, value: true }
}
```

## 事件约定
- `input`: 输入变化，`detail.value`
- `search`: 提交搜索，`detail.value`
- `clear`: 清除输入
- `suggestiontap`: 点击建议项
- `filtertap`: 点击快捷筛选项
- `toggleadv`: 打开高级筛选入口

## 状态流
- 内部维护 `searchHistory`（最多 10 条）。
- 防抖在父页面实现，组件仅抛出输入事件。
