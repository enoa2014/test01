import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { fetchPatientDetail, updatePatient } from '../api/patient';
import type { PatientDetail } from '../types/patient';

type StepKey = 'identity' | 'contact' | 'review';

const STEP_TITLES: Record<StepKey, string> = {
  identity: '基础身份',
  contact: '联系人',
  review: '核对提交',
};

type FormState = {
  // 身份
  patientName: string;
  idType: string;
  idNumber: string;
  gender: string;
  birthDate: string;
  phone: string;
  address: string;
  nativePlace?: string;
  ethnicity?: string;
  // 联系人
  fatherContactName: string;
  fatherContactPhone: string;
  motherContactName: string;
  motherContactPhone: string;
  guardianContactName: string;
  guardianContactPhone: string;
  backupContact: string;
  backupPhone: string;
  summaryCaregivers?: string;
};

const DEFAULT_FORM: FormState = {
  patientName: '',
  idType: '',
  idNumber: '',
  gender: '',
  birthDate: '',
  phone: '',
  address: '',
  nativePlace: '',
  ethnicity: '',
  fatherContactName: '',
  fatherContactPhone: '',
  motherContactName: '',
  motherContactPhone: '',
  guardianContactName: '',
  guardianContactPhone: '',
  backupContact: '',
  backupPhone: '',
  summaryCaregivers: '',
};
const ALL_STEPS: StepKey[] = ['identity', 'contact', 'review'];

const formatDateForInput = (value?: string | number | null): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  }
  const normalized = String(value).replace(/[./]/g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return '';
};

const valueByLabel = (
  list: Array<{ label: string; value: string }> | undefined,
  label: string
): string => {
  if (!Array.isArray(list)) return '';
  const found = list.find(item => item && item.label === label);
  return found && typeof found.value === 'string' ? found.value : '';
};

const mapDetailToForm = (detail: PatientDetail): FormState => {
  const p = (detail && detail.patient) || ({} as Record<string, unknown>);
  const basicInfo = (detail && (detail.basicInfo as Array<{ label: string; value: string }>)) || [];
  const familyInfo = (detail && (detail.familyInfo as Array<{ label: string; value: string }>)) || [];
  const genderFromBasic = valueByLabel(basicInfo, '性别');
  const birthFromBasic = valueByLabel(basicInfo, '出生日期');
  const idNumberFromBasic = valueByLabel(basicInfo, '身份证号');
  const nativePlaceFromBasic = valueByLabel(basicInfo, '籍贯');
  const ethnicityFromBasic = valueByLabel(basicInfo, '民族');
  const addressFromFamily = valueByLabel(familyInfo, '家庭地址');
  return {
    ...DEFAULT_FORM,
    patientName: String(p.patientName || ''),
    gender: String(genderFromBasic || p.gender || ''),
    birthDate: formatDateForInput(birthFromBasic || (p.birthDate as string)),
    nativePlace: String(nativePlaceFromBasic || p.nativePlace || ''),
    ethnicity: String(ethnicityFromBasic || p.ethnicity || ''),
    idType: String(p.idType || ''),
    idNumber: String(idNumberFromBasic || p.idNumber || ''),
    phone: String(p.phone || ''),
    address: String(addressFromFamily || p.address || ''),
    backupContact: String(p.backupContact || ''),
    backupPhone: String(p.backupPhone || ''),
    fatherContactName: String(p.fatherContactName || ''),
    fatherContactPhone: String(p.fatherContactPhone || ''),
    motherContactName: String(p.motherContactName || ''),
    motherContactPhone: String(p.motherContactPhone || ''),
    guardianContactName: String(p.guardianContactName || ''),
    guardianContactPhone: String(p.guardianContactPhone || ''),
    summaryCaregivers: String(p.summaryCaregivers || ''),
  };
};

