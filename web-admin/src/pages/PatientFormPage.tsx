import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPatientDetail, updatePatient } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientFormPayload, PatientDetail } from '../types/patient';

type FormState = PatientFormPayload & {
  checkoutAt?: string;
};

const DEFAULT_FORM: FormState = {
  patientName: '',
  gender: '',
  birthDate: '',
  nativePlace: '',
  ethnicity: '',
  idType: '',
  idNumber: '',
  phone: '',
  address: '',
  backupContact: '',
  backupPhone: '',
  fatherContactName: '',
  fatherContactPhone: '',
  motherContactName: '',
  motherContactPhone: '',
  guardianContactName: '',
  guardianContactPhone: '',
  summaryCaregivers: '',
  careStatus: 'in_care',
  checkoutAt: '',
  checkoutReason: '',
  checkoutNote: '',
};

const formatDateForInput = (value?: string | number | null): string => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  }
  const normalized = String(value).replace(/[./]/g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split('-');
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
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
  const patient = (detail && detail.patient) || {};
  const basicInfo = detail && (detail.basicInfo as Array<{ label: string; value: string }>) || [];
  const familyInfo = detail && (detail.familyInfo as Array<{ label: string; value: string }>) || [];

  const genderFromBasic = valueByLabel(basicInfo, '性别');
  const birthDateFromBasic = valueByLabel(basicInfo, '出生日期');
  const idNumberFromBasic = valueByLabel(basicInfo, '身份证号');
  const nativePlaceFromBasic = valueByLabel(basicInfo, '籍贯');
  const ethnicityFromBasic = valueByLabel(basicInfo, '民族');
  const addressFromFamily = valueByLabel(familyInfo, '家庭地址');
  return {
    ...DEFAULT_FORM,
    patientName: String(patient.patientName || ''),
    gender: String(genderFromBasic || (patient as Record<string, unknown>).gender || ''),
    birthDate: formatDateForInput(birthDateFromBasic || ((patient as Record<string, unknown>).birthDate as string)),
    nativePlace: String(nativePlaceFromBasic || (patient as Record<string, unknown>).nativePlace || ''),
    ethnicity: String(ethnicityFromBasic || (patient as Record<string, unknown>).ethnicity || ''),
    idType: String((patient as Record<string, unknown>).idType || ''),
    idNumber: String(idNumberFromBasic || (patient as Record<string, unknown>).idNumber || ''),
    phone: String((patient as Record<string, unknown>).phone || ''),
    address: String(addressFromFamily || (patient as Record<string, unknown>).address || ''),
    backupContact: String((patient as Record<string, unknown>).backupContact || ''),
    backupPhone: String((patient as Record<string, unknown>).backupPhone || ''),
    fatherContactName: String((patient as Record<string, unknown>).fatherContactName || ''),
    fatherContactPhone: String((patient as Record<string, unknown>).fatherContactPhone || ''),
    motherContactName: String((patient as Record<string, unknown>).motherContactName || ''),
    motherContactPhone: String((patient as Record<string, unknown>).motherContactPhone || ''),
    guardianContactName: String((patient as Record<string, unknown>).guardianContactName || ''),
    guardianContactPhone: String((patient as Record<string, unknown>).guardianContactPhone || ''),
    summaryCaregivers: String((patient as Record<string, unknown>).summaryCaregivers || ''),
    careStatus: String((patient as Record<string, unknown>).careStatus || 'in_care'),
    checkoutAt: formatDateForInput((patient as Record<string, unknown>).checkoutAt as string),
    checkoutReason: String((patient as Record<string, unknown>).checkoutReason || ''),
    checkoutNote: String((patient as Record<string, unknown>).checkoutNote || ''),
  };
};

