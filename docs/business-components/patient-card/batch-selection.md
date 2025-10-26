# PatientCard 批量选择需求概述

## 目标

- 支持在患者列表页进入批量选择模式，选择多个患者执行批量操作（提醒、导出等）。

## 切换机制

1. 长按任意患者卡片触发 `longpress` 事件。
2. 页面监听事件后进入 `batchMode = true` 状态：
   - 顶部显示批量操作栏（全选/清除/批量操作）。
   - 所有 `patient-card` 设置 `selectable="{{true}}`。
3. 点击“完成”或操作完成后退出批量模式。

## 组件交互

- `patient-card` 的 `selectchange` 事件返回 `{ selected, patient }`。
- 页面维护 `selectedPatientMap`，key 为 patientKey。
- 需要更新数据映射：
  ```js
  const key = item.patientKey || item.key;
  const selected = Boolean(selectedPatientMap[key]);
  badges.push({ text: selected ? '已选中' : '可选择', type: selected ? 'primary' : 'default' });
  ```

## 执行动作

- 批量提醒：调用 `patientReminder.notify(selectedPatients)`。
- 批量导出：触发导出接口并提示进度。

## TODO 调整建议

- [ ] 列表页：监听长按事件，进入 `batchMode`。
- [ ] 列表页：在批量模式下传入 `selectable`、`selected` 状态。
- [ ] 列表页：顶部显示批量操作工具栏。
- [ ] `TODO.md` 阶段 4.1 添加批量模式任务描述。
