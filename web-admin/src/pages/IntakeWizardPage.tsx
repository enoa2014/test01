import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { intakeCreatePatient } from '../api/intake';

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
  nativePlace: string;
  address: string;
  // 联系人
  fatherInfo: string;
  fatherContactName: string;
  fatherContactPhone: string;
  motherInfo: string;
  motherContactName: string;
  motherContactPhone: string;
  guardianInfo: string;
  guardianContactName: string;
  guardianContactPhone: string;
  backupContact: string;
  backupPhone: string;
  // 情况说明（创建住户不填写医疗信息，仅保留入住时间）
  admissionDate: string;
  situation: string; // 未使用
  visitHospital: string; // 未使用
  hospitalDiagnosis: string; // 未使用
  attendingDoctor: string; // 未使用
  symptomDetail: string; // 未使用
  treatmentProcess: string; // 未使用
  followUpPlan: string; // 未使用
};

const DEFAULT_FORM: FormState = {
  patientName: '',
  idType: '身份证',
  idNumber: '',
  gender: '',
  birthDate: '',
  phone: '',
  nativePlace: '',
  address: '',
  fatherInfo: '',
  fatherContactName: '',
  fatherContactPhone: '',
  motherInfo: '',
  motherContactName: '',
  motherContactPhone: '',
  guardianInfo: '',
  guardianContactName: '',
  guardianContactPhone: '',
  backupContact: '',
  backupPhone: '',
  admissionDate: new Date().toISOString().slice(0, 10),
  situation: '',
  visitHospital: '',
  hospitalDiagnosis: '',
  attendingDoctor: '',
  symptomDetail: '',
  treatmentProcess: '',
  followUpPlan: '',
};

const ALL_STEPS: StepKey[] = ['identity', 'contact', 'review'];

const IntakeWizardPage: React.FC = () => {
  const { app } = useCloudbase();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const currentStep = ALL_STEPS[stepIndex];

  const stepTitle = useMemo(() => STEP_TITLES[currentStep], [currentStep]);

  const setField = (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm(prev => ({ ...prev, [key]: value }));
    };

  const validateIdentity = (): string | null => {
    const name = form.patientName.trim();
    const idType = form.idType.trim();
    const idNumber = form.idNumber.trim();
    const gender = form.gender.trim();
    const birthDate = form.birthDate.trim();
    const hasLoc = !!form.address.trim();
    if (!name) return '请填写姓名';
    if (!idType) return '请选择证件类型';
    if (!idNumber) return '请填写证件号码';
    if (!gender) return '请选择性别';
    if (!birthDate) return '请选择出生日期';
    if (!hasLoc) return '请填写家庭地址';
    return null;
  };

  const validateContact = (): string | null => {
    // 联系人信息非强制，但若填写电话则允许基本校验
    const phone = form.fatherContactPhone || form.motherContactPhone || form.guardianContactPhone || form.backupPhone;
    if (phone && phone.length < 5) return '请填写有效的联系人电话';
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
    if (!app) {
      setErrors({ review: 'CloudBase 未初始化' });
      return;
    }
    const identityError = validateIdentity();
    if (identityError) {
      setErrors({ identity: identityError });
      setStepIndex(0);
      return;
    }
    if (!form.admissionDate) {
      setErrors({ review: '请选择入住时间' });
      setStepIndex(2);
      return;
    }
    setSubmitting(true);
    try {
      const intakeTimeTs = form.admissionDate ? Date.parse(form.admissionDate) : undefined;
      const { patientKey } = await intakeCreatePatient(app, {
        patientName: form.patientName.trim(),
        idType: form.idType || '身份证',
        idNumber: form.idNumber?.trim(),
        gender: form.gender?.trim(),
        birthDate: form.birthDate?.trim(),
        phone: form.phone?.trim(),
        nativePlace: form.nativePlace?.trim(),
        address: form.address?.trim(),
        backupContact: form.backupContact?.trim(),
        backupPhone: form.backupPhone?.trim(),
        fatherInfo: form.fatherInfo?.trim(),
        fatherContactName: form.fatherContactName?.trim(),
        fatherContactPhone: form.fatherContactPhone?.trim(),
        motherInfo: form.motherInfo?.trim(),
        motherContactName: form.motherContactName?.trim(),
        motherContactPhone: form.motherContactPhone?.trim(),
        guardianInfo: form.guardianInfo?.trim(),
        guardianContactName: form.guardianContactName?.trim(),
        guardianContactPhone: form.guardianContactPhone?.trim(),
        admissionDate: form.admissionDate?.trim(),
        ...(Number.isFinite(intakeTimeTs) ? { intakeTime: intakeTimeTs } : {}),
      });
      navigate(`/patients/${encodeURIComponent(patientKey || '')}`, { replace: true });
    } catch (err) {
      setErrors({ review: err instanceof Error ? err.message : '创建失败' });
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

  return (
    <div className="card" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h2>住户录入向导 · {stepTitle}</h2>
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
              <select value={form.idType} onChange={setField('idType')}>
                <option value="身份证">身份证</option>
                <option value="护照">护照</option>
                <option value="军官证">军官证</option>
                <option value="其他">其他</option>
              </select>
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
              <input value={form.nativePlace} onChange={setField('nativePlace')} placeholder="省/市/县" />
            </div>
            <div className="form-field">
              <label>家庭地址 *</label>
              <input value={form.address} onChange={setField('address')} />
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
            <div className="form-field" style={{ gridColumn: '1 / span 2' }}>
              <label>父亲备注</label>
              <input value={form.fatherInfo} onChange={setField('fatherInfo')} />
            </div>

            <div className="form-field">
              <label>母亲姓名</label>
              <input value={form.motherContactName} onChange={setField('motherContactName')} />
            </div>
            <div className="form-field">
              <label>母亲电话</label>
              <input value={form.motherContactPhone} onChange={setField('motherContactPhone')} />
            </div>
            <div className="form-field" style={{ gridColumn: '1 / span 2' }}>
              <label>母亲备注</label>
              <input value={form.motherInfo} onChange={setField('motherInfo')} />
            </div>

            <div className="form-field">
              <label>监护人</label>
              <input value={form.guardianContactName} onChange={setField('guardianContactName')} />
            </div>
            <div className="form-field">
              <label>监护人电话</label>
              <input value={form.guardianContactPhone} onChange={setField('guardianContactPhone')} />
            </div>
            <div className="form-field" style={{ gridColumn: '1 / span 2' }}>
              <label>监护人备注</label>
              <input value={form.guardianInfo} onChange={setField('guardianInfo')} />
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

      {/* 新建住户不包含就医与病情，仅在核对步骤确认入住时间 */}

      {currentStep === 'review' && (
        <section className="form-section">
          <p>请核对以下信息，确认无误后提交。</p>
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
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-field">
              <label>入住时间（必选）</label>
              <input type="date" value={form.admissionDate} onChange={setField('admissionDate')} />
            </div>
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
            {submitting ? '提交中...' : '提交并创建'}
          </button>
        )}
      </div>
    </div>
  );
};

export default IntakeWizardPage;