const normalizePayload = (form: FormState): PatientFormPayload => ({
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

/**
 * PatientFormPage - 住户编辑页面
 * 仅用于编辑现有住户资料，不支持创建新住户
 * 创建新住户请使用 IntakeWizardPage
 */
const PatientFormPage: React.FC = () => {
  const { patientKey = '' } = useParams();
  const navigate = useNavigate();
  const { app } = useCloudbase();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!app || !patientKey) {
      setError('缺少住户标识');
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchPatientDetail(app, patientKey)
      .then(detail => {
        if (!mounted) {
          return;
        }
        setForm(mapDetailToForm(detail));
        setLoading(false);
      })
      .catch(err => {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : '加载住户资料失败');
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [app, patientKey]);

  // 所有登录用户同权限：不再区分管理员

  const handleChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm(prev => ({ ...prev, [field]: value }));
    };

  const validateForm = (): string | null => {
    const name = form.patientName.trim();
    const gender = form.gender.trim();
    const hasId = !!form.idNumber?.trim();
    const hasPhone = !!form.phone?.trim() || !!form.backupPhone?.trim();
    const hasLocation = !!form.nativePlace?.trim() || !!form.address?.trim();

    if (!name) {
      return '请填写住户姓名';
    }
    if (!gender) {
      return '请选择性别';
    }
    if (!hasId && !hasPhone) {
      return '请至少填写证件号或一条联系电话';
    }
    if (!hasLocation) {
      return '请填写籍贯或家庭地址';
    }
    return null;
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    if (!app) {
      setError('CloudBase 未初始化');
      return;
    }
    if (!patientKey) {
      setError('缺少住户标识');
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const payload = normalizePayload(form);
    try {
      await updatePatient(app, patientKey, payload);
      setMessage('已保存住户资料');
      navigate(`/patients/${encodeURIComponent(patientKey)}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <div className="form-card-container">
      {/* 页面头部 */}
      <div className="page-header">
        <h1 className="page-title">编辑住户资料</h1>
        <button className="btn-enhanced btn-secondary" onClick={handleCancel}>
          ← 返回
        </button>
      </div>

      {error && <p className="error-text" style={{ textAlign: 'center', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>{error}</p>}
      {message && <p className="success-text" style={{ textAlign: 'center', padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>{message}</p>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-secondary)' }}>
          住户信息加载中...
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* 基础信息卡片 */}
          <div className="form-card form-card--basic">
            <div className="form-card-header">
              <span className="form-card-icon">👤</span>
              <h3 className="form-card-title">住户基本信息</h3>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-field-enhanced">
                  <label htmlFor="patientName">
                    姓名 <span className="required-mark">*</span>
                  </label>
                  <input
                    id="patientName"
                    type="text"
                    value={form.patientName}
                    onChange={handleChange('patientName')}
                    required
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="gender">
                    性别 <span className="required-mark">*</span>
                  </label>
                  <select
                    id="gender"
                    value={form.gender}
                    onChange={handleChange('gender')}
                    required
                  >
                    <option value="">请选择</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="birthDate">出生日期</label>
                  <input
                    id="birthDate"
                    type="date"
                    value={form.birthDate || ''}
                    onChange={handleChange('birthDate')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="nativePlace">籍贯</label>
                  <input
                    id="nativePlace"
                    type="text"
                    value={form.nativePlace || ''}
                    onChange={handleChange('nativePlace')}
                    placeholder="省/市/县"
                  />
                </div>
                <div className="form-field-enhanced" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="address">家庭地址</label>
                  <input
                    id="address"
                    type="text"
                    value={form.address || ''}
                    onChange={handleChange('address')}
                    placeholder="详细地址"
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="ethnicity">民族</label>
                  <input
                    id="ethnicity"
                    type="text"
                    value={form.ethnicity || ''}
                    onChange={handleChange('ethnicity')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 身份与联系方式卡片 */}
          <div className="form-card form-card--contact">
            <div className="form-card-header">
              <span className="form-card-icon">📝</span>
              <h3 className="form-card-title">身份与联系方式</h3>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-field-enhanced">
                  <label htmlFor="idType">证件类型</label>
                  <select
                    id="idType"
                    value={form.idType || '身份证'}
                    onChange={handleChange('idType')}
                  >
                    <option value="身份证">身份证</option>
                    <option value="护照">护照</option>
                    <option value="军官证">军官证</option>
                    <option value="其他">其他</option>
                  </select>
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="idNumber">证件号码</label>
                  <input
                    id="idNumber"
                    type="text"
                    value={form.idNumber || ''}
                    onChange={handleChange('idNumber')}
                  />
                  <span className="field-hint">示例：身份证格式为18位数字</span>
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="phone">联系电话</label>
                  <input
                    id="phone"
                    type="tel"
                    value={form.phone || ''}
                    onChange={handleChange('phone')}
                    placeholder="11 位手机号码"
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="backupContact">备用联系人</label>
                  <input
                    id="backupContact"
                    type="text"
                    value={form.backupContact || ''}
                    onChange={handleChange('backupContact')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="backupPhone">备用联系人电话</label>
                  <input
                    id="backupPhone"
                    type="tel"
                    value={form.backupPhone || ''}
                    onChange={handleChange('backupPhone')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 家庭联系人卡片 */}
          <div className="form-card form-card--family">
            <div className="form-card-header">
              <span className="form-card-icon">👨‍👩‍👧‍👦</span>
              <h3 className="form-card-title">家庭联系人</h3>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-field-enhanced">
                  <label htmlFor="fatherContactName">父亲姓名</label>
                  <input
                    id="fatherContactName"
                    type="text"
                    value={form.fatherContactName || ''}
                    onChange={handleChange('fatherContactName')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="fatherContactPhone">父亲电话</label>
                  <input
                    id="fatherContactPhone"
                    type="tel"
                    value={form.fatherContactPhone || ''}
                    onChange={handleChange('fatherContactPhone')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="motherContactName">母亲姓名</label>
                  <input
                    id="motherContactName"
                    type="text"
                    value={form.motherContactName || ''}
                    onChange={handleChange('motherContactName')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="motherContactPhone">母亲电话</label>
                  <input
                    id="motherContactPhone"
                    type="tel"
                    value={form.motherContactPhone || ''}
                    onChange={handleChange('motherContactPhone')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="guardianContactName">监护人</label>
                  <input
                    id="guardianContactName"
                    type="text"
                    value={form.guardianContactName || ''}
                    onChange={handleChange('guardianContactName')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="guardianContactPhone">监护人电话</label>
                  <input
                    id="guardianContactPhone"
                    type="tel"
                    value={form.guardianContactPhone || ''}
                    onChange={handleChange('guardianContactPhone')}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 状态与备注卡片 */}
          <div className="form-card form-card--status">
            <div className="form-card-header">
              <span className="form-card-icon">📋</span>
              <h3 className="form-card-title">状态与备注</h3>
            </div>
            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-field-enhanced">
                  <label htmlFor="careStatus">在住状态</label>
                  <select
                    id="careStatus"
                    value={form.careStatus || 'in_care'}
                    onChange={handleChange('careStatus')}
                  >
                    <option value="in_care">在住</option>
                    <option value="discharged">已退住</option>
                  </select>
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="checkoutAt">退住时间</label>
                  <input
                    id="checkoutAt"
                    type="date"
                    value={form.checkoutAt || ''}
                    onChange={handleChange('checkoutAt')}
                    disabled={form.careStatus !== 'discharged'}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="checkoutReason">退住原因</label>
                  <input
                    id="checkoutReason"
                    type="text"
                    value={form.checkoutReason || ''}
                    onChange={handleChange('checkoutReason')}
                  />
                </div>
                <div className="form-field-enhanced">
                  <label htmlFor="summaryCaregivers">主要照护人</label>
                  <input
                    id="summaryCaregivers"
                    type="text"
                    value={form.summaryCaregivers || ''}
                    onChange={handleChange('summaryCaregivers')}
                  />
                </div>
              </div>
              <div className="form-field-enhanced">
                <label htmlFor="checkoutNote">备注</label>
                <textarea
                  id="checkoutNote"
                  rows={3}
                  value={form.checkoutNote || ''}
                  onChange={handleChange('checkoutNote')}
                  placeholder="可选，填写其他说明信息"
                />
              </div>
            </div>
          </div>

          {/* 表单操作 */}
          <div className="form-actions-enhanced">
            <button
              className="btn-enhanced btn-secondary"
              type="button"
              onClick={handleCancel}
            >
              取消
            </button>
            <button
              className="btn-enhanced btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? '保存中...' : '💾 保存'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PatientFormPage;
