# TODO

- [x] 统一患者列表缓存文档：调整 readExcel 写入的 excel_cache 文档 ID，使其与 patientProfile 读取的 patients_summary_cache 对齐，并补充失败告警日志。
- [x] 建立稳定的患者主键：在 Excel 导入阶段生成 recordKey（优先使用证件号+生日，缺省时生成 GUID），写入 patients 与 excel_records，并更新云函数查询逻辑使用该键。
- [x] 导入时补齐籍贯/民族：在 readExcel 导入流程直接把 nativePlace、ethnicity 写入患者文档，去掉 patientProfile 列表请求对 excel_records 的额外查询。
- [x] 重构入住时间处理：去除行号兜底逻辑，保留原始 Excel 行序字段，新增真实 admissionTimestamp 及导入时间的区分，并同步前端展示逻辑。
- [x] 抽取公共工具模块：将时间归一化、患者分组、监护人汇总等函数整合到共享 util，替换 patientProfile 与 readExcel 中重复实现并补充单元测试。
- [x] 数据清理：清空 patients/excel_records/patient_intake_records 等集合，为重新导入做好准备。
- [x] 云函数对齐：将 patientIntake/excel-sync 等云函数中的入住时间/分组逻辑迁移至 shared util，避免重复实现。
- [x] 缓存刷新：清理 excel_cache 旧 default 文档，并验证 patients_summary_cache 在重新导入后自动刷新。
- [x] 重新导入入住数据：使用 prepare/b.xlsx 通过 readExcel import 操作恢复最新数据。

- [x] 发布云函数：将 patientProfile/readExcel/patientIntake 等更新部署到云端环境。
- [x] 导入后验证：触发一次患者列表云函数，确认重新写入 patients_summary_cache。

- [x] 列表页 UI 文案替换：将“患者/住院/出院”全面更新为“住户/入住/离开”，涵盖卡片、筛选、提示、操作按钮等。
- [ ] 批量操作入口优化：
  - 在列表头部新增显隐切换按钮，默认关闭并提示批量模式特性。
  - 复用既有多选状态，保留仅“批量发消息”“批量导出”两个入口并确认工具栏样式对齐。
  - 处理桌面/移动端布局差异，补充模式切换、退出的交互与回归测试用例。
- [ ] 悬浮按钮改造：
  - 将浮动按钮点击逻辑统一跳转至新建住户向导首步，按钮文案与图标保持不变。
  - 移除旧入住登记入口及其权限判断，将校验转移至向导内部流程。
  - 更新埋点事件与自动化测试，确保不存在旧逻辑残留。
- [ ] ActionSheet 调整：
  - 在非批量模式的长按弹层中新增“办理入住”“删除住户”，并重新梳理选项排序与分组。
  - 批量模式下禁用或隐藏敏感操作，增加提示文案与样式处理。
  - 同步 i18n 文案、UI 快照与单元测试快照。
- [ ] 删除住户流程：
  - ActionSheet 触发删除时先弹出确认模态，展示住户关联数据概览（入住记录、监护人等）。
  - 后端按顺序删除住户档案、excel_records、入住记录及缓存，失败需回滚并提示原因。
  - 完成缓存刷新与前端列表同步（含批量模式），补充关键路径自动化测试。
- [ ] 入住流程入口重构：
  - 废弃旧入住选择页路由，统一改由新向导流程承接。
  - 长按 ActionSheet 的“办理入住”需携带住户 ID、基础资料、监护人信息进入向导首步并支持预填可编辑。
  - 更新导航守卫、埋点与使用文档，验证旧链接或书签的兼容跳转。
