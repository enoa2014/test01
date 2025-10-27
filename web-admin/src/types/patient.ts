export type PatientSummary = {
  _id?: string;
  patientKey?: string;
  recordKey?: string;
  patientName?: string;
  gender?: string;
  birthDate?: string;
  idNumber?: string;
  phone?: string;
  address?: string;
  backupContact?: string;
  backupPhone?: string;
  familyContacts?: Array<PatientFamilyContact>;
  hasValidContact?: boolean;
  contactCount?: number;
  latestHospital?: string;
  latestDiagnosis?: string;
  confirmedDate?: string;
  treatmentStage?: string;
  latestDoctor?: string;
  latestAdmissionDate?: string;
  latestAdmissionTimestamp?: number;
  summaryCaregivers?: string;
  admissionCount?: number;
  nativePlace?: string;
  ethnicity?: string;
  careStatus?: string;
  checkoutAt?: number | string;
  checkoutReason?: string;
  checkoutNote?: string;
  futureAdmissionAnomaly?: boolean;
};

export type PatientDetail = {
  patient?: Record<string, unknown> & {
    patientName?: string;
    gender?: string;
    birthDate?: string;
    nativePlace?: string;
    ethnicity?: string;
    latestHospital?: string;
    latestDiagnosis?: string;
    confirmedDate?: string;
    treatmentStage?: string;
  };
  basicInfo?: Array<{ label: string; value: string }>;
  familyInfo?: Array<{ label: string; value: string }>;
  economicInfo?: Array<{ label: string; value: string }>;
  records?: Array<Record<string, unknown> & {
    hospital?: string;
    diagnosis?: string;
    doctor?: string;
    admissionDate?: string;
    narrative?: string;
  }>;
};

export type MediaItem = {
  id?: string;
  _id?: string;
  patientKey: string;
  category: string;
  displayName?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt?: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
  summary?: string;
  thumbFileId?: string;
  storageFileId?: string;
};

export type MediaQuota = {
  totalCount: number;
  totalBytes: number;
  remainingCount: number;
  remainingBytes: number;
  updatedAt?: number;
};

export type PatientFamilyContact = {
  role?: string;
  name?: string;
  phone?: string;
};

export type PatientFormPayload = {
  patientName: string;
  gender: string;
  birthDate?: string;
  nativePlace?: string;
  ethnicity?: string;
  idType?: string;
  idNumber?: string;
  phone?: string;
  address?: string;
  backupContact?: string;
  backupPhone?: string;
  fatherContactName?: string;
  fatherContactPhone?: string;
  motherContactName?: string;
  motherContactPhone?: string;
  guardianContactName?: string;
  guardianContactPhone?: string;
  summaryCaregivers?: string;
  careStatus?: string;
  checkoutAt?: string;
  checkoutReason?: string;
  checkoutNote?: string;
  latestHospital?: string;
  latestDiagnosis?: string;
  confirmedDate?: string;
  treatmentStage?: string;
};
