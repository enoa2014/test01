# Component Lab 预设与交互说明（2025-10）

本文件记录 Component Lab 中已接入的基础组件示例，便于研发与 QA 快速对照演示场景，并规划自动化覆盖范围。

## 1. 组件列表

| 组件 ID   | 预设数量 | 关键交互                                       | 备注                                 |
| --------- | -------- | ---------------------------------------------- | ------------------------------------ |
| pm-button | 7        | loading、ghost、icon、block、danger            | 均已在 Component Lab 演示            |
| pm-input  | 7        | 多行、前后缀、错误提示、禁用、大小切换         | 需手动测试 textarea 失焦 change 行为 |
| pm-card   | 7        | variant、status、slot header/footer、clickable | 媒体卡片场景与分析页 preset 对齐     |
| pm-picker | 3        | 单选、多选、搜索、禁用                         | 自动化验证选择/清除，后续补多选 E2E  |
| pm-dialog | 3        | 危险确认、信息提示、自定义 footer              | 自动化验证 confirm/cancel 行为       |
| pm-badge  | 3        | 数量角标、状态点、胶囊模式                     | 自动化验证 dotted/block 切换         |

## 2. 自动化覆盖

| 测试用例                                | 说明                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| `tests/e2e/component-lab.test.js`       | 覆盖 pm-picker 单选 + 清除、pm-dialog 确认、pm-badge 状态切换 |
| `tests/e2e/patient-detail-edit.test.js` | 间接验证 pm-input + pm-card 实际表单场景                      |

## 3. 后续建议

1. 为 pm-picker 增补多选 + 搜索组合的 E2E，用于验证 `maxTagCount` 及搜索回调。
2. Component Lab 新增「最佳实践」分组，将与 `docs/components/best-practices.md` 同步。
3. 引入截图对比（loki 等）以辅助 UI 变更回归。
