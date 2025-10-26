import React, { useEffect, useState } from 'react';

type Props = {
  visible: boolean;
  block: 'basic' | 'contact' | 'economic';
  initialForm: Record<string, unknown>;
  onCancel: () => void;
  onSave: (form: Record<string, unknown>) => void;
};

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ minWidth: 100, color: '#6b7280', fontSize: 14 }}>{label}</div>
    <div style={{ flex: 1 }}>{children}</div>
  </label>
);

const TextInput: React.FC<{
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  as?: 'input' | 'textarea';
  type?: string;
}> = ({ value, onChange, as = 'input', type = 'text' }) => {
  const common = {
    style: {
      width: '100%',
      padding: '6px 8px',
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      fontSize: 14,
    } as React.CSSProperties,
    value: (value as string) ?? '',
    onChange,
  };
  return as === 'textarea' ? (
    <textarea {...common} rows={3} />
  ) : (
    <input {...common} type={type} />
  );
};

const EditModuleDialog: React.FC<Props> = ({ visible, block, initialForm, onCancel, onSave }) => {
  const [form, setForm] = useState<Record<string, unknown>>(initialForm || {});

  useEffect(() => {
    if (visible) setForm(initialForm || {});
  }, [visible, initialForm, block]);

  if (!visible) return null;

  const setField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const renderBasic = () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="姓名"><TextInput value={String(form.patientName || '')} onChange={setField('patientName')} /></Field>
      <Field label="性别">
        <select
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 6 }}
          value={String(form.gender || '')}
          onChange={e => setForm(prev => ({ ...prev, gender: e.target.value }))}
        >
          <option value="">请选择</option>
          <option value="男">男</option>
          <option value="女">女</option>
        </select>
      </Field>
      <Field label="出生日期"><TextInput type="date" value={String(form.birthDate || '')} onChange={setField('birthDate')} /></Field>
      <Field label="证件类型"><TextInput value={String(form.idType || '')} onChange={setField('idType')} /></Field>
      <Field label="证件号码"><TextInput value={String(form.idNumber || '')} onChange={setField('idNumber')} /></Field>
      <Field label="联系电话"><TextInput value={String(form.phone || '')} onChange={setField('phone')} /></Field>
      <Field label="籍贯"><TextInput value={String(form.nativePlace || '')} onChange={setField('nativePlace')} /></Field>
      <Field label="民族"><TextInput value={String(form.ethnicity || '')} onChange={setField('ethnicity')} /></Field>
      {/* 手动维护的就诊相关字段（与基础信息同级，纯手动，无自动联动） */}
      <Field label="就诊医院"><TextInput value={String(form.latestHospital || '')} onChange={setField('latestHospital')} /></Field>
      <Field label="确诊疾病"><TextInput value={String(form.latestDiagnosis || '')} onChange={setField('latestDiagnosis')} /></Field>
      <Field label="确诊时间"><TextInput type="date" value={String(form.confirmedDate || '')} onChange={setField('confirmedDate')} /></Field>
      <Field label="目前治疗阶段"><TextInput value={String(form.treatmentStage || '')} onChange={setField('treatmentStage')} /></Field>
    </div>
  );

  const renderContact = () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="家庭地址"><TextInput value={String(form.address || '')} onChange={setField('address')} /></Field>
      <Field label="父亲信息"><TextInput value={String(form.fatherInfo || '')} onChange={setField('fatherInfo')} /></Field>
      <Field label="母亲信息"><TextInput value={String(form.motherInfo || '')} onChange={setField('motherInfo')} /></Field>
      <Field label="监护人"><TextInput value={String(form.guardianInfo || '')} onChange={setField('guardianInfo')} /></Field>
    </div>
  );

  const renderEconomic = () => (
    <div style={{ display: 'grid', gap: 12 }}>
      <Field label="家庭经济">
        <TextInput as="textarea" value={String(form.familyEconomy || '')} onChange={setField('familyEconomy')} />
      </Field>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 1000,
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 640 }}>
        <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>编辑{block === 'basic' ? '基础信息' : block === 'contact' ? '家庭信息' : '经济情况'}</h3>
          <button className="secondary-button" onClick={onCancel}>关闭</button>
        </div>

        {block === 'basic' && renderBasic()}
        {block === 'contact' && renderContact()}
        {block === 'economic' && renderEconomic()}

        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="secondary-button" onClick={onCancel}>取消</button>
          <button className="primary-button" onClick={() => onSave(form)}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default EditModuleDialog;
