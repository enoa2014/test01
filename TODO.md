# TODO

- [ ] 统一患者列表缓存文档：调整 readExcel 写入的 excel_cache 文档 ID，使其与 patientProfile 读取的 patients_summary_cache 对齐，并补充失败告警日志。
- [ ] 建立稳定的患者主键：在 Excel 导入阶段生成 recordKey（优先使用证件号+生日，缺省时生成 GUID），写入 patients 与 excel_records，并更新云函数查询逻辑使用该键。
- [ ] 导入时补齐籍贯/民族：在 readExcel 导入流程直接把 nativePlace、ethnicity 写入患者文档，去掉 patientProfile 列表请求对 excel_records 的额外查询。
- [ ] 重构入院时间处理：去除行号兜底逻辑，保留原始 Excel 行序字段，新增真实 admissionTimestamp 及导入时间的区分，并同步前端展示逻辑。
- [ ] 抽取公共工具模块：将时间归一化、患者分组、监护人汇总等函数整合到共享 util，替换 patientProfile 与 readExcel 中重复实现并补充单元测试。
