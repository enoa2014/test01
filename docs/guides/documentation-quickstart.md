# 文档编写快速入门（中文）

- 适用读者：贡献者、评审者
- 前置要求：已阅读 docs/dev-environment/documentation-style-guide.md

## 步骤
- 新建文件位置：放在 `docs/` 对应主题目录下（例如 `docs/guides/`、`docs/design/`）
- 命名规范：英文短横线（kebab-case），内容使用中文
- 模板选择：参考 `docs/_templates/` 下的模板
  - 指南：`docs/_templates/guide-template.md`
  - 规格：`docs/_templates/feature-spec-template.md`
  - ADR：`docs/_templates/adr-template.md`
- 链接规则：同目录或跨目录使用相对路径，不要以 `docs/` 前缀开头
  - 示例（本文件中引用导航）：`../TOC.md`
  - 示例（引用样式指南）：`../dev-environment/documentation-style-guide.md`

## 示例片段
```md
# 模块名称（示例）

- 背景：问题与目标
- 相关：design/ui-refactor/overview.md、dev-environment/documentation-style-guide.md
- 操作：按模板撰写并在 TOC 中添加入口
```

## 提交前检查
- 本地链接检查：`npm run docs:links`
- 目录导航更新：必要时更新 `docs/TOC.md`

## 参考
- 写作规范：`../dev-environment/documentation-style-guide.md`
- 模板入口：`../_templates/`
- 文档导航：`../TOC.md`

