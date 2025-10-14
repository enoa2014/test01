import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPatientDetail } from '../api/patient';
import { getAllIntakeRecords, getPatientIntakeDetail } from '../api/intake';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientDetail } from '../types/patient';
import MediaManager from '../components/MediaManager';
import EditModuleDialog from '../components/EditModuleDialog';

// 定义状态选项
const STATUS_OPTIONS = [
  { id: 'in_care', label: '在住' },
  { id: 'pending', label: '待入住' },
  { id: 'discharged', label: '已离开' },
];

// 状态样式映射
const STATUS_STYLES: Record<string, { label: string; bgColor: string; textColor: string }> = {
  in_care: { label: '在住', bgColor: '#ecfdf5', textColor: '#10b981' },
  pending: { label: '待入住', bgColor: '#fffbeb', textColor: '#f59e0b' },
  discharged: { label: '已离开', bgColor: '#f9fafb', textColor: '#6b7280' },
  followup: { label: '随访', bgColor: '#eff6ff', textColor: '#2563eb' },
  unknown: { label: '未知', bgColor: '#f3f4f6', textColor: '#6b7280' },
};

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

// 格式化时间戳为显示文本
const formatDateTime = (ts: number | null | undefined): string => {
  if (!ts || !Number.isFinite(ts)) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 规范化入住记录数据
const normalizeIntakeRecord = (record: any) => {
  if (!record) return null;

  const intakeTime = Number(record.intakeTime || 0);
  const checkoutAt = Number(record.checkoutAt || 0);

  // 计算离开时间显示文本
  let checkoutDisplay = '未离开';
  if (Number.isFinite(checkoutAt) && checkoutAt > 0) {
    checkoutDisplay = formatDateTime(checkoutAt);
  }

  // 计算时长显示
  let durationDisplay = '';
  if (Number.isFinite(intakeTime) && Number.isFinite(checkoutAt) && checkoutAt > intakeTime) {
    const DAY = 24 * 60 * 60 * 1000;
    const HOUR = 60 * 60 * 1000;
    const diff = checkoutAt - intakeTime;
    if (diff >= DAY) {
      const days = Math.floor(diff / DAY);
      durationDisplay = `${days}天`;
    } else {
      const hours = Math.max(1, Math.ceil(diff / HOUR));
      durationDisplay = `${hours}小时`;
    }
  }

  return {
    ...record,
    intakeTime,
    displayTime: formatDateTime(intakeTime),
    checkoutAt: Number.isFinite(checkoutAt) && checkoutAt > 0 ? checkoutAt : null,
    checkoutDisplay,
    durationDisplay,
    hospitalDisplay: record.hospital || record.hospitalDisplay || '',
    diagnosisDisplay: record.diagnosis || record.diagnosisDisplay || '',
    doctorDisplay: record.doctor || record.doctorDisplay || '',
    symptomDetailDisplay: record.symptoms || record.symptomDetailDisplay || '',
    treatmentProcessDisplay: record.treatmentProcess || record.treatmentProcessDisplay || '',
    followUpPlanDisplay: record.followUpPlan || record.followUpPlanDisplay || '',
  };
};

const PatientDetailPage: React.FC = () => {
  const { patientKey = '' } = useParams();
  const navigate = useNavigate();
  const { app } = useCloudbase();
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 分模块编辑状态
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editBlock, setEditBlock] = useState<'basic' | 'contact' | 'economic'>('basic');
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});

  // 状态调整对话框
  const [statusDialogVisible, setStatusDialogVisible] = useState(false);
  const [statusDialogSubmitting, setStatusDialogSubmitting] = useState(false);
  const [statusForm, setStatusForm] = useState({ value: '', note: '' });

  // 入住记录编辑对话框
  const [recordDialogVisible, setRecordDialogVisible] = useState(false);
  const [recordDialogSubmitting, setRecordDialogSubmitting] = useState(false);
  const [recordForm, setRecordForm] = useState({
    id: '',
    intakeDate: '',
    intakeTime: '',
    checkoutDate: '',
    checkoutTime: '',
    hospital: '',
    diagnosis: '',
    doctor: '',
    symptoms: '',
    treatmentProcess: '',
    followUpPlan: '',
  });

  // 入住记录排序
  const [recordsSortOrder, setRecordsSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRecords, setExpandedRecords] = useState<Record<string, boolean>>({});

  // 操作日志折叠
  const [operationLogsCollapsed, setOperationLogsCollapsed] = useState(true);

  // 即时反馈
  const [toast, setToast] = useState<{ visible: boolean; text: string; type: 'success' | 'error' }>({
    visible: false,
    text: '',
    type: 'success',
  });

  // Toast 显示
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, text, type });
    setTimeout(() => {
      setToast({ visible: false, text: '', type: 'success' });
    }, 2000);
  };

  // 统一加载并规范化详情（含入住记录展示字段）
  const loadDetail = async (silent = false) => {
    if (!app || !patientKey) {
      if (!silent) setError('CloudBase 未初始化');
      return null;
    }
    try {
      // 并行获取：profile 详情 + intake 详情 + 全量入住记录
      let profileResult: PatientDetail | null = null;
      try {
        profileResult = await fetchPatientDetail(app, patientKey);
      } catch (e) {
        profileResult = null;
      }

      let intakeData: any = null;
      try {
        intakeData = await getPatientIntakeDetail(app, patientKey);
      } catch (e) {
        intakeData = null;
      }

      let allRecords: any[] = [];
      try {
        allRecords = await getAllIntakeRecords(app, patientKey);
      } catch (e) {
        allRecords = [];
      }

      const profileRecords = Array.isArray(profileResult?.records) ? profileResult!.records : [];
      const normalizedRecords = (allRecords.length ? allRecords : profileRecords)
        .map(rec => normalizeIntakeRecord(rec))
        .filter(Boolean) as any[];

      // 合并 patient 字段（intake 优先覆盖），并挂入操作日志
      const patientFromProfile = (profileResult && profileResult.patient) || {};
      const patientFromIntake = (intakeData && intakeData.patient) || {};
      const mergedPatient: any = { ...patientFromProfile, ...patientFromIntake };
      if (Array.isArray(intakeData?.operationLogs)) {
        mergedPatient.operationLogs = intakeData.operationLogs.map((log: any) => ({
          ...(log || {}),
          timeText: log && log.createdAt ? new Date(log.createdAt).toLocaleString() : '',
        }));
      }

      // 若 profile 的信息列表为空，则依据 intake.patient 补齐
      const buildInfoList = (pairs: Array<{ label: string; value: any }>) =>
        pairs
          .map(({ label, value }) => ({ label, value: value == null ? '' : String(value) }))
          .filter(item => item.value);

      let basicInfo = (profileResult && profileResult.basicInfo) && profileResult.basicInfo.length
        ? profileResult.basicInfo
        : buildInfoList([
            { label: '性别', value: mergedPatient.gender },
            { label: '出生日期', value: mergedPatient.birthDate },
            { label: '身份证号', value: mergedPatient.idNumber },
            { label: '籍贯', value: mergedPatient.nativePlace },
            { label: '民族', value: mergedPatient.ethnicity },
            { label: '联系电话', value: mergedPatient.phone },
          ]);

      const familyInfo = (profileResult && profileResult.familyInfo) && profileResult.familyInfo.length
        ? profileResult.familyInfo
        : buildInfoList([
            { label: '家庭地址', value: mergedPatient.address },
            { label: '父亲联系方式', value: mergedPatient.fatherInfo },
            { label: '母亲联系方式', value: mergedPatient.motherInfo },
            { label: '其他监护人', value: mergedPatient.otherGuardian || mergedPatient.guardianInfo },
          ]);

      const economicInfo = (profileResult && profileResult.economicInfo) && profileResult.economicInfo.length
        ? profileResult.economicInfo
        : buildInfoList([{ label: '家庭经济情况', value: mergedPatient.familyEconomy }]);
      // 派生 careStatus：若后端未提供或非法，则按 checkoutAt/最近入住时间推导
      const ALLOWED = new Set(['in_care', 'pending', 'discharged']);
      const now = Date.now();
      const normalizeStatus = (v?: any) => (typeof v === 'string' ? v.trim() : '');
      const deriveCareStatus = (): string => {
        const p = mergedPatient || ({} as any);
        const checkoutAt = Number((p && p.checkoutAt) || 0);
        if (Number.isFinite(checkoutAt) && checkoutAt > 0) return 'discharged';
        // 优先 patient.latestAdmissionTimestamp；否则从记录里取最大 intakeTime
        const latestFromPatient = Number((p && (p.latestAdmissionTimestamp as any)) || 0);
        const latestFromRecords = normalizedRecords.reduce((max, r: any) => {
          const ts = Number(r && r.intakeTime);
          return Number.isFinite(ts) && ts > max ? ts : max;
        }, 0);
        const latestTs = Number.isFinite(latestFromPatient) && latestFromPatient > 0
          ? latestFromPatient
          : latestFromRecords;
        if (!Number.isFinite(latestTs) || latestTs <= 0) return 'pending';
        if (latestTs > now) return 'pending';
        const diffDays = Math.floor((now - latestTs) / (24 * 60 * 60 * 1000));
        if (diffDays <= 30) return 'in_care';
        if (diffDays <= 90) return 'pending';
        return 'discharged';
      };

      const rawStatus = normalizeStatus(mergedPatient.careStatus);
      if (!ALLOWED.has(rawStatus)) {
        mergedPatient.careStatus = deriveCareStatus();
      }
      // admissionCount 与最近入住展示
      if (!Number.isFinite(Number(mergedPatient.admissionCount))) {
        mergedPatient.admissionCount = normalizedRecords.length;
      }
      if (Number.isFinite(Number(mergedPatient.latestAdmissionTimestamp))) {
        const d = new Date(Number(mergedPatient.latestAdmissionTimestamp));
        if (!Number.isNaN(d.getTime())) {
          mergedPatient.lastAdmissionTimeDisplay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        }
      }

      // 基础信息中追加四个手动维护字段（纯手动，不做任何联动/自动生成）
      {
        const extraItems = [
          { label: '就诊医院', value: mergedPatient.latestHospital || '' },
          { label: '确诊疾病', value: mergedPatient.latestDiagnosis || '' },
          { label: '确诊时间', value: mergedPatient.confirmedDate || '' },
          { label: '目前治疗阶段', value: mergedPatient.treatmentStage || '' },
        ];
        const existingLabels = new Set((basicInfo || []).map((it: any) => (it && it.label) || ''));
        const mergedList = [...(basicInfo || [])];
        for (const item of extraItems) {
          if (!existingLabels.has(item.label)) mergedList.push(item);
        }
        basicInfo = mergedList;
      }

      const merged: PatientDetail = {
        patient: mergedPatient,
        basicInfo,
        familyInfo,
        economicInfo,
        records: normalizedRecords,
      };
      setDetail(merged);
      return merged;
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : '加载详情失败');
      throw err;
    }
  };

  // 打开编辑对话框
  const handleEdit = (block: 'basic' | 'contact' | 'economic') => {
    const patient = detail?.patient || {};
    let form: Record<string, unknown> = {};

    if (block === 'basic') {
      form = {
        patientName: patient.patientName || '',
        gender: patient.gender || '',
        birthDate: formatDateForInput(patient.birthDate as string),
        idType: patient.idType || '身份证',
        idNumber: patient.idNumber || '',
        phone: patient.phone || '',
        nativePlace: patient.nativePlace || '',
        ethnicity: patient.ethnicity || '',
        // 手动维护的就诊相关字段
        latestHospital: (patient as any).latestHospital || '',
        latestDiagnosis: (patient as any).latestDiagnosis || '',
        confirmedDate: formatDateForInput((patient as any).confirmedDate as string),
        treatmentStage: (patient as any).treatmentStage || '',
      };
    } else if (block === 'contact') {
      const tryLabels = (labels: string[]) => {
        for (const lb of labels) {
          const v = valueByLabel(
            detail?.familyInfo as Array<{ label: string; value: string }> | undefined,
            lb
          );
          if (v) return v;
        }
        return '';
      };
      const addressFromFamily = tryLabels(['家庭地址', '地址', '家庭住址']);
      form = {
        address: addressFromFamily || (patient as Record<string, unknown>).address || '',
        fatherInfo: patient.fatherInfo || '',
        motherInfo: patient.motherInfo || '',
        guardianInfo: patient.guardianInfo || patient.otherGuardian || '',
      };
    } else if (block === 'economic') {
      form = {
        familyEconomy: patient.familyEconomy || '',
      };
    }

    setEditBlock(block);
    setEditForm(form);
    setEditDialogVisible(true);
  };

  // 保存编辑
  const handleSave = async (form: Record<string, unknown>) => {
    if (!app || !patientKey) {
      showToast('系统错误：无法保存', 'error');
      return;
    }

    try {
      // 调用 patientIntake 云函数的 updatePatient action
      const res = await app.callFunction({
        name: 'patientIntake',
        data: {
          action: 'updatePatient',
          patientKey,
          patientUpdates: form,
          audit: { message: `编辑资料: ${editBlock}` },
        },
      });

      const result = res.result as { success?: boolean; error?: { message?: string } };
      if (!result || result.success === false) {
        throw new Error(result?.error?.message || '保存失败');
      }

      // 重新拉取详情，确保展示数据与后端一致
      await loadDetail(true);
      setEditDialogVisible(false);
      showToast('保存成功', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
      throw err;
    }
  };

  // 状态调整
  const handleStatusChange = () => {
    const patient = detail?.patient || {};
    const currentStatus = patient.careStatus || 'pending';
    setStatusForm({ value: currentStatus, note: '' });
    setStatusDialogVisible(true);
  };

  const handleStatusConfirm = async () => {
    if (!app || !patientKey || !statusForm.value) {
      showToast('请选择状态', 'error');
      return;
    }

    setStatusDialogSubmitting(true);
    try {
      const res = await app.callFunction({
        name: 'patientIntake',
        data: {
          action: 'updateCareStatus',
          patientKey,
          status: statusForm.value,
          note: statusForm.note,
        },
      });

      const result = res.result as { success?: boolean; data?: any; error?: { message?: string } };
      if (!result || result.success === false) {
        throw new Error(result?.error?.message || '更新失败');
      }

      // 重新加载详情
      await loadDetail(true);
      setStatusDialogVisible(false);
      showToast('状态已更新', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '更新失败', 'error');
    } finally {
      setStatusDialogSubmitting(false);
    }
  };

  // 添加入住记录
  const handleAddRecord = () => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setRecordForm({
      id: '',
      intakeDate: dateStr,
      intakeTime: timeStr,
      checkoutDate: '',
      checkoutTime: '',
      hospital: '',
      diagnosis: '',
      doctor: '',
      symptoms: '',
      treatmentProcess: '',
      followUpPlan: '',
    });
    setRecordDialogVisible(true);
  };

  // 编辑入住记录
  const handleEditRecord = (record: any) => {
    const toDateStr = (ts: number | string) => {
      if (!ts) return '';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().slice(0, 10);
    };
    const toTimeStr = (ts: number | string) => {
      if (!ts) return '';
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const intakeTs = Number(record.intakeTime || 0);
    const checkoutTs = Number(record.checkoutAt || 0);

    setRecordForm({
      id: record.intakeId || record._id || '',
      intakeDate: intakeTs ? toDateStr(intakeTs) : '',
      intakeTime: intakeTs ? toTimeStr(intakeTs) : '',
      checkoutDate: checkoutTs ? toDateStr(checkoutTs) : '',
      checkoutTime: checkoutTs ? toTimeStr(checkoutTs) : '',
      hospital: record.hospital || record.hospitalDisplay || '',
      diagnosis: record.diagnosis || record.diagnosisDisplay || '',
      doctor: record.doctor || record.doctorDisplay || '',
      symptoms: record.symptoms || record.symptomDetailDisplay || '',
      treatmentProcess: record.treatmentProcess || record.treatmentProcessDisplay || '',
      followUpPlan: record.followUpPlan || record.followUpPlanDisplay || '',
    });
    setRecordDialogVisible(true);
  };

  // 保存入住记录
  const handleSaveRecord = async () => {
    if (!app || !patientKey) {
      showToast('系统错误：无法保存', 'error');
      return;
    }

    if (!recordForm.intakeDate) {
      showToast('请选择入住时间', 'error');
      return;
    }

    const toTs = (dateStr: string, timeStr: string) => {
      if (!dateStr) return null;
      const t = `${dateStr}T${timeStr || '00:00'}:00`;
      const ts = Date.parse(t);
      return isNaN(ts) ? null : ts;
    };

    const intakeTs = toTs(recordForm.intakeDate, recordForm.intakeTime);
    const checkoutTs = toTs(recordForm.checkoutDate, recordForm.checkoutTime);

    if (!intakeTs) {
      showToast('入住时间格式错误', 'error');
      return;
    }

    if (checkoutTs && checkoutTs < intakeTs) {
      showToast('离开时间不能早于入住时间', 'error');
      return;
    }

    setRecordDialogSubmitting(true);
    try {
      const res = await app.callFunction({
        name: 'patientIntake',
        data: {
          action: 'updateIntakeRecord',
          patientKey,
          intakeId: recordForm.id || undefined,
          intakeTime: intakeTs,
          checkoutAt: checkoutTs || undefined,
          hospital: recordForm.hospital,
          diagnosis: recordForm.diagnosis,
          doctor: recordForm.doctor,
          symptoms: recordForm.symptoms,
          treatmentProcess: recordForm.treatmentProcess,
          followUpPlan: recordForm.followUpPlan,
        },
      });

      const result = res.result as { success?: boolean; error?: { message?: string } };
      if (!result || result.success === false) {
        throw new Error(result?.error?.message || '保存失败');
      }

      // 重新加载详情
      await loadDetail(true);
      setRecordDialogVisible(false);
      showToast('已保存', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setRecordDialogSubmitting(false);
    }
  };

  // 删除入住记录
  const handleDeleteRecord = async (recordId: string) => {
    if (!app || !patientKey || !recordId) return;

    if (!window.confirm('删除后不可恢复，是否继续？')) return;

    try {
      const res = await app.callFunction({
        name: 'patientIntake',
        data: {
          action: 'deleteIntakeRecord',
          patientKey,
          intakeId: recordId,
        },
      });

      const result = res.result as { success?: boolean; error?: { message?: string } };
      if (!result || result.success === false) {
        throw new Error(result?.error?.message || '删除失败');
      }

      // 重新加载详情
      await loadDetail(true);
      showToast('已删除', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败', 'error');
    }
  };

  // 切换排序
  const toggleSortOrder = () => {
    setRecordsSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
  };

  // 切换记录展开
  const toggleRecordExpand = (recordId: string) => {
    setExpandedRecords(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  useEffect(() => {
    if (!app) {
      setError('CloudBase 未初始化');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadDetail(false)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [app, patientKey]);

  const patient = detail?.patient || {};
  const patientName = patient.patientName || '未命名';
  const careStatus = patient.careStatus || 'pending';
  const badges = Array.isArray(patient.badges) ? patient.badges : [];
  const admissionCount = patient.admissionCount || 0;
  const lastAdmissionTimeDisplay = patient.lastAdmissionTimeDisplay || '';
  const statusStyle = STATUS_STYLES[careStatus] || STATUS_STYLES.unknown;

  // 对入住记录排序
  const sortedRecords = React.useMemo(() => {
    if (!detail?.records) return [];
    const records = [...detail.records];
    records.sort((a, b) => {
      const timeA = Number(a.intakeTime || 0);
      const timeB = Number(b.intakeTime || 0);
      return recordsSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
    return records;
  }, [detail?.records, recordsSortOrder]);

  // 操作日志
  const operationLogs = detail?.patient?.operationLogs || [];

  const renderInfoList = (
    title: string,
    items?: Array<{ label: string; value: string }>,
    editBlock?: 'basic' | 'contact' | 'economic'
  ) => {
    if (!items || items.length === 0) {
      return null;
    }
    return (
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h3 style={{
            fontSize: 18,
            fontWeight: 700,
            margin: 0,
            color: '#1f2937',
            letterSpacing: '-0.3px'
          }}>{title}</h3>
          {editBlock && (
            <button
              className="link-button"
              onClick={() => handleEdit(editBlock)}
              style={{
                fontSize: 14,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>✏️</span> 编辑
            </button>
          )}
        </div>
        <div style={{
          display: 'grid',
          gap: 16,
          backgroundColor: '#ffffff',
          padding: 20,
          borderRadius: 12,
          border: '2px solid #f3f4f6',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
        }}>
          {items.map(item => (
            <div key={item.label} style={{
              display: 'flex',
              alignItems: 'flex-start',
              paddingBottom: 12,
              borderBottom: '1px solid #f9fafb'
            }}>
              <strong style={{
                minWidth: 140,
                color: '#6b7280',
                fontSize: 14,
                fontWeight: 600,
                paddingTop: 2
              }}>
                {item.label}
              </strong>
              <span style={{
                color: '#1f2937',
                fontSize: 15,
                flex: 1,
                fontWeight: 500,
                lineHeight: 1.6
              }}>{item.value || '-'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Toast 提示 */}
      {toast.visible && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: 8,
            backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: 'white',
            fontSize: 14,
            fontWeight: 500,
            zIndex: 2000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {toast.text}
        </div>
      )}

      {/* 顶部操作栏 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' }}>
          <button className="secondary-button" onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>←</span> 返回列表
          </button>
        </div>

        {/* 患者姓名 - 更大更突出 */}
        <div style={{
          marginBottom: 24,
          paddingBottom: 20,
          borderBottom: '2px solid #f3f4f6'
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            color: '#1f2937',
            letterSpacing: '-0.5px'
          }}>{patientName}</h1>
          <div style={{
            fontSize: 14,
            color: '#6b7280',
            marginTop: 8,
            fontWeight: 500
          }}>
            住户详细信息
          </div>
        </div>

        {/* 指标卡片（状态 + 入住次数，不占满整行） */}
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16
        }}>
          {/* 状态卡片 - 增强设计 */}
          <div
            onClick={handleStatusChange}
            style={{
              padding: 20,
              borderRadius: 12,
              backgroundColor: statusStyle.bgColor,
              border: `2px solid ${statusStyle.textColor}44`,
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
              flex: '0 0 auto',
              minWidth: 180,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8, lineHeight: 1 }}>
              {careStatus === 'in_care' ? '🏠' : careStatus === 'pending' ? '⏳' : careStatus === 'discharged' ? '👋' : '📋'}
            </div>
            <div style={{ fontSize: 13, color: statusStyle.textColor, marginBottom: 6, opacity: 0.75, fontWeight: 500 }}>状态</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: statusStyle.textColor, letterSpacing: '-0.3px' }}>{statusStyle.label}</div>
          </div>

          {/* 入住次数卡片 - 始终显示 */}
          <div style={{
            padding: 20,
            borderRadius: 12,
            backgroundColor: '#f0f9ff',
            border: '2px solid #3b82f644',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.08)',
            transition: 'all 0.3s ease',
            flex: '0 0 auto',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 32, marginBottom: 8, lineHeight: 1 }}>📊</div>
            <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6, opacity: 0.75, fontWeight: 500 }}>入住次数</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#3b82f6', letterSpacing: '-0.3px' }}>{Number(admissionCount) || 0}次</div>
          </div>

          {/* 最近入住卡片（可选） */}
          {lastAdmissionTimeDisplay && (
            <div style={{
              padding: 20,
              borderRadius: 12,
              backgroundColor: '#fef3c7',
              border: '2px solid #f59e0b44',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.08)',
              transition: 'all 0.3s ease',
              flex: '0 0 auto',
              minWidth: 180,
            }}>
              <div style={{ fontSize: 32, marginBottom: 8, lineHeight: 1 }}>📅</div>
              <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 6, opacity: 0.75, fontWeight: 500 }}>最近入住</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', letterSpacing: '-0.3px' }}>{lastAdmissionTimeDisplay}</div>
            </div>
          )}
        </div>

        {/* 衍生标签/徽章 */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {badges.map((badge: any, index: number) => {
              const badgeType = badge.type || badge._type || 'default';
              const badgeColors: Record<string, { bg: string; text: string }> = {
                success: { bg: '#d1fae5', text: '#065f46' },
                warning: { bg: '#fef3c7', text: '#92400e' },
                error: { bg: '#fee2e2', text: '#991b1b' },
                info: { bg: '#dbeafe', text: '#1e40af' },
                default: { bg: '#e5e7eb', text: '#374151' },
              };
              const colors = badgeColors[badgeType] || badgeColors.default;
              return (
                <span
                  key={index}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 12,
                    backgroundColor: colors.bg,
                    color: colors.text,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {badge.text || badge.label || ''}
                </span>
              );
            })}
          </div>
        )}

        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: '#6b7280'
          }}>
            <div style={{
              fontSize: 48,
              marginBottom: 16,
              animation: 'pulse 2s ease-in-out infinite'
            }}>
              ⏳
            </div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>加载中...</div>
          </div>
        )}
        {error && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <span className="error-text" style={{ fontSize: 15, fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* 基础信息、家庭信息、经济情况 */}
        {!loading && !error && detail && (
          <div>
            {renderInfoList('基础信息', detail.basicInfo, 'basic')}
            {renderInfoList('家庭信息', detail.familyInfo, 'contact')}
            {renderInfoList('经济情况', detail.economicInfo, 'economic')}
          </div>
        )}
      </div>

      {/* 入住记录 - 时间线样式 */}
      {!loading && !error && (
        <div className="card" style={{ border: '2px solid #f3f4f6', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: '2px solid #e5e7eb'
          }}>
            <h3 style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: '#1f2937',
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 24 }}>📝</span> 入住记录
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '4px 12px',
                borderRadius: 12
              }}>
                {sortedRecords.length}条
              </span>
            </h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="secondary-button"
                onClick={toggleSortOrder}
                style={{ padding: '6px 12px', fontSize: 14 }}
              >
                {recordsSortOrder === 'desc' ? '▼ 最新' : '▲ 最早'}
              </button>
              <button className="primary-button" onClick={handleAddRecord} style={{ padding: '6px 12px', fontSize: 14 }}>
                添加
              </button>
            </div>
          </div>

          {sortedRecords.length > 0 ? (
            <div style={{ position: 'relative', paddingLeft: 32 }}>
              {/* 时间线竖线 */}
              <div style={{
                position: 'absolute',
                left: 8,
                top: 8,
                bottom: 8,
                width: 2,
                backgroundColor: '#e5e7eb'
              }} />

              {sortedRecords.map((record: any, index: number) => {
                const recordId = record.intakeId || record._id || `record_${index}`;
                const isExpanded = expandedRecords[recordId] || false;

                return (
                  <div key={recordId} style={{ position: 'relative', marginBottom: 16 }}>
                    {/* 时间线圆点 */}
                    <div style={{
                      position: 'absolute',
                      left: -28,
                      top: 8,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      border: '2px solid white',
                      boxShadow: '0 0 0 2px #e5e7eb'
                    }} />

                    <div style={{
                      padding: 16,
                      backgroundColor: '#f9fafb',
                      borderRadius: 8,
                      border: '1px solid #e5e7eb'
                    }}>
                      {/* 记录头部 */}
                      <div
                        onClick={() => toggleRecordExpand(recordId)}
                        style={{ cursor: 'pointer', marginBottom: isExpanded ? 12 : 0 }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>
                              {record.displayTime || '-'}
                            </span>
                            <span style={{ color: '#9ca3af' }}>→</span>
                            <span style={{ fontSize: 14, color: '#6b7280' }}>
                              {record.checkoutDisplay || '未离开'}
                            </span>
                            {record.durationDisplay && (
                              <span style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 12,
                                backgroundColor: '#dbeafe',
                                color: '#1e40af'
                              }}>
                                · {record.durationDisplay}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 14, color: '#6b7280' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>

                        {/* 预览信息 */}
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {record.hospitalDisplay && (
                            <span style={{ fontSize: 13, color: '#4b5563' }}>🏥 {record.hospitalDisplay}</span>
                          )}
                          {record.diagnosisDisplay && (
                            <span style={{ fontSize: 13, color: '#4b5563' }}>📋 {record.diagnosisDisplay}</span>
                          )}
                        </div>
                      </div>

                      {/* 展开的详细信息 */}
                      {isExpanded && (
                        <div>
                          {/* 操作按钮 */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <button
                              className="link-button"
                              onClick={() => handleEditRecord(record)}
                              style={{ fontSize: 13 }}
                            >
                              编辑
                            </button>
                            <button
                              className="link-button"
                              onClick={() => handleDeleteRecord(recordId)}
                              style={{ fontSize: 13, color: '#ef4444' }}
                            >
                              删除
                            </button>
                          </div>

                          {/* 详细字段 */}
                          {(record.hospitalDisplay || record.diagnosisDisplay || record.doctorDisplay) && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>就诊情况</div>
                              {record.hospitalDisplay && (
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                  <strong>就诊医院：</strong>{record.hospitalDisplay}
                                </div>
                              )}
                              {record.diagnosisDisplay && (
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                  <strong>医院诊断：</strong>{record.diagnosisDisplay}
                                </div>
                              )}
                              {record.doctorDisplay && (
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                  <strong>医生姓名：</strong>{record.doctorDisplay}
                                </div>
                              )}
                            </div>
                          )}

                          {(record.symptomDetailDisplay || record.treatmentProcessDisplay || record.followUpPlanDisplay) && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>医疗情况</div>
                              {record.symptomDetailDisplay && (
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                  <strong>症状详情：</strong>{record.symptomDetailDisplay}
                                </div>
                              )}
                              {record.treatmentProcessDisplay && (
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                  <strong>医治过程：</strong>{record.treatmentProcessDisplay}
                                </div>
                              )}
                              {record.followUpPlanDisplay && (
                                <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                  <strong>后续治疗安排：</strong>{record.followUpPlanDisplay}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>暂无入住记录</div>
          )}
        </div>
      )}

      {/* 操作日志 */}
      {!loading && !error && operationLogs.length > 0 && (
        <div className="card" style={{ border: '2px solid #f3f4f6', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
          <div
            onClick={() => setOperationLogsCollapsed(!operationLogsCollapsed)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: operationLogsCollapsed ? 0 : 16,
              padding: 12,
              borderRadius: 8,
              backgroundColor: '#f9fafb',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f9fafb'; }}
          >
            <h3 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: '#1f2937',
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontSize: 20 }}>📋</span> 操作日志
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#6b7280',
                backgroundColor: '#e5e7eb',
                padding: '4px 12px',
                borderRadius: 12
              }}>
                {operationLogs.length}条
              </span>
            </h3>
            <span style={{
              fontSize: 14,
              color: '#6b7280',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              {operationLogsCollapsed ? '展开' : '收起'}
              <span>{operationLogsCollapsed ? '▼' : '▲'}</span>
            </span>
          </div>

          {!operationLogsCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {operationLogs.map((log: any, index: number) => (
                <div key={index} style={{
                  padding: 12,
                  backgroundColor: '#f9fafb',
                  borderRadius: 6,
                  fontSize: 13
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#6b7280' }}>{log.timeText || ''}</span>
                    <span style={{ fontWeight: 500, color: '#374151' }}>{log.operatorName || '未知操作人'}</span>
                  </div>
                  <div style={{ color: '#4b5563' }}>{log.message || '更新住户资料'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 媒资管理 */}
      <MediaManager patientKey={patientKey} />

      {/* 编辑对话框 */}
      <EditModuleDialog
        visible={editDialogVisible}
        block={editBlock}
        initialForm={editForm}
        onCancel={() => setEditDialogVisible(false)}
        onSave={handleSave}
      />

      {/* 状态调整对话框 */}
      {statusDialogVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !statusDialogSubmitting && setStatusDialogVisible(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: 500,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>调整状态</h3>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }}>
                选择新的住户状态，便于列表展示一致。
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                {STATUS_OPTIONS.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => !statusDialogSubmitting && setStatusForm({ ...statusForm, value: option.id })}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: `2px solid ${statusForm.value === option.id ? '#3b82f6' : '#e5e7eb'}`,
                      backgroundColor: statusForm.value === option.id ? '#eff6ff' : 'white',
                      cursor: statusDialogSubmitting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{statusForm.value === option.id ? '●' : '○'}</span>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{option.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, marginLeft: 24 }}>
                      {option.id === 'in_care' && '用于正在小家入住的住户'}
                      {option.id === 'pending' && '待入住房、随访等状态'}
                      {option.id === 'discharged' && '已办理离开或转出'}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  备注（可选）
                </label>
                <textarea
                  value={statusForm.note}
                  onChange={(e) => setStatusForm({ ...statusForm, note: e.target.value })}
                  disabled={statusDialogSubmitting}
                  placeholder="可选，说明状态调整原因"
                  maxLength={120}
                  style={{
                    width: '100%',
                    minHeight: 80,
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="secondary-button"
                onClick={() => setStatusDialogVisible(false)}
                disabled={statusDialogSubmitting}
              >
                取消
              </button>
              <button
                className="primary-button"
                onClick={handleStatusConfirm}
                disabled={statusDialogSubmitting}
              >
                {statusDialogSubmitting ? '处理中...' : '确认调整'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 入住记录编辑对话框 */}
      {recordDialogVisible && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => !recordDialogSubmitting && setRecordDialogVisible(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>
              {recordForm.id ? '编辑入住记录' : '添加入住记录'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {/* 入住时间 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  入住时间
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    type="date"
                    value={recordForm.intakeDate}
                    onChange={(e) => setRecordForm({ ...recordForm, intakeDate: e.target.value })}
                    disabled={recordDialogSubmitting}
                    style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  />
                  <input
                    type="time"
                    value={recordForm.intakeTime}
                    onChange={(e) => setRecordForm({ ...recordForm, intakeTime: e.target.value })}
                    disabled={recordDialogSubmitting}
                    style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              {/* 离开时间 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  离开时间（可选）
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    type="date"
                    value={recordForm.checkoutDate}
                    onChange={(e) => setRecordForm({ ...recordForm, checkoutDate: e.target.value })}
                    disabled={recordDialogSubmitting}
                    style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  />
                  <input
                    type="time"
                    value={recordForm.checkoutTime}
                    onChange={(e) => setRecordForm({ ...recordForm, checkoutTime: e.target.value })}
                    disabled={recordDialogSubmitting}
                    style={{ padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                  />
                </div>
              </div>

              {/* 就诊医院 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  就诊医院
                </label>
                <input
                  type="text"
                  value={recordForm.hospital}
                  onChange={(e) => setRecordForm({ ...recordForm, hospital: e.target.value })}
                  disabled={recordDialogSubmitting}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
              </div>

              {/* 医院诊断 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  医院诊断
                </label>
                <input
                  type="text"
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                  disabled={recordDialogSubmitting}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
              </div>

              {/* 医生姓名 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  医生姓名
                </label>
                <input
                  type="text"
                  value={recordForm.doctor}
                  onChange={(e) => setRecordForm({ ...recordForm, doctor: e.target.value })}
                  disabled={recordDialogSubmitting}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
                />
              </div>

              {/* 症状详情 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  症状详情
                </label>
                <textarea
                  value={recordForm.symptoms}
                  onChange={(e) => setRecordForm({ ...recordForm, symptoms: e.target.value })}
                  disabled={recordDialogSubmitting}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* 医治过程 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  医治过程
                </label>
                <textarea
                  value={recordForm.treatmentProcess}
                  onChange={(e) => setRecordForm({ ...recordForm, treatmentProcess: e.target.value })}
                  disabled={recordDialogSubmitting}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* 后续治疗安排 */}
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  后续治疗安排
                </label>
                <textarea
                  value={recordForm.followUpPlan}
                  onChange={(e) => setRecordForm({ ...recordForm, followUpPlan: e.target.value })}
                  disabled={recordDialogSubmitting}
                  style={{
                    width: '100%',
                    minHeight: 60,
                    padding: 8,
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 14,
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                className="secondary-button"
                onClick={() => setRecordDialogVisible(false)}
                disabled={recordDialogSubmitting}
              >
                取消
              </button>
              <button
                className="primary-button"
                onClick={handleSaveRecord}
                disabled={recordDialogSubmitting}
              >
                {recordDialogSubmitting ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetailPage;
