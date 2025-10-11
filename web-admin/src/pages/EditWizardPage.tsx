import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { fetchPatientDetail, updatePatient } from '../api/patient';
import type { PatientDetail } from '../types/patient';

type StepKey = 'identity' | 'contact' | 'situation' | 'review';

const STEP_TITLES: Record<StepKey, string> = {
  identity: '基础身份',
  contact: '联系人',
  situation: '情况说明',
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
  // 状态与备注
  careStatus: string;
  checkoutAt?: string;
  checkoutReason?: string;
  checkoutNote?: string;
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
  careStatus: 'in_care',
  checkoutAt: '',
  checkoutReason: '',
  checkoutNote: '',
};

const ALL_STEPS: StepKey[] = ['identity', 'contact', 'situation', 'review'];

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

const mapDetailToForm = (detail: PatientDetail): FormState => {
  const p = (detail && detail.patient) || ({} as Record<string, unknown>);
  return {
    ...DEFAULT_FORM,
    patientName: String(p.patientName || ''),
    gender: String(p.gender || ''),
    birthDate: formatDateForInput(p.birthDate as string),
    nativePlace: String(p.nativePlace || ''),
    ethnicity: String(p.ethnicity || ''),
    idType: String(p.idType || ''),
    idNumber: String(p.idNumber || ''),
    phone: String(p.phone || ''),
    address: String(p.address || ''),
    backupContact: String(p.backupContact || ''),
    backupPhone: String(p.backupPhone || ''),
    fatherContactName: String(p.fatherContactName || ''),
    fatherContactPhone: String(p.fatherContactPhone || ''),
    motherContactName: String(p.motherContactName || ''),
    motherContactPhone: String(p.motherContactPhone || ''),
    guardianContactName: String(p.guardianContactName || ''),
    guardianContactPhone: String(p.guardianContactPhone || ''),
    summaryCaregivers: String(p.summaryCaregivers || ''),
    careStatus: String(p.careStatus || 'in_care'),
    checkoutAt: formatDateForInput(p.checkoutAt as string),
    checkoutReason: String(p.checkoutReason || ''),
    checkoutNote: String(p.checkoutNote || ''),
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
    const hasLoc = !!(form.nativePlace || form.address)?.toString().trim();
    if (!name) return '请填写姓名';
    if (!gender) return '请选择性别';
    if (!hasId && !hasPhone) return '请至少填写证件号或一条联系电话';
    if (!hasLoc) return '请填写籍贯或常住地址';
    return null;
  };

  const validateContact = (): string | null => {
    // 联系人信息可选
    return null;
  };

  const validateSituation = (): string | null => {
    return null;
  };

  const next = () => {
    let error: string | null = null;
    if (currentStep === 'identity') error = validateIdentity();
    if (currentStep === 'contact') error = validateContact();
    if (currentStep === 'situation') error = validateSituation();
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
        careStatus: form.careStatus?.trim() || 'in_care',
        checkoutAt: form.checkoutAt?.trim(),
        checkoutReason: form.checkoutReason?.trim(),
        checkoutNote: form.checkoutNote?.trim(),
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
            <div className="form-field" style={{ gridColumn: '1 / span 2' }}>
              <label>籍贯 / 常住地址 *</label>
              <input value={form.nativePlace || form.address} onChange={setField('nativePlace')} />
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

      {currentStep === 'situation' && (
        <section className="form-section">
          <div className="form-grid">
            <div className="form-field">
              <label>在住状态</label>
              <select value={form.careStatus} onChange={setField('careStatus')}>
                <option value="in_care">在住</option>
                <option value="discharged">已退住</option>
                <option value="pending">待入驻</option>
              </select>
            </div>
            <div className="form-field">
              <label>退住时间</label>
              <input type="date" value={form.checkoutAt || ''} onChange={setField('checkoutAt')} />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label>退住原因</label>
              <input value={form.checkoutReason || ''} onChange={setField('checkoutReason')} />
            </div>
            <div className="form-field">
              <label>备注</label>
              <textarea rows={3} value={form.checkoutNote || ''} onChange={setField('checkoutNote')} />
            </div>
          </div>
        </section>
      )}

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
                <li><strong>籍贯/地址：</strong>{form.nativePlace || form.address || '-'}</li>
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
          <div>
            <h3>在住状态</h3>
            <ul className="list">
              <li><strong>状态：</strong>{form.careStatus}</li>
              <li><strong>退住时间：</strong>{form.checkoutAt || '-'}</li>
              <li><strong>退住原因：</strong>{form.checkoutReason || '-'}</li>
              <li><strong>备注：</strong>{form.checkoutNote || '-'}</li>
            </ul>
          </div>
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

