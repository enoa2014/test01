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