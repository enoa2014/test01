import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPatient, fetchPatientDetail, updatePatient } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientFormPayload, PatientDetail } from '../types/patient';

type FormMode = 'create' | 'edit';

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

const mapDetailToForm = (detail: PatientDetail): FormState => {
  const patient = (detail && detail.patient) || {};
  return {
    ...DEFAULT_FORM,
    patientName: String(patient.patientName || ''),
    gender: String(patient.gender || ''),
    birthDate: formatDateForInput((patient as Record<string, unknown>).birthDate as string),
    nativePlace: String((patient as Record<string, unknown>).nativePlace || ''),
    ethnicity: String((patient as Record<string, unknown>).ethnicity || ''),
    idType: String((patient as Record<string, unknown>).idType || ''),
    idNumber: String((patient as Record<string, unknown>).idNumber || ''),
    phone: String((patient as Record<string, unknown>).phone || ''),
    address: String((patient as Record<string, unknown>).address || ''),
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

const PatientFormPage: React.FC<{ mode?: FormMode }> = ({ mode = 'create' }) => {
  const isCreate = mode === 'create';
  const { patientKey = '' } = useParams();
  const navigate = useNavigate();
  const { app, user } = useCloudbase();

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState<boolean>(!isCreate);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isCreate) {
      setLoading(false);
      return;
    }
    if (!app || !patientKey) {
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
  }, [app, isCreate, patientKey]);

  const isAdmin = useMemo(() => user?.role === 'admin', [user]);

  useEffect(() => {
    if (!isAdmin) {
      setError('当前账号无权限编辑住户资料');
    }
  }, [isAdmin]);

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
      return '请填写籍贯或常住地址';
    }
    return null;
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async event => {
    event.preventDefault();
    if (!app) {
      setError('CloudBase 未初始化');
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
      if (isCreate) {
        const result = await createPatient(app, payload);
        setMessage('创建成功');
        navigate(`/patients/${encodeURIComponent(result.patientKey || '')}`, { replace: true });
      } else {
        await updatePatient(app, patientKey, payload);
        setMessage('已保存住户资料');
        navigate(`/patients/${encodeURIComponent(patientKey)}`, { replace: true });
      }
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
    <div className="card" style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{isCreate ? '新增住户' : '编辑住户资料'}</h2>
        <button className="secondary-button" onClick={handleCancel}>
          返回
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {message && <p className="success-text">{message}</p>}

      {loading ? (
        <p>住户信息加载中...</p>
      ) : (
        <form className="form" onSubmit={handleSubmit}>
          <section className="form-section">
            <h3>基础信息</h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="patientName">姓名 *</label>
                <input
                  id="patientName"
                  type="text"
                  value={form.patientName}
                  onChange={handleChange('patientName')}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="gender">性别 *</label>
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
              <div className="form-field">
                <label htmlFor="birthDate">出生日期</label>
                <input
                  id="birthDate"
                  type="date"
                  value={form.birthDate || ''}
                  onChange={handleChange('birthDate')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="nativePlace">籍贯</label>
                <input
                  id="nativePlace"
                  type="text"
                  value={form.nativePlace || ''}
                  onChange={handleChange('nativePlace')}
                  placeholder="省/市/县"
                />
              </div>
              <div className="form-field">
                <label htmlFor="address">常住地址</label>
                <input
                  id="address"
                  type="text"
                  value={form.address || ''}
                  onChange={handleChange('address')}
                  placeholder="详细地址"
                />
              </div>
              <div className="form-field">
                <label htmlFor="ethnicity">民族</label>
                <input
                  id="ethnicity"
                  type="text"
                  value={form.ethnicity || ''}
                  onChange={handleChange('ethnicity')}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>身份与联系方式</h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="idNumber">证件号码</label>
                <input
                  id="idNumber"
                  type="text"
                  value={form.idNumber || ''}
                  onChange={handleChange('idNumber')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="phone">联系电话</label>
                <input
                  id="phone"
                  type="tel"
                  value={form.phone || ''}
                  onChange={handleChange('phone')}
                  placeholder="11 位手机号码"
                />
              </div>
              <div className="form-field">
                <label htmlFor="backupContact">备用联系人</label>
                <input
                  id="backupContact"
                  type="text"
                  value={form.backupContact || ''}
                  onChange={handleChange('backupContact')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="backupPhone">备用联系人电话</label>
                <input
                  id="backupPhone"
                  type="tel"
                  value={form.backupPhone || ''}
                  onChange={handleChange('backupPhone')}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>家庭联系人</h3>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="fatherContactName">父亲姓名</label>
                <input
                  id="fatherContactName"
                  type="text"
                  value={form.fatherContactName || ''}
                  onChange={handleChange('fatherContactName')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="fatherContactPhone">父亲电话</label>
                <input
                  id="fatherContactPhone"
                  type="tel"
                  value={form.fatherContactPhone || ''}
                  onChange={handleChange('fatherContactPhone')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="motherContactName">母亲姓名</label>
                <input
                  id="motherContactName"
                  type="text"
                  value={form.motherContactName || ''}
                  onChange={handleChange('motherContactName')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="motherContactPhone">母亲电话</label>
                <input
                  id="motherContactPhone"
                  type="tel"
                  value={form.motherContactPhone || ''}
                  onChange={handleChange('motherContactPhone')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="guardianContactName">监护人</label>
                <input
                  id="guardianContactName"
                  type="text"
                  value={form.guardianContactName || ''}
                  onChange={handleChange('guardianContactName')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="guardianContactPhone">监护人电话</label>
                <input
                  id="guardianContactPhone"
                  type="tel"
                  value={form.guardianContactPhone || ''}
                  onChange={handleChange('guardianContactPhone')}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h3>状态与备注</h3>
            <div className="form-grid">
              <div className="form-field">
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
              <div className="form-field">
                <label htmlFor="checkoutAt">退住时间</label>
                <input
                  id="checkoutAt"
                  type="date"
                  value={form.checkoutAt || ''}
                  onChange={handleChange('checkoutAt')}
                  disabled={form.careStatus !== 'discharged'}
                />
              </div>
              <div className="form-field">
                <label htmlFor="checkoutReason">退住原因</label>
                <input
                  id="checkoutReason"
                  type="text"
                  value={form.checkoutReason || ''}
                  onChange={handleChange('checkoutReason')}
                />
              </div>
              <div className="form-field">
                <label htmlFor="summaryCaregivers">主要照护人</label>
                <input
                  id="summaryCaregivers"
                  type="text"
                  value={form.summaryCaregivers || ''}
                  onChange={handleChange('summaryCaregivers')}
                />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="checkoutNote">备注</label>
              <textarea
                id="checkoutNote"
                rows={3}
                value={form.checkoutNote || ''}
                onChange={handleChange('checkoutNote')}
              />
            </div>
          </section>

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={submitting || !isAdmin}>
              {submitting ? '保存中...' : '保存'}
            </button>
            <button className="secondary-button" type="button" onClick={handleCancel}>
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PatientFormPage;
