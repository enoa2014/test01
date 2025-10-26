# SmartSearchBar 业务组件规范

## 组件简介

SmartSearchBar 为患者管理系统提供智能搜索入口，支持关键词、标签、语音、扫码等多种输入方式，并结合推荐算法提供即时提示。

## 功能要点

- 实时搜索（300ms 防抖）
- 搜索建议（历史、常用、热门）
- 高级筛选入口（打开 FilterPanel）
- 扫码/语音搜索（移动端）
- 搜索条件持久化（最近使用）

## 属性

| 属性             | 类型    | 默认值                     | 必填 | 说明               |
| ---------------- | ------- | -------------------------- | ---- | ------------------ |
| `value`          | String  | `''`                       | 否   | 当前搜索词（受控） |
| `placeholder`    | String  | `搜索患者姓名/病历号/标签` | 否   | 占位文案           |
| `suggestions`    | Array   | `[]`                       | 否   | 外部传入的建议数据 |
| `historyEnabled` | Boolean | `true`                     | 否   | 是否展示历史记录   |
| `scanEnabled`    | Boolean | `false`                    | 否   | 是否开启扫码入口   |
| `voiceEnabled`   | Boolean | `false`                    | 否   | 是否开启语音入口   |
| `filters`        | Array   | `[]`                       | 否   | 快捷筛选（chips）  |
| `loading`        | Boolean | `false`                    | 否   | 是否显示加载动画   |
| `error`          | String  | `''`                       | 否   | 错误提示信息       |

## 事件

| 事件名              | 参数                | 说明                                                               |
| ------------------- | ------------------- | ------------------------------------------------------------------ |
| `bind:input`        | `{ value }`         | 用户输入（节流 300ms）                                             |
| `bind:search`       | `{ value, source }` | 触发搜索，`source` 包含 `enter/chip/history/suggestion/scan/voice` |
| `bind:clear`        | 无                  | 点击清除按钮                                                       |
| `bind:filtertap`    | `{ filter }`        | 点击快捷筛选                                                       |
| `bind:toggleadv`    | 无                  | 打开高级筛选面板                                                   |
| `bind:historyclear` | 无                  | 清空历史记录                                                       |

## 搜索流程

1. 输入变化 → 组件触发 `bind:input`
2. 上层调用 `/api/search/patients?keyword=xxx`（详见 API 文档），返回结果与推荐
3. 组件根据 `loading` / `suggestions` 渲染实时列表
4. 用户可通过键盘上下键选择建议，回车触发 `bind:search`
5. 搜索成功后，将关键字写入 `/api/search/history` 或本地存储

## 接口依赖

| API                           | 用途     | 备注                           |
| ----------------------------- | -------- | ------------------------------ |
| `GET /api/search/patients`    | 实时搜索 | 支持分页、模糊匹配、多字段权重 |
| `GET /api/search/suggestions` | 推荐词   | 返回热门、智能推荐             |
| `GET /api/search/history`     | 历史记录 | 最近 10 条                     |
| `POST /api/search/history`    | 写入历史 | 成功后刷新列表                 |
| `DELETE /api/search/history`  | 清空历史 | 级联删除                       |

## UI 交互

- 输入框右侧显示操作图标：高级筛选、扫码/语音、清除。
- 建议列表按“推荐 > 历史 > 热门”排序，分类标题悬浮。
- 若 `error` 非空，显示红色提示条，并提供“重试”按钮。
- 键盘操作：`Enter` 搜索、`Esc` 清除、`Down/Up` 选择建议。

## 无障碍

- 输入框添加 `aria-autocomplete="list"`。
- 建议列表使用 `role="listbox"`，每项使用 `role="option"`。
- 清除按钮添加 `aria-label="清除搜索内容"`。

## 性能

- 使用 300ms 防抖 + 500ms 超时，避免过多请求。
- 建议列表最多展示 8 条，超出滚动。
- 历史/推荐在组件挂载时并行请求。

## 测试要点

- 输入与节流：验证在快速输入时仅触发有限次数的 API。
- 建议列表渲染：不同来源分类是否正确。
- 搜索事件：各 `source` 类型是否准确。
- 错误处理：超时或 500 返回时是否显示提示。
- 键盘和触控操作：上下键、Enter、Esc、点击建议。

## 版本记录

| 版本  | 日期       | 说明         |
| ----- | ---------- | ------------ |
| 1.0.0 | 2025-09-22 | 首次定义规范 |
