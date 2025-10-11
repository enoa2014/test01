import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchPatientDetail } from '../api/patient';
import { useCloudbase } from '../hooks/useCloudbase';
import { PatientDetail } from '../types/patient';
import MediaManager from '../components/MediaManager';

const PatientDetailPage: React.FC = () => {
  const { patientKey = '' } = useParams();
  const navigate = useNavigate();
  const { app } = useCloudbase();
  const [detail, setDetail] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const patientName = detail?.patient?.patientName || '未命名';

  const renderInfoList = (title: string, items?: Array<{ label: string; value: string }>) => {
    if (!items || items.length === 0) {
      return null;
    }
    return (
      <div>
        <h3>{title}</h3>
        <ul className="list">
          {items.map(item => (
            <li key={item.label}>
              <strong>{item.label}：</strong>
              <span>{item.value || '-'}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <div className="card">
        <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
          <button className="secondary-button" onClick={() => navigate(-1)}>
            返回列表
          </button>
          <button
            className="primary-button"
            onClick={() => navigate(`/patients/${encodeURIComponent(patientKey)}/edit`)}
          >
            编辑资料
          </button>
        </div>
        <h2>{patientName}</h2>
        {loading && <p>详情加载中...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && detail && (
          <div className="grid-two">
            {renderInfoList('基础信息', detail.basicInfo)}
            {renderInfoList('家庭信息', detail.familyInfo)}
            {renderInfoList('经济情况', detail.economicInfo)}
          </div>
        )}
      </div>

      {!loading && detail?.records && detail.records.length > 0 && (
        <div className="card">
          <h3>就诊记录</h3>
          <ul className="list">
            {detail.records.map((record, index) => (
              <li key={index}>
                <div><strong>时间：</strong>{(record as Record<string, unknown>).admissionDate || '-'}</div>
                <div><strong>医院：</strong>{(record as Record<string, unknown>).hospital || '-'}</div>
                <div><strong>诊断：</strong>{(record as Record<string, unknown>).diagnosis || '-'}</div>
                <div><strong>医生：</strong>{(record as Record<string, unknown>).doctor || '-'}</div>
                <div>
                  <strong>记录：</strong>
                  {(record as Record<string, unknown>).narrative ||
                    (record as Record<string, unknown>).treatmentProcess ||
                    '-'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MediaManager patientKey={patientKey} />
    </div>
  );
};

export default PatientDetailPage;
