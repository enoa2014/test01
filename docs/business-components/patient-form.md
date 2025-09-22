# PatientForm 业务组件规范

## 组件简介
PatientForm 负责收集和编辑患者档案数据，支持新建、编辑、查看三种模式，可按模块折叠并提供实时校验与草稿保存。

## 模块划分
1. 基本信息：姓名、性别、出生日期、证件类型与号码。
2. 联系方式：联系电话、邮箱、微信号、通讯地址。
3. 医疗信息：主要诊断、主治医生、就诊医院、医保类型、过敏史。
4. 入住信息：入住批次、床位、服务计划、志愿者需求。
5. 财务信息：费用估算、资助类型、支付状态、优惠记录。
6. 紧急联系人：姓名、关系、电话、是否授权。
7. 附件信息：证件照、诊断证明、同意书等（引用附件组件）。

## 属性
| 属性 | 类型 | 默认值 | 必填 | 说明 |
|------|------|--------|------|------|
| `value` | Object | `{}` | 否 | 表单当前值（受控模式） |
| `mode` | String | `create` | 否 | `create` / `edit` / `view` |
| `schema` | Object | 默认 schema | 否 | 字段配置，可动态拓展或简化 |
| `dirtyFields` | Array | `[]` | 否 | 已修改字段集合（高亮显示） |
| `loading` | Boolean | `false` | 否 | 是否处于加载状态 |
| `readOnlySections` | Array | `[]` | 否 | 指定只读模块 |
| `autosaveInterval` | Number | `0` | 否 | 自动保存间隔，单位毫秒，0 表示关闭 |
| `submitText` | String | `提交` | 否 | 自定义提交按钮文案 |
| `showSectionSummary` | Boolean | `true` | 否 | 是否展示模块折叠概览 |

## 事件
| 事件名 | 参数 | 说明 |
|--------|------|------|
| `bind:change` | `{ value, changedFields }` | 字段值变更（节流 500ms） |
| `bind:submit` | `{ value, isValid }` | 点击提交按钮；若未通过校验 `isValid=false` |
| `bind:validate` | `{ errors }` | 校验结果变化 |
| `bind:autosave` | `{ value, timestamp }` | 自动保存触发 |
| `bind:sectiontoggle` | `{ sectionId, expanded }` | 折叠面板变化 |

## 校验规则
- 证件号使用正则校验 + 后端验证，错误时提示“与国家身份信息不一致”。
- 联系电话支持座机与手机号，自动格式化显示。
- 医疗信息中诊断与主治医生不得为空。
- 入住信息中床位与入住日期在编辑模式必填。
- 附件最少需上传身份证与诊断证明各一份。
- 当 `value.status === 'discharged'` 时，不允许修改入住/财务模块。

## 自动保存
- 当 `autosaveInterval > 0` 时，在变更后等待 `autosaveInterval` ms 无进一步输入触发；调用 `/api/patients/:id/draft`。
- 保存失败时显示 Toast，并在顶部显示“自动保存失败，请手动保存”。

## 与后端 API 对接
| 操作 | API | 说明 |
|------|-----|------|
| 获取表单初始值 | `GET /api/patients/:id` | 编辑/查看模式 |
| 新建患者 | `POST /api/patients` | create 模式提交 |
| 更新患者 | `PUT /api/patients/:id` | edit 模式提交 |
| 自动保存 | `POST /api/patients/:id/draft` | 草稿 |
| 校验证件号 | `POST /api/patients/validate-idno` | 返回合法性与重复情况 |
| 上传附件 | `POST /api/patients/:id/files` | 内部引用 Upload 服务 |

## 无障碍要求
- 使用表单语义标签，`label` 与 `input` 通过 `for` / `id` 关联。
- 校验错误通过红色提示 + `aria-describedby` 关联说明。
- Tab 顺序按照表单模块顺序排列；使用快捷键 `Ctrl+Alt+数字` 在模块间跳转。

## 性能要求
- 组件需按模块懒加载（折叠的模块在展开时渲染）。
- 表单字段数量较多时，需使用虚拟滚动或分页加载以保证流畅度。
- 自动保存采用节流与防抖组合，避免频繁请求。

## 测试清单
- 不同模式（create/edit/view）。
- 自动保存成功与失败处理。
- 校验规则，包括极端数据（超长文本、非法字符）。
- 附件上传：成功、超时、权限不足。
- 模块折叠/展开状态保持。

## 版本记录
| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-09-22 | 首次定义组件规范 |
