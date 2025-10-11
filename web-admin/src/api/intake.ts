import { CloudBase } from '@cloudbase/js-sdk';

type IntakeCreatePayload = {
  patientName: string;
  idType?: string;
  idNumber?: string;
  gender?: string;
  birthDate?: string;
  phone?: string;
  address?: string;
  backupContact?: string;
  backupPhone?: string;
  fatherInfo?: string;
  fatherContactName?: string;
  fatherContactPhone?: string;
  motherInfo?: string;
  motherContactName?: string;
  motherContactPhone?: string;
  guardianInfo?: string;
  guardianContactName?: string;
  guardianContactPhone?: string;
  admissionDate?: string;
  situation?: string;
  visitHospital?: string;
  hospitalDiagnosis?: string;
  attendingDoctor?: string;
  symptomDetail?: string;
  treatmentProcess?: string;
  followUpPlan?: string;
};

export async function intakeCreatePatient(app: CloudBase, formData: IntakeCreatePayload) {
  const res = await app.callFunction({
    name: 'patientIntake',
    data: {
      action: 'createPatient',
      formData,
    },
  });
  const result = res.result as { success?: boolean; data?: { patientKey?: string }; error?: { message?: string } };
  if (!result?.success || !result?.data?.patientKey) {
    throw new Error(result?.error?.message || '创建住户失败');
  }
  return result.data;
}

