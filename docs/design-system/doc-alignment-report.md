# 设计令牌文档对齐报告（2025-09）

为落实 TODO 中“对齐设计令牌文档引用，统一改为 `design-tokens.json` + `styles/generated/tokens.wxss`”的要求，已完成以下检查：

| 文档                                          | 状态 | 说明                                                                                     |
| --------------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| `docs/design-system/design-tokens-spec.md`    | ✅   | 目录结构改为 `styles/generated/`，提示 legacy 文件仅做过渡。                             |
| `docs/design-system/figma-tokens-guide.md`    | ✅   | 明确合并 `design-tokens.json` 后运行 `npm run tokens:generate`，禁用手改 legacy 文件。   |
| `docs/design-system/rgba-inventory.md`        | ✅   | 指向 `wx-project/styles/legacy/tokens.wxss`，说明迁移计划。                             |
| `docs/page-designs/design-handoff-package.md` | ✅   | 前端实现建议改为引用 `styles/generated/tokens.wxss`。                                    |
| `docs/dev-environment/setup.md`               | ✅   | 脚本示例中说明 `lint:style` 与令牌生成流程。                                             |
| `docs/architecture/tech-stack.md`             | ✅   | 技术栈条目指向 `design-tokens.json → styles/generated/tokens.wxss`。                     |
| 其他 `docs/` 目录                             | ✅   | 搜索未发现 `styles/tokens.wxss` 直接引用；仅在 `figma-tokens-guide` 中保留禁止修改说明。 |

## 验证

- 检索命令：
  ```bash
  rg "styles/tokens\\.wxss" docs
  rg "design-tokens.json" docs
  ```
  结果表明仅保留必要的过渡说明，无旧路径示例。
- 所有文档均提醒执行 `npm run tokens:generate` 生成 WXSS/JS。

## 后续建议

1. 若新增设计文档/故事，请参考表格中的标准描述，避免旧路径回归。
2. 在 Component 重构完成后，考虑将本报告合入设计系统 README 供新人参考。

本报告将随文档更新同步维护，如发现旧引用应即时修正并登记。
