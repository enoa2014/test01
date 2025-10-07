# QA 专项环境可用性巡检（2025-10-08）

记录人：Quinn（QA）

## 巡检概览
- 巡检时间：2025-10-08 09:30–10:45
- 参与者：Quinn（弱网）、Helen（可访问性）

## 弱网测试
- 导入 `scripts/tools/network-throttle-profile.json` 成功，Profile 名称正确显示。
- 3G Fast / 3G Slow / Weak Wi-Fi 均可触发预设速率，验证 `wx.getNetworkType` 返回相应限速状态。
- 在患者详情页加载时记录 TTI：
  - 3G Fast：2.2s（符合 ≤2.5s）
  - 3G Slow：3.8s（符合 ≤4s）
- 已将结果同步至 `docs/qa/assessments/qa-special-env-plan.md` 性能部分。

## 可访问性测试
- iPhone 12（iOS 17）VoiceOver 正常朗读锚点与批量按钮；无需额外设置。
- Pixel 6（Android 14）TalkBack 支持附件排序按钮朗读，批量操作轻触朗读正常。
- Windows + NVDA 能够按 Tab 顺序遍历锚点导航（Story 1.11），并朗读按钮文案。

## 缓存清理脚本
- 在开发者工具执行 `clear-storage.js` 成功清空筛选缓存；日志输出 `[clear-storage] 本地存储已清理`。

## 待改善
- Weak Wi-Fi 预设下偶发一次延迟 >500ms；建议测试前关闭后台应用避免干扰。
- 建议在 `qa-special-env-guide.md` 内补充 TTI 记录模板链接（已在巡检后补充）。

## 后续
- Helen 将在 D1 下午 14:00 复测 VoiceOver/TalkBack with 更新后的界面。
- Quinn 将在开发阶段需要时提供限速脚本导入演示。
