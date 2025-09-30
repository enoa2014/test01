# RGBA 使用清单（2025-09）

本清单汇总当前代码库中仍以 `rgba()` / 渐变透明度实现的样式，用于规划后续令牌补充与替换路径。数据来自 `rg "rgba(" miniprogram` 及衍生的 `scripts/audit-rgba.js` 扫描结果。

> 🌱 建议：在 `design-tokens.json` 新增相应语义令牌（overlay、highlight、gradient、shadow），并在 `scripts/generate-tokens.js` 输出，同时为剩余 `miniprogram/styles/legacy/tokens.wxss` 里的渐变提供迁移计划。

## 1. 组件级别

| 位置                                                  | 用途             | 建议令牌                                  |
| ----------------------------------------------------- | ---------------- | ----------------------------------------- |
| `miniprogram/components/base/pm-button/index.wxss:74` | 加载态小圆圈描边 | `--overlay-inverse-40`（白色 40% 透明度） |

## 2. 页面遮罩 / 高亮

| 页面                                  | 行号                                 | 描述                 | 建议令牌 |
| ------------------------------------- | ------------------------------------ | -------------------- | -------- |
| analysis/index.wxss:83                | Selection 蒙层 `rgba(17,24,39,0.45)` | `--overlay-dim`      |
| patient-detail/detail.wxss:370        | 文本预览遮罩 `rgba(17,24,39,0.6)`    | `--overlay-strong`   |
| patient-intake/select/select.wxss:255 | 详情确认弹窗背景 `rgba(0,0,0,0.45)`  | 复用 `--overlay-dim` |
| patient-intake/wizard/wizard.wxss:512 | 草稿提示遮罩 `rgba(0,0,0,0.5)`       | `--overlay-strong`   |

## 3. 信息提示背景 / 高亮块

| 页面                                        | 行号                                   | 描述                | 建议令牌 |
| ------------------------------------------- | -------------------------------------- | ------------------- | -------- |
| patient-detail/detail.wxss:166              | 蓝色提示条背景 `rgba(24,144,255,0.08)` | `--bg-info-soft`    |
| patient-detail/detail.wxss:242              | 状态提示块 `rgba(24,144,255,0.08)`     | 同上                |
| patient-intake/select/select.wxss:160       | 「新患者」徽标 `rgba(250,173,20,0.15)` | `--bg-warning-soft` |
| patient-intake/select/select.wxss:326       | 确认弹窗提示 `rgba(24,144,255,0.08)`   | `--bg-info-soft`    |
| patient-intake/wizard/wizard.wxss:242 / 422 | 情况提示块 `rgba(24,144,255,0.08)`     | `--bg-info-soft`    |

## 4. 渐变背景

| 页面                               | 行号                 | 描述                       | 建议令牌 |
| ---------------------------------- | -------------------- | -------------------------- | -------- |
| patient-detail/detail.wxss:499/505 | 蓝色渐变按钮（145°） | `--gradient-info-light`    |
| patient-detail/detail.wxss:511/517 | 绿色渐变按钮         | `--gradient-success-light` |

## 5. 透明卡片 / 半透明容器

| 页面                   | 行号                                     | 描述                       | 建议令牌 |
| ---------------------- | ---------------------------------------- | -------------------------- | -------- |
| families/index.wxss:92 | 家庭档案卡片背景 `rgba(255,255,255,0.8)` | `--bg-surface-translucent` |

## 6. 阴影（box-shadow）

- 已在 `design-tokens.json → shadow` 中定义；未来计划：
  1. 从 `miniprogram/styles/legacy/tokens.wxss` 中移除重复阴影类。
  2. 将页面内自定义阴影 (`families/index.wxss`, `patient-intake/success/success.wxss` 等) 替换为 `var(--shadow-*)`。

## 后续步骤

1. 在 `design-tokens.json` 新增：
   ```json
   {
     "overlay": {
       "dim": "rgba(17, 24, 39, 0.45)",
       "strong": "rgba(17, 24, 39, 0.6)",
       "inverse40": "rgba(255, 255, 255, 0.4)"
     },
     "background": {
       "infoSoft": "rgba(24, 144, 255, 0.08)",
       "warningSoft": "rgba(250, 173, 20, 0.15)",
       "surfaceTranslucent": "rgba(255, 255, 255, 0.8)"
     },
     "gradient": {
       "infoLight": "linear-gradient(145deg, rgba(24, 144, 255, 0.05), rgba(24, 144, 255, 0.10))",
       "infoLightHover": "linear-gradient(145deg, rgba(24, 144, 255, 0.08), rgba(24, 144, 255, 0.12))",
       "successLight": "linear-gradient(145deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.10))",
       "successLightHover": "linear-gradient(145deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.12))"
     }
   }
   ```
2. 扩展 `scripts/generate-tokens.js`：对 overlay/background/gradient 分类生成别名（如 `--overlay-dim`, `--bg-info-soft`, `--gradient-info-light`）。
3. 逐页替换现有 `rgba()` 语句为 `var(--overlay-dim)` 等。
4. 清理 `miniprogram/styles/legacy/tokens.wxss` 中同类定义，确保所有来源唯一，并最终下线 legacy 文件。

本文件后续可作为令牌扩展的跟踪依据，建议在上述步骤执行完毕后更新状态。
