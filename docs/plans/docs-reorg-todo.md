# 文档重组剩余事项（TODO）

## 待补充文档
- 数据库 Schema：新增 `docs/database-schema.md`（或整合到 `architecture/data-model.md`）
- API 接口参考：新增 `docs/api-reference.md`（或分模块到各云函数）
- 组件目录 README：为 `docs/design/`、`docs/ux-analysis/` 等目录补充简要 README（索引/范围/术语）

## 需要巡检/重构
- 业务组件交叉链接统一（PatientCard、SmartSearchBar 在多文档引用处统一相对路径）
- 设计令牌引用一致性（所有文档示例统一使用令牌而非硬编码色值/阴影）
- 旧版分析文档去重与归档完成度检查（archives/ 覆盖率）

## 候选归档
- 大型历史报告与会议记录（plans/ 与 stories/ 下体量较大且过期的条目）

## 工具与流程（可选）
- 拼写检查：可选引入 `cspell` 中文词库（本地脚本，不接入 CI）
- 提交钩子：`pre-commit` 提示执行 `npm run docs:links`（仅提示，不阻塞）

## 开放问题
- 是否为每个大目录引入简体中文/术语表（便于新同学快速上手）
- 是否需要将部分 UX 分析图转存为 `assets/` 并统一命名

