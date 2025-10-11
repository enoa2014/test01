import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCloudbase } from '../hooks/useCloudbase';
import { intakeCreatePatient } from '../api/intake';

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
  // 情况说明
  admissionDate: string;
  situation: string;
  visitHospital: string;
  hospitalDiagnosis: string;
  attendingDoctor: string;
  symptomDetail: string;
  treatmentProcess: string;
  followUpPlan: string;
};

const DEFAULT_FORM: FormState = {
  patientName: '',
  idType: '身份证',
  idNumber: '',
  gender: '',
  birthDate: '',
  phone: '',
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

const ALL_STEPS: StepKey[] = ['identity', 'contact', 'situation', 'review'];

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
    const gender = form.gender.trim();
    const hasId = !!form.idNumber.trim();
    const hasPhone = !!form.phone.trim();
    const hasLoc = !!form.address.trim();
    if (!name) return '请填写姓名';
    if (!gender) return '请选择性别';
    if (!hasId && !hasPhone) return '请至少填写证件号或联系电话';
    if (!hasLoc) return '请填写住址';
    return null;
  };

  const validateContact = (): string | null => {
    // 联系人信息非强制，但若填写电话则允许基本校验
    const phone = form.fatherContactPhone || form.motherContactPhone || form.guardianContactPhone || form.backupPhone;
    if (phone && phone.length < 5) return '请填写有效的联系人电话';
    return null;
  };

  const validateSituation = (): string | null => {
    // 小程序允许空描述，这里保持一致
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
    setSubmitting(true);
    try {
      const { patientKey } = await intakeCreatePatient(app, {
        patientName: form.patientName.trim(),
        idType: form.idType || '身份证',
        idNumber: form.idNumber?.trim(),
        gender: form.gender?.trim(),
        birthDate: form.birthDate?.trim(),
        phone: form.phone?.trim(),
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
        situation: form.situation?.trim(),
        visitHospital: form.visitHospital?.trim(),
        hospitalDiagnosis: form.hospitalDiagnosis?.trim(),
        attendingDoctor: form.attendingDoctor?.trim(),
        symptomDetail: form.symptomDetail?.trim(),
        treatmentProcess: form.treatmentProcess?.trim(),
        followUpPlan: form.followUpPlan?.trim(),
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
            <div className="form-field" style={{ gridColumn: '1 / span 2' }}>
              <label>常住地址 *</label>
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

      {currentStep === 'situation' && (
        <section className="form-section">
          <div className="form-grid">
            <div className="form-field">
              <label>就诊日期</label>
              <input type="date" value={form.admissionDate} onChange={setField('admissionDate')} />
            </div>
            <div className="form-field">
              <label>就诊医院</label>
              <input value={form.visitHospital} onChange={setField('visitHospital')} />
            </div>
            <div className="form-field">
              <label>主诊断</label>
              <input value={form.hospitalDiagnosis} onChange={setField('hospitalDiagnosis')} />
            </div>
            <div className="form-field">
              <label>主治医生</label>
              <input value={form.attendingDoctor} onChange={setField('attendingDoctor')} />
            </div>
          </div>
          <div className="form-field">
            <label>情况说明</label>
            <textarea rows={3} value={form.situation} onChange={setField('situation')} />
          </div>
          <div className="form-field">
            <label>症状详情</label>
            <textarea rows={3} value={form.symptomDetail} onChange={setField('symptomDetail')} />
          </div>
          <div className="form-field">
            <label>治疗过程</label>
            <textarea rows={3} value={form.treatmentProcess} onChange={setField('treatmentProcess')} />
          </div>
          <div className="form-field">
            <label>随访计划</label>
            <textarea rows={3} value={form.followUpPlan} onChange={setField('followUpPlan')} />
          </div>
        </section>
      )}

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
                <li><strong>住址：</strong>{form.address || '-'}</li>
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
          <div className="grid-two">
            <div>
              <h3>就诊与病情</h3>
              <ul className="list">
                <li><strong>就诊日期：</strong>{form.admissionDate || '-'}</li>
                <li><strong>医院：</strong>{form.visitHospital || '-'}</li>
                <li><strong>诊断：</strong>{form.hospitalDiagnosis || '-'}</li>
                <li><strong>医生：</strong>{form.attendingDoctor || '-'}</li>
              </ul>
            </div>
            <div>
              <h3>补充说明</h3>
              <ul className="list">
                <li><strong>情况说明：</strong>{form.situation || '-'}</li>
                <li><strong>症状详情：</strong>{form.symptomDetail || '-'}</li>
                <li><strong>治疗过程：</strong>{form.treatmentProcess || '-'}</li>
                <li><strong>随访计划：</strong>{form.followUpPlan || '-'}</li>
              </ul>
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