const EditWizardPage: React.FC = () => {
  const { app } = useCloudbase();
  const { patientKey = '' } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const currentStep = ALL_STEPS[stepIndex];

  const stepTitle = useMemo(() => STEP_TITLES[currentStep], [currentStep]);

  useEffect(() => {
    let mounted = true;
    if (!app || !patientKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPatientDetail(app, patientKey)
      .then(detail => {
        if (!mounted) return;
        setForm(mapDetailToForm(detail));
      })
      .catch(err => {
        if (!mounted) return;
        setErrors({ identity: err instanceof Error ? err.message : '加载失败' });
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [app, patientKey]);

  const setField = (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm(prev => ({ ...prev, [key]: value }));
    };

  const validateIdentity = (): string | null => {
    const name = form.patientName.trim();
    const gender = form.gender.trim();
    const hasId = !!form.idNumber.trim();
    const hasPhone = !!form.phone.trim();
    const hasAddress = !!(form.address || '').toString().trim();
    if (!name) return '请填写姓名';
    if (!gender) return '请选择性别';
    if (!hasId && !hasPhone) return '请至少填写证件号或一条联系电话';
    if (!hasAddress) return '请填写家庭地址';
    return null;
  };

  const validateContact = (): string | null => {
    // 联系人信息可选
    return null;
  };

  const next = () => {
    let error: string | null = null;
    if (currentStep === 'identity') error = validateIdentity();
    if (currentStep === 'contact') error = validateContact();
    if (error) {
      setErrors({ [currentStep]: error });
      return;
    }
    setErrors({});
    setStepIndex(index => Math.min(index + 1, ALL_STEPS.length - 1));
  };

  const prev = () => {
    setErrors({});
    setStepIndex(index => Math.max(index - 1, 0));
  };

  const handleSubmit = async () => {
    if (!app || !patientKey) {
      setErrors({ review: 'CloudBase 未初始化或缺少 patientKey' });
      return;
    }
    const identityError = validateIdentity();
    if (identityError) {
      setErrors({ identity: identityError });
      setStepIndex(0);
      return;
    }
    setSubmitting(true);
    try {
      await updatePatient(app, patientKey, {
        patientName: form.patientName.trim(),
        gender: form.gender,
        birthDate: form.birthDate ? form.birthDate.trim() : undefined,
        nativePlace: form.nativePlace?.trim(),
        ethnicity: form.ethnicity?.trim(),
        idType: form.idType?.trim(),
        idNumber: form.idNumber?.trim(),
        phone: form.phone?.trim(),
        address: form.address?.trim(),
        backupContact: form.backupContact?.trim(),
        backupPhone: form.backupPhone?.trim(),
        fatherContactName: form.fatherContactName?.trim(),
        fatherContactPhone: form.fatherContactPhone?.trim(),
        motherContactName: form.motherContactName?.trim(),
        motherContactPhone: form.motherContactPhone?.trim(),
        guardianContactName: form.guardianContactName?.trim(),
        guardianContactPhone: form.guardianContactPhone?.trim(),
        summaryCaregivers: form.summaryCaregivers?.trim(),
        // 状态相关信息由入住记录维护
      });
      navigate(`/patients/${encodeURIComponent(patientKey)}`, { replace: true });
    } catch (err) {
      setErrors({ review: err instanceof Error ? err.message : '保存失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex-row" style={{ gap: 8, marginBottom: 16 }}>
      {ALL_STEPS.map((key, idx) => (
        <div key={key} className={`status-pill ${idx === stepIndex ? 'green' : 'gray'}`}>
          {idx + 1}. {STEP_TITLES[key]}
        </div>
      ))}
    </div>
  );

  if (loading) {
    return <div className="card"><p>住户信息加载中...</p></div>;
  }

  return (
    <div className="card" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2>编辑住户 · {stepTitle}</h2>
        <button className="secondary-button" onClick={() => navigate(-1)}>返回</button>
      </div>

      <StepIndicator />

      {errors[currentStep] && <p className="error-text">{errors[currentStep]}</p>}

      {currentStep === 'identity' && (
        <section className="form-section">
          <div className="form-grid">
            <div className="form-field">
              <label>姓名 *</label>
              <input value={form.patientName} onChange={setField('patientName')} />
            </div>
            <div className="form-field">
              <label>性别 *</label>
              <select value={form.gender} onChange={setField('gender')}>
                <option value="">请选择</option>
                <option value="男">男</option>
                <option value="女">女</option>
                <option value="其他">其他</option>
              </select>
            </div>
            <div className="form-field">
              <label>证件类型</label>
              <input value={form.idType} onChange={setField('idType')} />
            </div>
            <div className="form-field">
              <label>证件号码</label>
              <input value={form.idNumber} onChange={setField('idNumber')} />
            </div>
            <div className="form-field">
              <label>出生日期</label>
              <input type="date" value={form.birthDate} onChange={setField('birthDate')} />
            </div>
            <div className="form-field">
              <label>联系电话</label>
              <input value={form.phone} onChange={setField('phone')} />
            </div>
            <div className="form-field">
              <label>籍贯</label>
              <input value={form.nativePlace || ''} onChange={setField('nativePlace')} placeholder="省/市/县" />
            </div>
            <div className="form-field">
              <label>家庭地址 *</label>
              <input value={form.address || ''} onChange={setField('address')} placeholder="详细地址" />
            </div>
          </div>
        </section>
      )}

      {currentStep === 'contact' && (
        <section className="form-section">
          <div className="form-grid">
            <div className="form-field">
              <label>父亲姓名</label>
              <input value={form.fatherContactName} onChange={setField('fatherContactName')} />
            </div>
            <div className="form-field">
              <label>父亲电话</label>
              <input value={form.fatherContactPhone} onChange={setField('fatherContactPhone')} />
            </div>
            <div className="form-field">
              <label>母亲姓名</label>
              <input value={form.motherContactName} onChange={setField('motherContactName')} />
            </div>
            <div className="form-field">
              <label>母亲电话</label>
              <input value={form.motherContactPhone} onChange={setField('motherContactPhone')} />
            </div>
            <div className="form-field">
              <label>监护人</label>
              <input value={form.guardianContactName} onChange={setField('guardianContactName')} />
            </div>
            <div className="form-field">
              <label>监护人电话</label>
              <input value={form.guardianContactPhone} onChange={setField('guardianContactPhone')} />
            </div>
            <div className="form-field">
              <label>备用联系人</label>
              <input value={form.backupContact} onChange={setField('backupContact')} />
            </div>
            <div className="form-field">
              <label>备用联系人电话</label>
              <input value={form.backupPhone} onChange={setField('backupPhone')} />
            </div>
          </div>
        </section>
      )}

      {/* 编辑资料不包含就医与病情 */}

      {currentStep === 'review' && (
        <section className="form-section">
          <p>请核对信息后保存。</p>
          <div className="grid-two">
            <div>
              <h3>基础身份</h3>
              <ul className="list">
                <li><strong>姓名：</strong>{form.patientName || '-'}</li>
                <li><strong>性别：</strong>{form.gender || '-'}</li>
                <li><strong>证件类型：</strong>{form.idType || '-'}</li>
                <li><strong>证件号码：</strong>{form.idNumber || '-'}</li>
                <li><strong>出生日期：</strong>{form.birthDate || '-'}</li>
                <li><strong>联系电话：</strong>{form.phone || '-'}</li>
                <li><strong>籍贯：</strong>{form.nativePlace || '-'}</li>
                <li><strong>家庭地址：</strong>{form.address || '-'}</li>
              </ul>
            </div>
            <div>
              <h3>联系人</h3>
              <ul className="list">
                <li><strong>父亲：</strong>{form.fatherContactName || '-'} {form.fatherContactPhone && `(${form.fatherContactPhone})`}</li>
                <li><strong>母亲：</strong>{form.motherContactName || '-'} {form.motherContactPhone && `(${form.motherContactPhone})`}</li>
                <li><strong>监护人：</strong>{form.guardianContactName || '-'} {form.guardianContactPhone && `(${form.guardianContactPhone})`}</li>
                <li><strong>备用联系人：</strong>{form.backupContact || '-'} {form.backupPhone && `(${form.backupPhone})`}</li>
              </ul>
            </div>
          </div>
            {/* 编辑资料不显示就医与病情 */}
          {errors.review && <p className="error-text">{errors.review}</p>}
        </section>
      )}

      <div className="form-actions">
        <button className="secondary-button" onClick={prev} disabled={stepIndex === 0}>上一步</button>
        {currentStep !== 'review' ? (
          <button className="primary-button" onClick={next}>下一步</button>
        ) : (
          <button className="primary-button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '保存中...' : '保存修改'}
          </button>
        )}
      </div>
    </div>
  );
};

export default EditWizardPage;
