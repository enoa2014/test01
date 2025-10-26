# QA 专项测试环境使用指南

更新时间：2025-10-07
发布人：Quinn（QA）
频道通知：已于 2025-10-07 16:30 在 QA 团队 Slack 频道 #qa-alerts 发布，并指派 Quinn（弱网）与 Helen（可访问性）负责。

## 环境入口
- 网络限速配置：`scripts/tools/network-throttle-profile.json`
- 本地存储清理脚本：`scripts/tools/clear-storage.js`
- 设备排期表：QA 团队共享日历（预约 iPhone 12 / Pixel 6 / NVDA 工作站）

## 使用步骤
1. **弱网模拟**
   - 在微信开发者工具 → Network 面板导入 `network-throttle-profile.json`。
   - 选择对应预设（3G Fast / 3G Slow / Weak Wi-Fi）。
   - 执行测试时记录 TTI、接口耗时，填入性能日志（链接：`docs/qa/logs/perf-tti-template.xlsx`）。
2. **本地缓存清理**
   - 在小程序调试控制台执行：
     ```js
     const clearStorage = require('../../scripts/tools/clear-storage');
     clearStorage();
     ```
   - 用于筛选持久化、缓存回归前后的状态归零。
3. **可访问性复核**
   - iOS：开启 VoiceOver → 导航锚点/批量按钮 → 记录读屏文案。
   - Android：开启 TalkBack → 验证附件排序、批量流程。
   - Windows + NVDA：键盘 Tab 流程、操作提示。

## 责任人
| 场景 | 负责人 | 备份 |
| ---- | ------ | ---- |
| 弱网性能（Stories 1.11、1.12、1.19） | Quinn | Helen |
| 可访问性（Stories 1.11、1.15、1.18） | Helen | Quinn |
| 筛选持久化（Story 1.17） | Quinn | Ruby |

## 反馈渠道
- 发现环境问题：Slack #qa-alerts @Quinn
- 工具改进建议：在 `docs/qa/assessments/qa-special-env-plan.md` 添加 Pull Request 或在 QA 看板创建任务。

## 下一步
- D1 前完成环境可用性复测（Quinn）。
- D1 下午前完成 VoiceOver/TalkBack 快速巡检（Helen）。
- 在设计走查会议中演示关键场景并收集反馈。
