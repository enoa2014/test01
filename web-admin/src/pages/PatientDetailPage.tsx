import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPatientDetail } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientDetail } from '../shared/types';
import MediaManager from '../components/MediaManager';
import EditModuleDialog from '../components/EditModuleDialog';
import {
  rebuildBasicInfoDisplay,
  rebuildContactInfoDisplay,
  rebuildEconomicInfoDisplay,
  coalesceValue,
} from '../utils/data-mappers';
import { formatDateForInput } from '../utils/form-utils';

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
      };
    } else if (block === 'contact') {
      form = {
        address: patient.address || '',
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

      // 局部更新 detail 状态
      const updatedPatient = { ...detail?.patient, ...form };
      const updatedDetail = { ...detail, patient: updatedPatient };

      // 根据编辑的模块更新对应的显示数据
      if (editBlock === 'basic') {
        updatedDetail.basicInfo = rebuildBasicInfoDisplay(
          updatedPatient,
          detail?.basicInfo as Array<{ label: string; value: string }>
        );
      } else if (editBlock === 'contact') {
        updatedDetail.familyInfo = rebuildContactInfoDisplay(
          updatedPatient,
          detail?.familyInfo as Array<{ label: string; value: string }>
        );
      } else if (editBlock === 'economic') {
        updatedDetail.economicInfo = rebuildEconomicInfoDisplay(
          updatedPatient,
          detail?.economicInfo as Array<{ label: string; value: string }>
        );
      }

      setDetail(updatedDetail as PatientDetail);
      setEditDialogVisible(false);
      showToast('保存成功', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
      throw err;
    }
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

    fetchPatientDetail(app, patientKey)
      .then(result => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载详情失败');
        }
      })
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

  // 状态样式映射
  const getStatusStyle = (status: string) => {
    const statusMap: Record<string, { label: string; bgColor: string; textColor: string }> = {
      in_care: { label: '在住', bgColor: '#ecfdf5', textColor: '#10b981' },
      pending: { label: '待入住', bgColor: '#fffbeb', textColor: '#f59e0b' },
      discharged: { label: '已离开', bgColor: '#f9fafb', textColor: '#6b7280' },
      followup: { label: '随访', bgColor: '#eff6ff', textColor: '#2563eb' },
    };
    return statusMap[status] || statusMap.pending;
  };

  const statusStyle = getStatusStyle(careStatus);

  const renderInfoList = (
    title: string,
    items?: Array<{ label: string; value: string }>,
    editBlock?: 'basic' | 'contact' | 'economic'
  ) => {
    if (!items || items.length === 0) {
      return null;
    }
    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#1f2937' }}>{title}</h3>
          {editBlock && (
            <button
              className="link-button"
              onClick={() => handleEdit(editBlock)}
              style={{ fontSize: 14 }}
            >
              编辑
            </button>
          )}
        </div>
        <div style={{
          display: 'grid',
          gap: 12,
          backgroundColor: '#f9fafb',
          padding: 16,
          borderRadius: 8
        }}>
          {items.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'baseline' }}>
              <strong style={{
                minWidth: 120,
                color: '#6b7280',
                fontSize: 14,
                fontWeight: 500
              }}>
                {item.label}：
              </strong>
              <span style={{ color: '#1f2937', fontSize: 14, flex: 1 }}>{item.value || '-'}</span>
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
      <div className="card">
        <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="secondary-button" onClick={() => navigate(-1)}>
            返回列表
          </button>
        </div>

        {/* 患者姓名和状态 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{patientName}</h2>
          <div
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              backgroundColor: statusStyle.bgColor,
              color: statusStyle.textColor,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {statusStyle.label}
          </div>
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

        {loading && <p style={{ color: '#6b7280' }}>详情加载中...</p>}
        {error && <p className="error-text">{error}</p>}

        {/* 基础信息、家庭信息、经济情况 */}
        {!loading && !error && detail && (
          <div>
            {renderInfoList('基础信息', detail.basicInfo, 'basic')}
            {renderInfoList('家庭信息', detail.familyInfo, 'contact')}
            {renderInfoList('经济情况', detail.economicInfo, 'economic')}
          </div>
        )}
      </div>

      {/* 入住记录 */}
      {!loading && detail?.records && detail.records.length > 0 && (
        <div className="card">
          <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>入住记录</h3>
            <button
              className="secondary-button"
              onClick={() => navigate(`/patients/${encodeURIComponent(patientKey)}/intakes`)}
            >
              管理入住记录
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {detail.records.map((record: any, index: number) => (
              <div
                key={index}
                style={{
                  padding: 16,
                  backgroundColor: '#f9fafb',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>入住时间</div>
                    <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 500 }}>
                      {record.admissionDate || record.displayTime || '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>离开时间</div>
                    <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 500 }}>
                      {record.checkoutAt || record.checkoutDisplay || '未离开'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>医院</div>
                    <div style={{ fontSize: 14, color: '#1f2937' }}>
                      {record.hospital || record.hospitalDisplay || '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>诊断</div>
                    <div style={{ fontSize: 14, color: '#1f2937' }}>
                      {record.diagnosis || record.diagnosisDisplay || '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>医生</div>
                    <div style={{ fontSize: 14, color: '#1f2937' }}>
                      {record.doctor || record.doctorDisplay || '-'}
                    </div>
                  </div>
                  {(record.durationDisplay || record.durationText) && (
                    <div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>住院时长</div>
                      <div style={{ fontSize: 14, color: '#1f2937' }}>
                        {record.durationDisplay || record.durationText}
                      </div>
                    </div>
                  )}
                </div>

                {/* 症状、治疗过程、随访计划等详细信息 */}
                {(record.symptoms || record.symptomDetailDisplay ||
                  record.treatmentProcess || record.treatmentProcessDisplay ||
                  record.followUpPlan || record.followUpPlanDisplay ||
                  record.narrative) && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
                    {(record.symptoms || record.symptomDetailDisplay) && (
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ fontSize: 13, color: '#6b7280' }}>症状：</strong>
                        <span style={{ fontSize: 13, color: '#374151' }}>
                          {record.symptoms || record.symptomDetailDisplay}
                        </span>
                      </div>
                    )}
                    {(record.treatmentProcess || record.treatmentProcessDisplay) && (
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ fontSize: 13, color: '#6b7280' }}>治疗过程：</strong>
                        <span style={{ fontSize: 13, color: '#374151' }}>
                          {record.treatmentProcess || record.treatmentProcessDisplay}
                        </span>
                      </div>
                    )}
                    {(record.followUpPlan || record.followUpPlanDisplay) && (
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ fontSize: 13, color: '#6b7280' }}>随访计划：</strong>
                        <span style={{ fontSize: 13, color: '#374151' }}>
                          {record.followUpPlan || record.followUpPlanDisplay}
                        </span>
                      </div>
                    )}
                    {record.narrative && (
                      <div>
                        <strong style={{ fontSize: 13, color: '#6b7280' }}>备注：</strong>
                        <span style={{ fontSize: 13, color: '#374151' }}>{record.narrative}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
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
    </div>
  );
};

export default PatientDetailPage;
