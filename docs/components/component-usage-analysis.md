# 组件使用情况分析（2025-10 更新）

## 概要

| 组件      | 页面引用                                          | 备注/后续行动                                    |
| --------- | ------------------------------------------------- | ------------------------------------------------ |
| pm-button | `patient-intake/select`、`patient-intake/success` | 已推广，后续关注真机触摸反馈                     |
| pm-input  | `patient-detail/detail`（表单）                   | 已迁移；需回归编辑/验证流程                      |
| pm-card   | `analysis/index`、`patient-detail/detail` (media) | 已替换旧样式；关注组合 slot 使用                 |
| pm-picker | Component Lab demo                                | 计划迁移到真实表单场景（患者证件、护理项目选择） |
| pm-dialog | Component Lab demo                                | 后续与危险操作流程结合，添加真实页面引用         |
| pm-badge  | Component Lab demo                                | 适用于通知角标、状态提示，待与导航/列表结合      |

## 差距与对策

1. **真实页面引用**
   - pm-picker/pm-dialog/pm-badge 目前仅在 Component Lab，下一阶段迁移到实际页面（如患者列表、消息中心）。
2. **交互验证**
   - 已新增 component-lab e2e；仍需真机测试，检查输入/遮罩/动画体验。
3. **文档同步**
   - API 规划、最佳实践已更新；培训资料、Component Lab 指南尚需补充预设说明。

## 行动项

- [ ] 在真实页面落地 pm-picker（证件类型选择）并验证数据绑定。
- [ ] 在危险操作流程中读取 pm-dialog，替换原生 wx.showModal。
- [ ] 在通知/提醒模块尝试使用 pm-badge，并收集团队反馈。
