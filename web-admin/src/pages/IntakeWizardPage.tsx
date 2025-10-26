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
  const [autoFilledFromID, setAutoFilledFromID] = useState(false);
  const [showAutoFillTip, setShowAutoFillTip] = useState(false);
  const currentStep = ALL_STEPS[stepIndex];

  const stepTitle = useMemo(() => STEP_TITLES[currentStep], [currentStep]);

  // 身份证号解析函数 - 参考微信小程序实现
  const parseIDNumber = (idNumber: string) => {
    const trimmed = idNumber.trim();

    // 验证18位身份证号格式
    const regex18 = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]$/;

    if (!regex18.test(trimmed)) {
      // 格式不正确，清除自动填充标记
      setAutoFilledFromID(false);
      return;
    }

    // 提取性别（倒数第二位，奇数为男，偶数为女）
    const genderCode = parseInt(trimmed.charAt(16));
    const gender = genderCode % 2 === 0 ? '女' : '男';

    // 提取出生日期
    const year = trimmed.substring(6, 10);
    const month = trimmed.substring(10, 12);
    const day = trimmed.substring(12, 14);
    const birthDate = `${year}-${month}-${day}`;

    // 自动填充性别和出生日期
    setForm(prev => ({ ...prev, gender, birthDate }));
    setAutoFilledFromID(true);
    setShowAutoFillTip(true);

    // 3秒后自动隐藏提示
    setTimeout(() => {
      setShowAutoFillTip(false);
    }, 3000);
  };

  const setField = (key: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm(prev => ({ ...prev, [key]: value }));

      // 当修改证件号码且证件类型是身份证时，触发自动解析
      if (key === 'idNumber' && form.idType === '身份证') {
        parseIDNumber(value);
      }

      // 切换证件类型时，清除自动填充标记
      if (key === 'idType' && value !== '身份证') {
        setAutoFilledFromID(false);
      }
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

  const requiredFields: Record<StepKey, string[]> = {
    identity: ['姓名', '性别', '证件号码', '出生日期', '家庭地址'],
    contact: [],
    review: ['入住时间'],
  };

  const StepIndicator = () => (
    <div className="wizard-progress-header">
      <div className="wizard-steps">
        {ALL_STEPS.map((key, idx) => {
          const isActive = idx === stepIndex;
          const isCompleted = idx < stepIndex;
          return (
            <div
              key={key}
              className={`wizard-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="wizard-step-number">{idx + 1}</div>
              <div className="wizard-step-label">{STEP_TITLES[key]}</div>
            </div>
          );
        })}
      </div>
      <div className="wizard-progress-info">
        <span>第 {stepIndex + 1} 步 / 共 {ALL_STEPS.length} 步</span>
        {requiredFields[currentStep].length > 0 && (
          <span className="wizard-required-count">
            本步必填项：{requiredFields[currentStep].join('、')}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="wizard-container">
      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">🏠 新增住户</h1>
        <button className="btn-enhanced btn-secondary" onClick={() => navigate(-1)}>
          ← 返回列表
        </button>
      </div>

      {/* 步骤指示器 */}
      <StepIndicator />

      {/* 自动填充提示 */}
      {showAutoFillTip && (
        <div className="wizard-autofill-toast">
          <span className="wizard-autofill-icon">✓</span>
          <span>已从身份证号自动识别性别和出生日期</span>
        </div>
      )}

      {/* 错误提示 */}
      {errors[currentStep] && (
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          background: '#fef2f2',
          border: '2px solid var(--color-danger)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-danger)',
          fontWeight: 'var(--font-medium)'
        }}>
          ⚠️ {errors[currentStep]}
        </div>
      )}

      {/* 步骤内容卡片 */}
      <div className="wizard-step-card">
        <div className="wizard-step-header">
          <h2 className="wizard-step-title">
            <span className="wizard-step-title-icon">
              {currentStep === 'identity' && '👤'}
              {currentStep === 'contact' && '📞'}
              {currentStep === 'review' && '✅'}
            </span>
            {stepTitle}
          </h2>
          {requiredFields[currentStep].length > 0 && (
            <p className="wizard-required-hint">
              <span className="required-mark">*</span> 本步必填项：{requiredFields[currentStep].join('、')}
            </p>
          )}
        </div>

        <div className="wizard-step-body">
          {currentStep === 'identity' && (
            <>
              <div className="wizard-step-intro">
                <span className="wizard-intro-icon">📝</span>
                <span className="wizard-intro-text">请填写住户基本身份信息，证件类型为身份证时系统将自动识别性别和出生日期</span>
              </div>
              <div className="form-grid">
                <div className="form-field-enhanced">
                  <label>姓名 <span className="required-mark">*</span></label>
                  <input value={form.patientName} onChange={setField('patientName')} placeholder="请输入住户姓名" />
                </div>
                <div className="form-field-enhanced">
                  <label>
                    性别 <span className="required-mark">*</span>
                    {autoFilledFromID && <span className="auto-detected-badge">🤖 自动识别</span>}
                  </label>
                  <select value={form.gender} onChange={setField('gender')}>
                    <option value="">请选择</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="form-field-enhanced">
                  <label>证件类型</label>
                  <select value={form.idType} onChange={setField('idType')}>
                    <option value="身份证">身份证</option>
                    <option value="护照">护照</option>
                    <option value="军官证">军官证</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="form-field-enhanced">
                  <label>证件号码 <span className="required-mark">*</span></label>
                  <input
                    value={form.idNumber}
                    onChange={setField('idNumber')}
                    placeholder={form.idType === '身份证' ? '系统将自动识别性别和出生日期' : '请输入证件号码'}
                  />
                  {form.idType === '身份证' && (
                    <span className="field-hint">示例：身份证格式为18位数字</span>
                  )}
                </div>
                <div className="form-field-enhanced">
                  <label>
                    出生日期 <span className="required-mark">*</span>
                    {autoFilledFromID && <span className="auto-detected-badge">🤖 自动识别</span>}
                  </label>
                  <input type="date" value={form.birthDate} onChange={setField('birthDate')} />
                </div>
                <div className="form-field-enhanced">
                  <label>联系电话</label>
                  <input value={form.phone} onChange={setField('phone')} placeholder="11位手机号码" />
                </div>
                <div className="form-field-enhanced">
                  <label>籍贯</label>
                  <input value={form.nativePlace} onChange={setField('nativePlace')} placeholder="省/市/县" />
                </div>
                <div className="form-field-enhanced" style={{ gridColumn: '1 / -1' }}>
                  <label>家庭地址 <span className="required-mark">*</span></label>
                  <input value={form.address} onChange={setField('address')} placeholder="详细地址" />
                </div>
              </div>
            </>
          )}

          {currentStep === 'contact' && (
            <>
              <div className="wizard-step-intro">
                <span className="wizard-intro-icon">👨‍👩‍👧‍👦</span>
                <span className="wizard-intro-text">请填写家庭联系人信息，至少填写一位联系人的姓名和电话</span>
              </div>
              <div className="form-grid">
                <div className="form-field-enhanced">
                  <label>父亲姓名</label>
                  <input value={form.fatherContactName} onChange={setField('fatherContactName')} />
                </div>
                <div className="form-field-enhanced">
                  <label>父亲电话</label>
                  <input value={form.fatherContactPhone} onChange={setField('fatherContactPhone')} />
                </div>
                <div className="form-field-enhanced" style={{ gridColumn: '1 / -1' }}>
                  <label>父亲备注</label>
                  <input value={form.fatherInfo} onChange={setField('fatherInfo')} placeholder="可选，填写其他说明信息" />
                </div>

                <div className="form-field-enhanced">
                  <label>母亲姓名</label>
                  <input value={form.motherContactName} onChange={setField('motherContactName')} />
                </div>
                <div className="form-field-enhanced">
                  <label>母亲电话</label>
                  <input value={form.motherContactPhone} onChange={setField('motherContactPhone')} />
                </div>
                <div className="form-field-enhanced" style={{ gridColumn: '1 / -1' }}>
                  <label>母亲备注</label>
                  <input value={form.motherInfo} onChange={setField('motherInfo')} placeholder="可选，填写其他说明信息" />
                </div>

                <div className="form-field-enhanced">
                  <label>监护人</label>
                  <input value={form.guardianContactName} onChange={setField('guardianContactName')} />
                </div>
                <div className="form-field-enhanced">
                  <label>监护人电话</label>
                  <input value={form.guardianContactPhone} onChange={setField('guardianContactPhone')} />
                </div>
                <div className="form-field-enhanced" style={{ gridColumn: '1 / -1' }}>
                  <label>监护人备注</label>
                  <input value={form.guardianInfo} onChange={setField('guardianInfo')} placeholder="可选，填写其他说明信息" />
                </div>

                <div className="form-field-enhanced">
                  <label>备用联系人</label>
                  <input value={form.backupContact} onChange={setField('backupContact')} />
                </div>
                <div className="form-field-enhanced">
                  <label>备用联系人电话</label>
                  <input value={form.backupPhone} onChange={setField('backupPhone')} />
                </div>
              </div>
            </>
          )}

          {currentStep === 'review' && (
            <>
              <div className="wizard-step-intro">
                <span className="wizard-intro-icon">🔍</span>
                <span className="wizard-intro-text">请仔细核对以下信息，确认无误后提交创建住户档案</span>
              </div>
              <div className="wizard-review-section">
                <h3 className="wizard-review-title">信息核对</h3>
                <div className="wizard-review-grid">
                  <div className="wizard-review-group">
                    <h4 className="wizard-review-group-title">👤 基础身份</h4>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">姓名：</span>
                      <span className="wizard-review-value">{form.patientName || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">性别：</span>
                      <span className="wizard-review-value">{form.gender || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">证件类型：</span>
                      <span className="wizard-review-value">{form.idType || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">证件号码：</span>
                      <span className="wizard-review-value">{form.idNumber || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">出生日期：</span>
                      <span className="wizard-review-value">{form.birthDate || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">联系电话：</span>
                      <span className="wizard-review-value">{form.phone || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">籍贯：</span>
                      <span className="wizard-review-value">{form.nativePlace || '-'}</span>
                    </div>
                    <div className="wizard-review-item">
                      <span className="wizard-review-label">家庭地址：</span>
                      <span className="wizard-review-value">{form.address || '-'}</span>
                    </div>
                  </div>
                  <div className="wizard-review-group">
                    <h4 className="wizard-review-group-title">📞 联系人</h4>
                    {form.fatherContactName && (
                      <div className="wizard-review-item">
                        <span className="wizard-review-label">父亲：</span>
                        <span className="wizard-review-value">
                          {form.fatherContactName} {form.fatherContactPhone && `(${form.fatherContactPhone})`}
                        </span>
                      </div>
                    )}
                    {form.motherContactName && (
                      <div className="wizard-review-item">
                        <span className="wizard-review-label">母亲：</span>
                        <span className="wizard-review-value">
                          {form.motherContactName} {form.motherContactPhone && `(${form.motherContactPhone})`}
                        </span>
                      </div>
                    )}
                    {form.guardianContactName && (
                      <div className="wizard-review-item">
                        <span className="wizard-review-label">监护人：</span>
                        <span className="wizard-review-value">
                          {form.guardianContactName} {form.guardianContactPhone && `(${form.guardianContactPhone})`}
                        </span>
                      </div>
                    )}
                    {form.backupContact && (
                      <div className="wizard-review-item">
                        <span className="wizard-review-label">备用联系人：</span>
                        <span className="wizard-review-value">
                          {form.backupContact} {form.backupPhone && `(${form.backupPhone})`}
                        </span>
                      </div>
                    )}
                    {!form.fatherContactName && !form.motherContactName && !form.guardianContactName && !form.backupContact && (
                      <div className="wizard-review-item">
                        <span className="wizard-review-value" style={{ color: 'var(--color-text-tertiary)' }}>暂无联系人信息</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="form-field-enhanced">
                <label>入住时间 <span className="required-mark">*</span></label>
                <input type="date" value={form.admissionDate} onChange={setField('admissionDate')} />
                <span className="field-hint">请选择住户实际入住的日期</span>
              </div>
              {errors.review && (
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  background: '#fef2f2',
                  border: '2px solid var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-danger)',
                  fontWeight: 'var(--font-medium)',
                  marginTop: 'var(--space-4)'
                }}>
                  ⚠️ {errors.review}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="wizard-actions">
        <button
          className="btn-enhanced btn-secondary"
          onClick={prev}
          disabled={stepIndex === 0}
        >
          ← 上一步
        </button>
        {currentStep !== 'review' ? (
          <button className="btn-enhanced btn-primary" onClick={next}>
            下一步 →
          </button>
        ) : (
          <button
            className="btn-enhanced btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '✓ 提交并创建'}
          </button>
        )}
      </div>
    </div>
  );
};

export default IntakeWizardPage;
