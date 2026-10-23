// Uygulama tarafında kullanım (PostgreSQL enum ve SQL Server string ile uyumlu)
export type TaskType = "GOREV" | "NOT" | "FIKIR";
export type TaskStatus = "YENI" | "ONAY_BEKLIYOR" | "DEVAM_EDIYOR" | "BEKLEMEDE" | "TAMAMLANDI" | "REDDEDILDI";
export type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface SetupStep1Data {
  dbType: "postgresql" | "sqlserver";
}

export interface SetupStep2Data {
  adminPassword: string;
  adminEmail: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt?: boolean;
}
