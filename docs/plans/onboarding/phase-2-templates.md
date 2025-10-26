# 入职与权限开通 · 阶段2：角色/范围模板与默认限权

目标（2–3 周内）
- 引入“角色模板”与“数据范围模板”，邀请/审批均可一键套用
- 默认限权与期限：所有新成员均从最小权限开始，必要时设置试用期到期自动回收

数据模型与接口
- 新集合
  - `roleTemplates`：{ name, role, defaultPermissions, defaultExpiryDays, createdAt, updatedAt }
  - `scopeTemplates`：{ name, type: 'tenant'|'project'|'patient', value(s), createdAt, updatedAt }
- 邀请/审批字段扩展
  - invites：{ roleTemplateId?, scopeTemplateId? }（优先于单独的 role/scope 字段）
  - roleBindings：写入时附带 scope 信息与 expiresAt（来自模板或覆盖）
- rbac 云函数（建议新增）
  - listRoleTemplates/createRoleTemplate/update/delete
  - listScopeTemplates/createScopeTemplate/update/delete
  - applyTemplateToInvite(inviteId, roleTemplateId, scopeTemplateId?)（可选）

管理端改造（/web-admin）
- 模板管理
  - [ ] “角色模板”管理页：列表/创建/编辑/禁用
  - [ ] “范围模板”管理页：支持选择院区/项目/患者ID；列表/创建/编辑/禁用
- 邀请创建弹窗
  - [ ] 增加“选择角色模板、选择范围模板”，优先使用模板填充表单，允许覆盖
  - [ ] 显示应用后的到期时间/默认权限摘要
- 审批页
  - [ ] 审批通过时可选择模板并覆盖范围/期限

小程序改造（/wx-project）
- 申请页
  - [ ] 自助申请时可选择范围（根据角色显示可选项），或提交后由管理员套用模板

验收标准
- 管理员可在 3 次点击内用模板创建邀请并生成二维码
- 套用模板后的邀请/绑定包含范围与期限；到期自动回收角色
- 审批页可选择模板并覆盖；审计记录具体模板与变更详情

风控
- 模板变更写入审计；模板禁用后不可继续套用
- 到期自动回收定时任务（云函数定时触发）

里程碑
- W1：模板数据模型与管理页（读写）
- W2：邀请创建/审批套用模板；范围选择器联调
- W3：到期自动回收与报表（到期/已回收统计）
