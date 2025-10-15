# 文档写作与命名规范（中文）

本规范用于约束仓库内 Markdown 文档的写作、命名与链接方式，确保一致性与可维护性。

## 语言与文件命名
- 内容语言：全部使用中文。
- 文件命名：使用英文短横线（kebab-case），避免空格与中文文件名。
  - 示例：`resident-card-ui-design-report.md`、`patient-detail-performance-plan.md`
- 目录命名：同样使用短横线；按主题分层组织（如 `ux-analysis/patient-list/`）。

## 结构与标题
- 顶部使用一级标题 `# 标题`，后续从二级 `##` 开始分节。
- 段落简短、列表优先；表格仅用于必要的对比与度量。
- 代码块使用三引号并注明语言：```js、```json、```wxss 等。

## 链接与引用
- 相对路径：在 `docs/` 内部相互链接时，使用相对路径且不要以 `docs/` 前缀开头。
  - 示例（位于 `docs/TOC.md` 内）：`design/ui-refactor/overview.md`。
- 跨目录到仓库根部或其他目录：按需使用 `../` 回退。
  - 示例（位于 `docs/miniprogram/components/index.md` 内指向仓库组件）：`../../../wx-project/components/.../README.md`。
- 外部链接：使用完整 `https://`；避免裸链接，尽量以文本包裹如 `[示例](https://example.com)`。

## 图片与资源
- 图片建议放置于与文档同级的 `assets/` 子目录，使用相对路径引用。
- 图片需要提供简要说明文本（可放在图片下方或作为替代文本）。

## 版本与更新
- 重要文档应在底部保留“最近更新日期”和“适用版本/范围”。
- 大型历史文档若被拆分，请在新文档标注替换关系；历史版本通过 Git 提交历史查阅（不再保留 `docs/archives/`）。

## 术语与风格
- 中文标点，单位与数字之间保留空格（如 “15 天”）；度量单位统一（rpx/px 按上下文）。
- 统一术语：例如 “患者卡片 PatientCard”、“智能搜索栏 SmartSearchBar”。
- 避免冗长段落，优先以要点列表表达结论与行动项。

## 示例片段
```md
# 患者列表页 UI 重构总览

- 目标：提升信息密度与操作效率
- 相关：design/ui-refactor/pages.md、components.md
- 度量：可见卡片 3.5 → 5；工具栏高度 -44%
```

> 如需模板，请见 `docs/_templates/`。
