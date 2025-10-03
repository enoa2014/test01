# 设计令牌迁移清单（2025-09）

本文件记录小程序页面与组件的令牌迁移状态，方便后续审查 Stylelint 规则执行效果并识别剩余工作量。

## 页面状态

| 页面/模块                       | 令牌接入情况 | 说明                                                                     |
| ------------------------------- | ------------ | ------------------------------------------------------------------------ |
| `pages/index/index`             | ✅           | 使用 `foundation`/`utilities`；住户列表悬浮按钮渐变与文本色已改为令牌。  |
| `pages/analysis/index`          | ✅           | 所有色彩来自令牌；遮罩使用 `--overlay-dim`。                             |
| `pages/patient-detail/detail`   | ✅           | 历史记录提示、渐变按钮等改用 `--bg-*`、`--gradient-*`。                  |
| `pages/patient-intake/wizard/*` | ✅           | 提示与遮罩使用 overlay/background 令牌，草稿弹窗采用 `--overlay-modal`。 |
| `pages/patient-intake/select`   | ✅           | 搜索与提示区域使用令牌；副标题类调整为 `select-subtitle`。               |
| `pages/patient-intake/success`  | ✅           | 卡片背景、按钮等全部引用令牌与渐变。                                     |
| `pages/component-lab/index`     | ✅           | 激活态颜色、背景等改为令牌，辅助 Stylelint 流程演示。                    |

## 组件状态

| 组件                        | 令牌使用 | 备注                                                        |
| --------------------------- | -------- | ----------------------------------------------------------- |
| `components/base/pm-button` | ✅       | 主/次按钮文本色、加载动画均引用 `color-*` 与 overlay 令牌。 |
| `components/base/pm-card`   | ✅       | 边框与阴影取自 `foundation`。                               |
| `components/base/pm-input`  | ✅       | 输入框背景、描边使用令牌；Stylelint 通过。                  |

## 校验

- `npm run lint:style`：已对所有 WXSS 文件执行，确保不存在裸色值或覆盖基础类。
- Stylelint 自定义规则：`project/no-foundation-overrides` 阻止重新定义 `.h1/.section` 等基础类，白名单仅限 `foundation.wxss` 与 `utilities.wxss`。

## 下一步建议

1. **组件 API 升级**：迁移完成后，可着手在 TODO 第 3 节规划组件 props/slot 行为，并补充 Component Lab 示例。
2. **Stylelint 扩展**：在自定义插件基础上，考虑增加对 `utilities` 类冲突的检查（如 `.text-primary`）。
3. **CI 集成**：将 `npm run lint:style` 加入持续集成流程，避免后续提交引入裸色值。

如有新增页面或组件，须更新本清单并确保 Stylelint 通过。
