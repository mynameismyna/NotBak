import nodemailer from "nodemailer";
import { getSmtpConfigFromDb } from "@/lib/smtp-config";
import { resolveBaseUrl } from "@/lib/base-url";
import { getBaseUrlForEmails } from "@/lib/app-url";
import type { WidgetCountsPayload, DurationStatsPayload } from "@/lib/dashboard-metrics";

async function getSmtpConfig(): Promise<{
  host: string;
  port: number;
  secure: boolean;
  rejectUnauthorized: boolean;
} | null> {
  const fromDb = await getSmtpConfigFromDb();
  if (fromDb?.host) return fromDb;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1";
  const rejectUnauthorized = process.env.SMTP_REJECT_UNAUTHORIZED === "false" || process.env.SMTP_REJECT_UNAUTHORIZED === "0" ? false : true;
  if (!host) return null;

  return { host, port: port || 587, secure, rejectUnauthorized };
}

async function getTransporter() {
  const config = await getSmtpConfig();
  if (!config) return null;

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    tls: config.rejectUnauthorized === false ? { rejectUnauthorized: false } : undefined,
    // Kimlik doğrulama yok: e-postalar oturum açmış kullanıcının adresinden relay üzerinden gönderilir
  });
}

export interface SendProblemReportMailOptions {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  description: string;
}

export async function sendProblemReportMail(
  options: SendProblemReportMailOptions
): Promise<{ ok: boolean; error?: string }> {
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP yapılandırılmamış. Ayarlar > SMTP Ayarları bölümünden yapılandırın." };
  }

  const fromStr = options.fromName
    ? `"${options.fromName}" <${options.fromEmail}>`
    : options.fromEmail;

  try {
    await transporter.sendMail({
      from: fromStr,
      to: options.toEmail,
      replyTo: options.fromEmail,
      subject: `[NotBak Sorun Bildirimi] ${options.subject}`,
      text: [
        `Konu: ${options.subject}`,
        ``,
        `Gönderen: ${options.fromEmail}${options.fromName ? ` (${options.fromName})` : ""}`,
        ``,
        `Açıklama:`,
        options.description,
      ].join("\n"),
      html: [
        `<p><strong>Konu:</strong> ${escapeHtml(options.subject)}</p>`,
        `<p><strong>Gönderen:</strong> ${escapeHtml(options.fromEmail)}${options.fromName ? ` (${escapeHtml(options.fromName)})` : ""}</p>`,
        `<p><strong>Açıklama:</strong></p>`,
        `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(options.description)}</pre>`,
      ].join("\n"),
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sendProblemReportMail failed:", message);
    return { ok: false, error: message };
  }
}

export interface SendTestMailOptions {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
}

/** SMTP ayarlarını doğrulamak için deneme postası gönderir. */
export async function sendTestMail(
  options: SendTestMailOptions
): Promise<{ ok: boolean; error?: string }> {
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP yapılandırılmamış. Önce ayarları kaydedin." };
  }

  const fromStr = options.fromName
    ? `"${options.fromName}" <${options.fromEmail}>`
    : options.fromEmail;

  const subject = "[NotBak] SMTP deneme postası";
  const text = "Bu mesaj NotBak SMTP ayarlarını test etmek için gönderilmiştir. Alındıysanız yapılandırma doğru çalışıyordur.";
  const html = `<p>${escapeHtml(text)}</p>`;

  try {
    await transporter.sendMail({
      from: fromStr,
      to: options.toEmail,
      replyTo: options.fromEmail,
      subject,
      text,
      html,
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sendTestMail failed:", message);
    return { ok: false, error: message };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Takvime ekle – .ics eki ile e-posta
// ---------------------------------------------------------------------------

export interface SendTaskCalendarMailOptions {
  toEmail: string;
  taskTitle: string;
  icsContent: string;
}

/** Görev/notu takvime eklenebilir .ics eki ile kullanıcının e-postasına gönderir. */
export async function sendTaskCalendarMail(
  options: SendTaskCalendarMailOptions
): Promise<{ ok: boolean; error?: string }> {
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP yapılandırılmamış. Ayarlar > SMTP bölümünden yapılandırın." };
  }

  const fromEmail = process.env.MAIL_FROM_EMAIL || "noreply@notbak.local";
  const fromName = process.env.MAIL_FROM_NAME || "NotBak";
  const fromStr = `"${fromName}" <${fromEmail}>`;
  const subject = `[NotBak] Takvime ekle: ${options.taskTitle.slice(0, 80)}${options.taskTitle.length > 80 ? "…" : ""}`;
  const text = "Bu e-postadaki ek dosyayı (gorev.ics) kullanarak görevi takviminize ekleyebilirsiniz. Eki açıp \"Takvime ekle\" veya \"Kabul et\" ile takviminize ekleyin.";
  const html = `<p>${escapeHtml(text)}</p>`;

  try {
    await transporter.sendMail({
      from: fromStr,
      to: options.toEmail,
      subject,
      text,
      html,
      attachments: [
        {
          filename: "gorev.ics",
          content: Buffer.from(options.icsContent, "utf-8"),
          contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        },
      ],
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sendTaskCalendarMail failed:", message);
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Hoş geldiniz e-postaları (LDAP ve Lokal kullanıcı)
// ---------------------------------------------------------------------------

export interface SendWelcomeMailLdapOptions {
  toEmail: string;
  toName: string;
  baseUrl?: string;
  /** Verilirse e-postadaki link için URL bu istekten otomatik türetilir (Host header). */
  request?: Request | null;
}

/** LDAP/AD kullanıcısı için hoş geldiniz e-postası. Şirket e-postası ve AD parolası ile giriş bilgisi. */
export async function sendWelcomeMailLdap(
  options: SendWelcomeMailLdapOptions
): Promise<{ ok: boolean; error?: string }> {
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP yapılandırılmamış. Ayarlar > SMTP veya MAIL_FROM_EMAIL ile yapılandırın." };
  }
  const baseUrl = options.baseUrl ?? (await getBaseUrlForEmails(options.request));
  const fromEmail = process.env.MAIL_FROM_EMAIL || "noreply@notbak.local";
  const fromName = process.env.MAIL_FROM_NAME || "NotBak";
  const fromStr = `"${fromName}" <${fromEmail}>`;
  const loginUrl = `${baseUrl}/login`;
  const subject = "NotBak Görev ve Not Yönetimi Sistemine Hoş Geldiniz";
  const text = [
    "NotBak Görev ve Not Yönetimi Sistemine Hoş Geldiniz",
    "—",
    `Merhaba ${options.toName},`,
    "",
    "Sisteme erişim hesabınız oluşturuldu. Aşağıdaki bilgilerle giriş yapabilirsiniz:",
    "",
    "• Şirket e-posta adresiniz ve Active Directory (Windows) parolanız ile giriş yapın.",
    "",
    `Giriş adresi: ${loginUrl}`,
    "",
    "Saygılarımızla,",
    fromName,
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="tr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style type="text/css">table{border-collapse:collapse;} .outlook-main{border-radius:0 !important;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EEF2F7;">
<tr><td style="padding:24px 16px;" align="center">
  <table class="outlook-main" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#1E3A5F;padding:24px 32px;">
      <span style="font-size:22px;font-weight:800;color:#FFFFFF;">NotBak</span>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:18px;color:#1E293B;font-weight:700;padding-bottom:16px;">NotBak Görev ve Not Yönetimi Sistemine Hoş Geldiniz</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="color:#334155;line-height:1.6;padding-bottom:8px;">Merhaba <strong>${escapeHtml(options.toName)}</strong>,</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="color:#334155;line-height:1.6;padding-bottom:24px;">Sisteme erişim hesabınız oluşturuldu. <strong>Şirket e-posta adresiniz ve Active Directory (Windows) parolanız</strong> ile giriş yapabilirsiniz.</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding-bottom:16px;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#ffffff;text-decoration:none;font-weight:600;">Giriş yap</a></td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:13px;color:#64748B;padding-bottom:24px;">Giriş adresi: <a href="${escapeHtml(loginUrl)}" style="color:#3B82F6;">${escapeHtml(loginUrl)}</a></td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:13px;color:#64748B;">Saygılarımızla,<br/>${escapeHtml(fromName)}</td></tr></table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  try {
    await transporter.sendMail({ from: fromStr, to: options.toEmail, subject, text, html });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sendWelcomeMailLdap failed:", message);
    return { ok: false, error: message };
  }
}

export interface SendWelcomeMailLocalOptions {
  toEmail: string;
  toName: string;
  temporaryPassword: string;
  baseUrl?: string;
  /** Verilirse e-postadaki link için URL bu istekten otomatik türetilir (Host header). */
  request?: Request | null;
}

/** Lokal (manuel) kullanıcı için hoş geldiniz e-postası. Geçici parola ve ilk girişte değiştirme bilgisi. */
export async function sendWelcomeMailLocal(
  options: SendWelcomeMailLocalOptions
): Promise<{ ok: boolean; error?: string }> {
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP yapılandırılmamış. Ayarlar > SMTP veya MAIL_FROM_EMAIL ile yapılandırın." };
  }
  const baseUrl = options.baseUrl ?? (await getBaseUrlForEmails(options.request));
  const fromEmail = process.env.MAIL_FROM_EMAIL || "noreply@notbak.local";
  const fromName = process.env.MAIL_FROM_NAME || "NotBak";
  const fromStr = `"${fromName}" <${fromEmail}>`;
  const loginUrl = `${baseUrl}/login`;
  const subject = "NotBak Görev ve Not Yönetimi Sistemine Hoş Geldiniz";
  const text = [
    "NotBak Görev ve Not Yönetimi Sistemine Hoş Geldiniz",
    "—",
    `Merhaba ${options.toName},`,
    "",
    "Sisteme erişim hesabınız oluşturuldu. Aşağıdaki geçici parola ile giriş yapabilirsiniz. İlk girişinizde parolanızı değiştirmeniz gerekecektir.",
    "",
    `Geçici parolanız: ${options.temporaryPassword}`,
    "",
    `Giriş adresi: ${loginUrl}`,
    "",
    "Güvenliğiniz için ilk girişte yeni bir parola belirleyin.",
    "",
    "Saygılarımızla,",
    fromName,
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="tr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style type="text/css">table{border-collapse:collapse;} .outlook-main{border-radius:0 !important;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:#EEF2F7;font-family:Arial,Helvetica,sans-serif;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#EEF2F7;">
<tr><td style="padding:24px 16px;" align="center">
  <table class="outlook-main" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
    <tr><td style="background:#1E3A5F;padding:24px 32px;">
      <span style="font-size:22px;font-weight:800;color:#FFFFFF;">NotBak</span>
    </td></tr>
    <tr><td style="padding:28px 32px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:18px;color:#1E293B;font-weight:700;padding-bottom:16px;">NotBak Görev ve Not Yönetimi Sistemine Hoş Geldiniz</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="color:#334155;line-height:1.6;padding-bottom:8px;">Merhaba <strong>${escapeHtml(options.toName)}</strong>,</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="color:#334155;line-height:1.6;padding-bottom:16px;">Sisteme erişim hesabınız oluşturuldu. Aşağıdaki <strong>geçici parola</strong> ile giriş yapabilirsiniz. <strong>İlk girişinizde parolanızı değiştirmeniz gerekecektir.</strong></td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:12px 16px 24px 16px;background:#F1F5F9;font-family:Consolas,Courier New,monospace;font-size:15px;">${escapeHtml(options.temporaryPassword)}</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding-bottom:16px;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:12px 24px;background:#3B82F6;color:#ffffff;text-decoration:none;font-weight:600;">Giriş yap</a></td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:13px;color:#64748B;padding-bottom:24px;">Giriş adresi: <a href="${escapeHtml(loginUrl)}" style="color:#3B82F6;">${escapeHtml(loginUrl)}</a></td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:13px;color:#D97706;padding-bottom:8px;">Güvenliğiniz için ilk girişte yeni bir parola belirleyin.</td></tr></table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="font-size:13px;color:#64748B;">Saygılarımızla,<br/>${escapeHtml(fromName)}</td></tr></table>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  try {
    await transporter.sendMail({ from: fromStr, to: options.toEmail, subject, text, html });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sendWelcomeMailLocal failed:", message);
    return { ok: false, error: message };
  }
}

/** Günlük özet e-postası için görev satırı */
export interface DigestTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  dueDate: Date;
  completedAt?: Date | null;
  projectName?: string | null;
  assigneeName?: string | null;
}

export interface DigestStats {
  overdueCount: number;
  todayCount: number;
  thisWeekCount: number;
  totalPendingCount: number;
}

/** Günlük özet e-postasında gösterilecek okunmamış bildirim satırı */
export interface DigestNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: Date;
}

export interface SendDailyDigestMailOptions {
  toEmail: string;
  toName: string;
  overdueTasks: DigestTaskItem[];
  todayTasks: DigestTaskItem[];
  tomorrowTasks: DigestTaskItem[];
  inProgressTasks: DigestTaskItem[];
  collaboratorTasks: DigestTaskItem[];
  lastCompleted: DigestTaskItem[];
  stats: DigestStats;
  /** Dashboard kutucukları ile aynı sayılar */
  widgetCounts: WidgetCountsPayload;
  /** Dashboard süre istatistikleri ile aynı metrikler */
  durationStats: DurationStatsPayload;
  /** false ise bilinmeyen e-posta kutusu gösterilmez (dashboard ile aynı) */
  showUnknownEmailWidget?: boolean;
  /** Okunmamış bildirimler (zil listesi). Varsa e-postada "Okunmamış bildirimler" bölümü çıkar. */
  unreadNotifications?: DigestNotificationItem[];
  /** E-postadaki linkler için base URL (örn. https://notbak.example.com). Boşsa relative path kullanılır. */
  baseUrl?: string;
}

// ---------------------------------------------------------------------------
// Günlük Özet E-postası — Yardımcı Sabitler & Fonksiyonlar
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, { text: string; bg: string; label: string }> = {
  URGENT: { text: "#DC2626", bg: "#FEF2F2", label: "ACİL" },
  HIGH:   { text: "#EA580C", bg: "#FFF7ED", label: "YÜKSEK" },
  MEDIUM: { text: "#2563EB", bg: "#EFF6FF", label: "ORTA" },
  LOW:    { text: "#6B7280", bg: "#F9FAFB", label: "DÜŞÜK" },
};

const STATUS_COLORS: Record<string, { text: string; label: string }> = {
  YENI:          { text: "#6366F1", label: "Yeni" },
  ONAY_BEKLIYOR: { text: "#7C3AED", label: "Onay Bekliyor" },
  DEVAM_EDIYOR:  { text: "#D97706", label: "Devam Ediyor" },
  BEKLEMEDE:     { text: "#7C3AED", label: "Beklemede" },
  TAMAMLANDI:    { text: "#059669", label: "Tamamlandı" },
  REDDEDILDI:    { text: "#DC2626", label: "Reddedildi" },
};

const SECTION_BORDER_COLORS = {
  overdue:      "#DC2626",
  today:        "#F59E0B",
  tomorrow:     "#5c6bc0",
  inProgress:   "#8B5CF6",
  collaborator: "#6366F1",
  completed:    "#10B981",
} as const;

/** Uygulama ile uyumlu NotBak e-posta paleti (globals.css ile aynı tonlar) */
const EMAIL_BRAND = {
  headerBg: "linear-gradient(135deg,#4a5a9e 0%,#5c6bc0 50%,#7e6bb8 100%)",
  primary: "#4a5a9e",
  primaryLight: "#5c6bc0",
  tileGorevler: "#7e6bb8",
  tileNotlar: "#6a5b9e",
  accent: "#4682b4",
  bgLight: "#F5F3FF",
  bgLighter: "#EDE9FE",
  textMuted: "#94A3B8",
} as const;

function priorityBadge(priority: string): string {
  const p = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM;
  return `<span style="display:inline-block;padding:4px 10px;border-radius:4px;font-size:12px;font-weight:700;color:${p.text};background:${p.bg};border:1px solid ${p.text};line-height:1.3;">${escapeHtml(p.label)}</span>`;
}

function statusBadge(status: string): string {
  const s = STATUS_COLORS[status] ?? { text: "#6B7280", label: status };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${s.text};line-height:1.3;">${escapeHtml(s.label)}</span>`;
}

function priorityLabel(priority: string): string {
  return (PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.MEDIUM).label;
}

function statusLabel(status: string): string {
  return (STATUS_COLORS[status] ?? { label: status }).label;
}

function daysDiff(dueDate: Date, now: Date): number {
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function timeLabel(task: DigestTaskItem, now: Date): string {
  if (task.status === "TAMAMLANDI" && task.completedAt) {
    return new Date(task.completedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  const diff = daysDiff(task.dueDate, now);
  if (diff < 0) return `${Math.abs(diff)} gün gecikmiş`;
  if (diff === 0) return "Bugün bitiyor";
  if (diff === 1) return "Yarın bitiyor";
  return `${diff} gün kaldı`;
}

function timeLabelHtml(task: DigestTaskItem, now: Date): string {
  const diff = daysDiff(task.dueDate, now);
  const label = timeLabel(task, now);
  if (diff < 0) return `<span style="color:#DC2626;font-weight:600;font-size:12px;">${escapeHtml(label)}</span>`;
  if (diff === 0) return `<span style="color:#D97706;font-weight:600;font-size:12px;">${escapeHtml(label)}</span>`;
  return `<span style="color:#6B7280;font-size:12px;">${escapeHtml(label)}</span>`;
}

// ---------------------------------------------------------------------------
// HTML Bileşenleri
// ---------------------------------------------------------------------------

function statCard(value: number, label: string, color: string, bgColor: string): string {
  return `<td style="width:25%;text-align:center;padding:16px 8px;">
<div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:50%;background:${bgColor};font-size:22px;font-weight:800;color:${color};text-align:center;">${value}</div>
<div style="font-size:12px;font-weight:600;color:#475569;margin-top:6px;letter-spacing:0.3px;">${escapeHtml(label)}</div>
</td>`;
}

/** Gecikmiş bölümü için sade satır: sadece başlık + bitiş tarihi */
function overdueTaskRowHtml(task: DigestTaskItem, baseUrl: string): string {
  const link = baseUrl ? `${baseUrl}/dashboard/tasks/${task.id}` : `/dashboard/tasks/${task.id}`;
  const dueStr = new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  const metaParts: string[] = [];
  if (task.projectName) metaParts.push(escapeHtml(task.projectName));
  const metaLine = metaParts.length > 0
    ? `<div style="font-size:11px;color:#94A3B8;margin-top:2px;">${metaParts.join(" · ")}</div>`
    : "";
  return `<tr>
<td style="padding:12px 16px;border-bottom:1px solid #FEE2E2;">
  <a href="${escapeHtml(link)}" style="font-size:14px;font-weight:600;color:#1E293B;text-decoration:none;">${escapeHtml(task.title)}</a>
  <div style="font-size:12px;color:#DC2626;font-weight:600;margin-top:4px;">Bitiş: ${escapeHtml(dueStr)}</div>
  ${metaLine}
</td>
</tr>`;
}

function taskRowHtml(task: DigestTaskItem, baseUrl: string, now: Date, showAssignee: boolean): string {
  const link = baseUrl ? `${baseUrl}/dashboard/tasks/${task.id}` : `/dashboard/tasks/${task.id}`;
  const metaParts: string[] = [];
  if (task.projectName) metaParts.push(`📁 ${escapeHtml(task.projectName)}`);
  if (showAssignee && task.assigneeName) metaParts.push(`Atanan: ${escapeHtml(task.assigneeName)}`);
  const metaLine = metaParts.length > 0
    ? `<div style="font-size:12px;color:#94A3B8;margin-top:3px;">${metaParts.join(" · ")}</div>`
    : "";

  return `<tr>
<td style="padding:14px 16px;border-bottom:1px solid #EEF2F6;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    <td style="vertical-align:top;width:70px;">
      ${priorityBadge(task.priority)}
    </td>
    <td style="vertical-align:top;padding:0 12px;">
      <a href="${escapeHtml(link)}" style="font-size:14px;font-weight:600;color:#1E293B;text-decoration:none;">${escapeHtml(task.title)}</a>
      ${metaLine}
    </td>
    <td style="vertical-align:top;text-align:right;white-space:nowrap;">
      <div>${statusBadge(task.status)}</div>
      <div style="margin-top:5px;">${timeLabelHtml(task, now)}</div>
    </td>
  </tr></table>
</td>
</tr>`;
}

/** Gecikmiş bölümü: sadece başlık + bitiş tarihi (sade tasarım) */
function overdueSectionHtml(tasks: DigestTaskItem[], totalCount: number, baseUrl: string): string {
  if (tasks.length === 0) return "";
  const moreCount = totalCount - tasks.length;
  const moreRow = moreCount > 0
    ? `<tr><td style="padding:10px 16px;text-align:center;font-size:12px;color:#64748B;background:#FEF2F2;border-top:1px solid #FECACA;">+${moreCount} görev daha · <a href="${escapeHtml(baseUrl)}/dashboard" style="color:#DC2626;text-decoration:none;font-weight:600;">Tümünü gör &rarr;</a></td></tr>`
    : "";
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #FECACA;border-left:4px solid #DC2626;border-radius:8px;overflow:hidden;">
<tr><td style="padding:14px 16px;background:#FEF2F2;border-bottom:1px solid #FECACA;">
  <span style="font-size:15px;font-weight:700;color:#991B1B;">Tamamlanmamış ve süresi geçmiş</span>
  <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;color:#DC2626;background:#fff;border:1px solid #DC2626;margin-left:8px;">${totalCount}</span>
</td></tr>
<tr><td style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    ${tasks.map((t) => overdueTaskRowHtml(t, baseUrl)).join("\n    ")}
    ${moreRow}
  </table>
</td></tr>
</table>`;
}

function sectionHtml(
  title: string,
  tasks: DigestTaskItem[],
  borderColor: string,
  totalCount: number,
  baseUrl: string,
  now: Date,
  showAssignee = false,
): string {
  if (tasks.length === 0) return "";

  const moreCount = totalCount - tasks.length;
  const moreRow = moreCount > 0
    ? `<tr><td style="padding:10px 16px;text-align:center;font-size:12px;color:#64748B;background:#F8FAFC;border-top:1px solid #EEF2F6;">+${moreCount} görev daha · <a href="${escapeHtml(baseUrl)}/dashboard" style="color:${EMAIL_BRAND.primary};text-decoration:none;font-weight:600;">Tümünü gör &rarr;</a></td></tr>`
    : "";

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #E2E8F0;border-left:4px solid ${borderColor};border-radius:8px;overflow:hidden;">
<tr><td style="padding:14px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
  <span style="font-size:15px;font-weight:700;color:#0F172A;">${escapeHtml(title)}</span>
  <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;color:${borderColor};background:#fff;border:1px solid ${borderColor};margin-left:8px;">${totalCount}</span>
</td></tr>
<tr><td style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">
    ${tasks.map((t) => taskRowHtml(t, baseUrl, now, showAssignee)).join("\n    ")}
    ${moreRow}
  </table>
</td></tr>
</table>`;
}

/** Bugünün özeti — tek satır istatistik (HTML) */
function todaySummaryLineHtml(stats: DigestStats, completedCount: number): string {
  const parts: string[] = [];
  if (stats.overdueCount > 0) parts.push(`<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;color:#DC2626;background:#FEF2F2;margin-right:6px;">${stats.overdueCount} gecikmiş</span>`);
  if (stats.todayCount > 0) parts.push(`<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;color:#B45309;background:#FFFBEB;margin-right:6px;">${stats.todayCount} bugün bitmeli</span>`);
  if (completedCount > 0) parts.push(`<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;color:#047857;background:#ECFDF5;margin-right:6px;">${completedCount} tamamlandı</span>`);
  if (parts.length === 0) parts.push(`<span style="font-size:13px;color:#64748B;">Bugün için planlanan görev yok.</span>`);
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;"><tr><td style="padding:14px 18px;background:${EMAIL_BRAND.bgLight};border-radius:8px;border:1px solid #E2E8F0;">
  <span style="font-size:13px;font-weight:600;color:#475569;margin-right:10px;">Bugünün özeti:</span>${parts.join("")}
</td></tr></table>`;
}

/** Bugünkü ilerleme çubuğu (bugün tamamlanan / toplam) — sadece bugün görev varken */
function todayProgressBarHtml(todayCompleted: number, todayTotal: number): string {
  if (todayTotal === 0) return "";
  const pct = Math.min(100, Math.round((todayCompleted / todayTotal) * 100));
  const barColor = pct === 100 ? "#10B981" : pct >= 50 ? EMAIL_BRAND.primaryLight : "#F59E0B";
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
<tr><td style="padding:0 0 8px;">
  <span style="font-size:12px;font-weight:600;color:#64748B;">Bugünkü ilerleme: ${todayCompleted} / ${todayTotal} tamamlandı</span>
</td></tr>
<tr><td style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="height:8px;background:#E2E8F0;border-radius:8px;"><tr>
    <td width="${pct}%" style="background:${barColor};border-radius:8px 0 0 8px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="border-radius:0 8px 8px 0;font-size:0;line-height:0;">&nbsp;</td>
  </tr></table>
</td></tr>
</table>`;
}

/** Yarın kısaca — kompakt liste (en fazla 5 görev) */
function tomorrowCompactSectionHtml(tasks: DigestTaskItem[], baseUrl: string, maxItems: number): string {
  if (tasks.length === 0) return "";
  const show = tasks.slice(0, maxItems);
  const rows = show.map((t) => {
    const link = baseUrl ? `${baseUrl}/dashboard/tasks/${t.id}` : `/dashboard/tasks/${t.id}`;
    return `<tr><td style="padding:8px 16px;border-bottom:1px solid #E2E8F0;">
  <a href="${escapeHtml(link)}" style="font-size:13px;font-weight:500;color:${EMAIL_BRAND.primary};text-decoration:none;">${escapeHtml(t.title)}</a>
</td></tr>`;
  }).join("\n");
  const more = tasks.length > maxItems ? `<tr><td style="padding:8px 16px;text-align:center;font-size:12px;color:#64748B;">+${tasks.length - maxItems} görev daha · <a href="${escapeHtml(baseUrl)}/dashboard" style="color:${EMAIL_BRAND.primary};">Tümünü gör</a></td></tr>` : "";
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #E2E8F0;border-left:4px solid ${EMAIL_BRAND.primaryLight};border-radius:8px;overflow:hidden;">
<tr><td style="padding:12px 16px;background:${EMAIL_BRAND.bgLighter};border-bottom:1px solid #C7D2FE;">
  <span style="font-size:14px;font-weight:700;color:${EMAIL_BRAND.primary};">Yarın kısaca</span>
  <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:700;color:${EMAIL_BRAND.primaryLight};background:#fff;margin-left:8px;">${tasks.length}</span>
</td></tr>
<tr><td style="padding:0;"><table cellpadding="0" cellspacing="0" border="0" width="100%">${rows}${more}</table></td></tr>
</table>`;
}

// ---------------------------------------------------------------------------
// Plain Text Yardımcıları
// ---------------------------------------------------------------------------

function overdueTaskRowText(task: DigestTaskItem, index: number, baseUrl: string): string {
  const link = baseUrl ? `${baseUrl}/dashboard/tasks/${task.id}` : `/dashboard/tasks/${task.id}`;
  const dueStr = new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
  return `${index}. ${task.title}\n   Bitiş: ${dueStr}\n   → ${link}`;
}

function taskRowText(task: DigestTaskItem, index: number, baseUrl: string, now: Date, showAssignee: boolean): string {
  const link = baseUrl ? `${baseUrl}/dashboard/tasks/${task.id}` : `/dashboard/tasks/${task.id}`;
  const parts = [
    `${index}. [${priorityLabel(task.priority)}] ${task.title}`,
  ];
  const meta: string[] = [];
  if (task.projectName) meta.push(task.projectName);
  if (showAssignee && task.assigneeName) meta.push(`Atanan: ${task.assigneeName}`);
  meta.push(statusLabel(task.status));
  meta.push(timeLabel(task, now));
  parts.push(`   ${meta.join(" · ")}`);
  parts.push(`   → ${link}`);
  return parts.join("\n");
}

function sectionText(title: string, tasks: DigestTaskItem[], totalCount: number, baseUrl: string, now: Date, showAssignee = false): string {
  if (tasks.length === 0) return "";
  const lines = [title, "─".repeat(Math.min(title.length, 40))];
  tasks.forEach((t, i) => lines.push(taskRowText(t, i + 1, baseUrl, now, showAssignee)));
  const more = totalCount - tasks.length;
  if (more > 0) lines.push(`   +${more} görev daha`);
  lines.push("");
  return lines.join("\n");
}

function overdueSectionText(tasks: DigestTaskItem[], totalCount: number, baseUrl: string): string {
  if (tasks.length === 0) return "";
  const lines = ["🔴 TAMAMLANMAMIŞ VE SÜRESİ GEÇMİŞ", "─".repeat(35)];
  tasks.forEach((t, i) => lines.push(overdueTaskRowText(t, i + 1, baseUrl)));
  const more = totalCount - tasks.length;
  if (more > 0) lines.push(`   +${more} görev daha`);
  lines.push("");
  return lines.join("\n");
}

function tomorrowCompactText(tasks: DigestTaskItem[], baseUrl: string, maxItems: number): string {
  if (tasks.length === 0) return "";
  const show = tasks.slice(0, maxItems);
  const lines = ["🔵 YARIN KISACA", "─".repeat(14)];
  show.forEach((t, i) => {
    const link = baseUrl ? `${baseUrl}/dashboard/tasks/${t.id}` : `/dashboard/tasks/${t.id}`;
    lines.push(`${i + 1}. ${t.title}`);
    lines.push(`   → ${link}`);
  });
  if (tasks.length > maxItems) lines.push(`   +${tasks.length - maxItems} görev daha`);
  lines.push("");
  return lines.join("\n");
}

/** Okunmamış bildirimler bölümü (HTML) */
function notificationsSectionHtml(items: DigestNotificationItem[], baseUrl: string): string {
  if (items.length === 0) return "";
  const rows = items.map((n) => {
    const link = n.link ? (baseUrl ? `${baseUrl}${n.link.startsWith("/") ? n.link : `/${n.link}`}` : n.link) : (baseUrl ? `${baseUrl}/dashboard` : "/dashboard");
    const bodyLine = n.body ? `<div style="font-size:12px;color:#64748B;margin-top:2px;">${escapeHtml(n.body)}</div>` : "";
    return `<tr><td style="padding:12px 16px;border-bottom:1px solid #E0E7FF;">
  <a href="${escapeHtml(link)}" style="font-size:14px;font-weight:600;color:${EMAIL_BRAND.primary};text-decoration:none;">${escapeHtml(n.title)}</a>
  ${bodyLine}
</td></tr>`;
  }).join("\n");
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #C7D2FE;border-left:4px solid ${EMAIL_BRAND.primaryLight};border-radius:8px;overflow:hidden;">
<tr><td style="padding:14px 16px;background:#EEF2FF;border-bottom:1px solid #C7D2FE;">
  <span style="font-size:15px;font-weight:700;color:#312E81;">Okunmamış bildirimler</span>
  <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;color:${EMAIL_BRAND.primaryLight};background:#fff;border:1px solid ${EMAIL_BRAND.primaryLight};margin-left:8px;">${items.length}</span>
</td></tr>
<tr><td style="padding:0;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
</td></tr>
</table>`;
}

/** Okunmamış bildirimler bölümü (düz metin) */
function notificationsSectionText(items: DigestNotificationItem[], baseUrl: string): string {
  if (items.length === 0) return "";
  const lines = ["🔔 OKUNMAMIŞ BİLDİRİMLER", "─".repeat(28)];
  items.forEach((n, i) => {
    const link = n.link ? (baseUrl ? `${baseUrl}${n.link.startsWith("/") ? n.link : `/${n.link}`}` : n.link) : (baseUrl ? `${baseUrl}/dashboard` : "/dashboard");
    lines.push(`${i + 1}. ${n.title}`);
    if (n.body) lines.push(`   ${n.body}`);
    lines.push(`   → ${link}`);
  });
  lines.push("");
  return lines.join("\n");
}

/** DashboardDurationStats ile aynı biçimlendirme (gün cinsinden). */
function formatDigestDurationDays(days: number): string {
  const totalMinutes = days * 24 * 60;
  const totalHours = days * 24;
  if (totalHours < 1) return `${Math.round(totalMinutes)} dk`;
  if (days < 1) return `${totalHours.toFixed(1)} saat`;
  if (days < 7) return `${days.toFixed(1)} gün`;
  if (days < 28) {
    const weeks = Math.floor(days / 7);
    const remainder = days % 7;
    if (remainder < 0.5) return `${weeks} hafta`;
    return `${weeks} hafta ${remainder.toFixed(0)} gün`;
  }
  const months = days / 30;
  return `${months.toFixed(1)} ay`;
}

function absUrl(baseUrl: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${p}` : p;
}

function digestMetroTile(
  baseUrl: string,
  href: string,
  title: string,
  subtitle: string,
  value: number,
  bg: string,
): string {
  const url = absUrl(baseUrl, href);
  return `<td style="width:33.33%;padding:5px;vertical-align:top;">
<a href="${escapeHtml(url)}" style="display:block;padding:12px 10px;background-color:${bg};color:#fff;text-decoration:none;border-radius:8px;min-height:78px;box-sizing:border-box;">
  <div style="font-size:11px;font-weight:600;opacity:0.92;line-height:1.25;">${escapeHtml(title)}</div>
  <div style="font-size:22px;font-weight:800;margin-top:6px;line-height:1.1;">${value}</div>
  <div style="font-size:10px;opacity:0.88;margin-top:5px;line-height:1.25;">${escapeHtml(subtitle)}</div>
</a>
</td>`;
}

/** Dashboard widget grid ile aynı kutular (3 sütun). */
function digestWidgetGridHtml(
  counts: WidgetCountsPayload,
  baseUrl: string,
  showUnknownEmailWidget: boolean,
): string {
  const w = "#7e6bb8";
  const i = "#d97706";
  const p = "#5c6bc0";
  const n = "#6a5b9e";
  const row = (cells: string) =>
    `<tr>${cells}</tr>`;
  const tiles: string[] = [
    digestMetroTile(baseUrl, "/dashboard/tum-kayitlar?view=inprogress", "Devam Eden Görevler", "Üzerinde çalışılan görevler", counts.inProgressCount, w),
    digestMetroTile(baseUrl, "/dashboard/tum-kayitlar?view=assigned", "Atanan Görevler", "Atanmış görevlere git", counts.assignedCount, w),
    digestMetroTile(baseUrl, "/dashboard/tum-kayitlar?view=overdue", "Geciken Kayıtlar", "Tarihi geçen kayıtlar", counts.overdueCount, w),
    digestMetroTile(baseUrl, "/dashboard/talepler?tab=sent", "Bekleyen Talepler", "Onay bekleyen kalemler", counts.pendingApprovalCount, i),
    digestMetroTile(baseUrl, "/dashboard/email-records", "E-Posta Talepleri", "Gönderilen kayıtları görüntüle", counts.emailRecordsCount, i),
  ];
  if (showUnknownEmailWidget) {
    tiles.push(
      digestMetroTile(baseUrl, "/dashboard/unknown-email-records", "Bilinmeyen Kayıtlar", "Henüz atanmamış e-postalar", counts.unknownRecordsCount, i),
    );
  }
  tiles.push(
    digestMetroTile(baseUrl, "/dashboard/projects", "Projeler", "Dahil olunan projeler", counts.projectsCount, p),
    digestMetroTile(baseUrl, "/dashboard/board", "Notlar", "Notlar panosu", counts.notesCount, n),
    digestMetroTile(baseUrl, "/dashboard/tum-kayitlar?view=completed", "Tamamlanan Görevler", "Tamamlanan görevler", counts.completedCount, n),
  );
  const rows: string[] = [];
  for (let i = 0; i < tiles.length; i += 3) {
    const chunk = tiles.slice(i, i + 3);
    while (chunk.length < 3) chunk.push(`<td style="width:33.33%;padding:5px;"></td>`);
    rows.push(row(chunk.join("")));
  }
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
<tr><td style="padding:14px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
  <span style="font-size:15px;font-weight:700;color:#0F172A;">Dashboard özeti</span>
  <span style="font-size:12px;color:#64748B;display:block;margin-top:4px;">Ana sayfadaki kutucuklarla aynı sayılar</span>
</td></tr>
<tr><td style="padding:10px 8px 14px 8px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%">${rows.join("")}</table>
</td></tr>
</table>`;
}

function digestDurationCell(
  label: string,
  valueHtml: string,
  hint: string,
  linkHref?: string,
  linkLabel?: string,
  baseUrl = "",
): string {
  const link = linkHref
    ? `<div style="font-size:11px;color:#64748B;margin-top:6px;"><a href="${escapeHtml(absUrl(baseUrl, linkHref))}" style="color:${EMAIL_BRAND.primary};text-decoration:none;font-weight:600;">${escapeHtml(linkLabel ?? "")}</a></div>`
    : "";
  return `<td style="width:20%;padding:10px 8px;vertical-align:top;border:1px solid #E2E8F0;border-radius:8px;background:#FAFAFA;">
  <p style="margin:0;font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.04em;line-height:1.3;">${escapeHtml(label)}</p>
  <p style="margin:8px 0 0 0;font-size:18px;font-weight:800;color:#0F172A;line-height:1.2;">${valueHtml}</p>
  <p style="margin:6px 0 0 0;font-size:11px;color:#64748B;line-height:1.35;">${escapeHtml(hint)}</p>
  ${link}
</td>`;
}

function digestDurationStatsHtml(stats: DurationStatsPayload, baseUrl: string): string {
  const avgActual =
    stats.avgActualDays !== null ? escapeHtml(formatDigestDurationDays(stats.avgActualDays)) : "—";
  const avgPlanned =
    stats.avgPlannedDays !== null ? escapeHtml(formatDigestDurationDays(stats.avgPlannedDays)) : "—";
  const row1 = `<tr>${digestDurationCell("Ortalama tamamlanma süresi", avgActual, "Oluşturma → Tamamlama", undefined, undefined, baseUrl)}${digestDurationCell("Bekleyen görevler (planlanan)", avgPlanned, "Ort. planlanan süre", undefined, undefined, baseUrl)}${digestDurationCell("Tamamlanan görevler", String(stats.completedCount), "Toplam tamamlanan", undefined, undefined, baseUrl)}</tr>`;
  const row2 = `<tr><td colspan="3" style="padding-top:10px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
  ${digestDurationCell("Bekleyen görevler", String(stats.pendingCount), "Açık görev (GOREV) sayısı", "/dashboard/tasks", "Görevlere git →", baseUrl)}
  ${digestDurationCell("Bekleyen notlar", String(stats.pendingNotesCount), "Açık not kayıtları", "/dashboard/board", "Notlara git →", baseUrl)}
  </tr></table>
</td></tr>`;
  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #C7D2FE;border-left:4px solid ${EMAIL_BRAND.primaryLight};border-radius:8px;overflow:hidden;">
<tr><td style="padding:14px 16px;background:#EEF2FF;border-bottom:1px solid #C7D2FE;">
  <span style="font-size:15px;font-weight:700;color:#312E81;">⏱️ Süre istatistikleri</span>
  <span style="font-size:12px;color:#64748B;display:block;margin-top:4px;">Dashboard ile aynı hesaplama</span>
</td></tr>
<tr><td style="padding:14px 12px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-spacing:8px 0;">${row1}</table>
  ${row2}
</td></tr>
</table>`;
}

function devamEdenGorevlerSectionHtml(
  tasks: DigestTaskItem[],
  totalCount: number,
  baseUrl: string,
  now: Date,
): string {
  if (tasks.length > 0) {
    return sectionHtml("Devam eden görevler", tasks, SECTION_BORDER_COLORS.inProgress, totalCount, baseUrl, now);
  }
  if (totalCount > 0) {
    const allUrl = absUrl(baseUrl, "/dashboard/tum-kayitlar?view=inprogress");
    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;border:1px solid #E2E8F0;border-left:4px solid ${SECTION_BORDER_COLORS.inProgress};border-radius:8px;overflow:hidden;">
<tr><td style="padding:14px 16px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
  <span style="font-size:15px;font-weight:700;color:#0F172A;">Devam eden görevler</span>
  <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;color:${SECTION_BORDER_COLORS.inProgress};background:#fff;border:1px solid ${SECTION_BORDER_COLORS.inProgress};margin-left:8px;">${totalCount}</span>
</td></tr>
<tr><td style="padding:16px;">
  <p style="margin:0;font-size:14px;color:#475569;">${totalCount} görev üzerinde çalışılıyor. <a href="${escapeHtml(allUrl)}" style="color:${EMAIL_BRAND.primary};font-weight:600;text-decoration:none;">Tümünü gör →</a></p>
</td></tr>
</table>`;
  }
  return "";
}

function widgetCountsSummaryText(
  counts: WidgetCountsPayload,
  baseUrl: string,
  showUnknownEmailWidget: boolean,
): string {
  const L = (path: string) => (baseUrl ? `${baseUrl}${path}` : path);
  const lines = [
    "📊 DASHBOARD ÖZETİ",
    "─".repeat(22),
    `Devam eden görevler: ${counts.inProgressCount} → ${L("/dashboard/tum-kayitlar?view=inprogress")}`,
    `Atanan görevler: ${counts.assignedCount} → ${L("/dashboard/tum-kayitlar?view=assigned")}`,
    `Geciken kayıtlar: ${counts.overdueCount} → ${L("/dashboard/tum-kayitlar?view=overdue")}`,
    `Bekleyen talepler (kalem): ${counts.pendingApprovalCount} → ${L("/dashboard/talepler?tab=sent")}`,
    `E-posta talepleri: ${counts.emailRecordsCount} → ${L("/dashboard/email-records")}`,
  ];
  if (showUnknownEmailWidget) {
    lines.push(`Bilinmeyen kayıtlar: ${counts.unknownRecordsCount} → ${L("/dashboard/unknown-email-records")}`);
  }
  lines.push(
    `Projeler: ${counts.projectsCount} → ${L("/dashboard/projects")}`,
    `Notlar: ${counts.notesCount} → ${L("/dashboard/board")}`,
    `Tamamlanan görevler: ${counts.completedCount} → ${L("/dashboard/tum-kayitlar?view=completed")}`,
    "",
  );
  return lines.join("\n");
}

function durationStatsSummaryText(stats: DurationStatsPayload, baseUrl: string): string {
  const L = (path: string) => (baseUrl ? `${baseUrl}${path}` : path);
  const avgA = stats.avgActualDays !== null ? formatDigestDurationDays(stats.avgActualDays) : "—";
  const avgP = stats.avgPlannedDays !== null ? formatDigestDurationDays(stats.avgPlannedDays) : "—";
  return [
    "⏱️ SÜRE İSTATİSTİKLERİ",
    "─".repeat(24),
    `Ortalama tamamlanma süresi: ${avgA} (oluşturma → tamamlama)`,
    `Bekleyen görevler (planlanan): ${avgP} (ort. planlanan süre)`,
    `Tamamlanan görevler: ${stats.completedCount} (toplam tamamlanan)`,
    `Bekleyen görevler: ${stats.pendingCount} → ${L("/dashboard/tasks")}`,
    `Bekleyen notlar: ${stats.pendingNotesCount} → ${L("/dashboard/board")}`,
    "",
  ].join("\n");
}

function devamEdenGorevlerSectionText(
  tasks: DigestTaskItem[],
  totalCount: number,
  baseUrl: string,
  now: Date,
): string {
  if (tasks.length > 0) {
    return sectionText("🟣 DEVAM EDEN GÖREVLER", tasks, totalCount, baseUrl, now);
  }
  if (totalCount > 0) {
    const url = absUrl(baseUrl, "/dashboard/tum-kayitlar?view=inprogress");
    return ["🟣 DEVAM EDEN GÖREVLER", "─".repeat(24), `${totalCount} görev üzerinde çalışılıyor → ${url}`, ""].join("\n");
  }
  return "";
}

// ---------------------------------------------------------------------------
// Ana Fonksiyon
// ---------------------------------------------------------------------------

/** Günlük görev özeti e-postası gönderir. Sistem e-postası için MAIL_FROM_EMAIL ve MAIL_FROM_NAME env kullanılır. */
export async function sendDailyDigestMail(
  options: SendDailyDigestMailOptions
): Promise<{ ok: boolean; error?: string }> {
  const transporter = await getTransporter();
  if (!transporter) {
    return { ok: false, error: "SMTP yapılandırılmamış. Ayarlar > SMTP veya MAIL_FROM_EMAIL ile yapılandırın." };
  }

  const fromEmail = process.env.MAIL_FROM_EMAIL || "noreply@notbak.local";
  const fromName = process.env.MAIL_FROM_NAME || "NotBak";
  const fromStr = `"${fromName}" <${fromEmail}>`;
  const baseUrl = (options.baseUrl || resolveBaseUrl()).replace(/\/$/, "");
  const now = new Date();
  const todayStr = now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
  const { stats } = options;

  // --- Dinamik konu satırı ---
  const unreadCount = options.unreadNotifications?.length ?? 0;
  let subject: string;
  if (stats.overdueCount > 0) {
    subject = `[NotBak] ⚠️ ${stats.overdueCount} gecikmiş görev! – Günlük özet (${todayStr})`;
  } else if (stats.todayCount > 0) {
    subject = `[NotBak] Bugün ${stats.todayCount} göreviniz var – Günlük özet (${todayStr})`;
  } else {
    subject = `[NotBak] Günlük görev özeti – ${todayStr}`;
  }
  if (unreadCount > 0) {
    subject = subject.replace(" – ", ` · ${unreadCount} okunmamış bildirim – `);
  }

  // --- HTML İçerik ---
  const completedCount = options.lastCompleted.length;
  const todayCompleted = options.todayTasks.filter((t) => t.status === "TAMAMLANDI").length;

  const todaySummaryHtml = todaySummaryLineHtml(stats, completedCount);
  const notificationsHtml = (options.unreadNotifications?.length ?? 0) > 0
    ? notificationsSectionHtml(options.unreadNotifications ?? [], baseUrl)
    : "";
  const showUnknown = options.showUnknownEmailWidget === true;
  const widgetGridHtml = digestWidgetGridHtml(options.widgetCounts, baseUrl, showUnknown);
  const durationStatsHtmlBlock = digestDurationStatsHtml(options.durationStats, baseUrl);
  const inProgressTotal = options.widgetCounts.inProgressCount;

  /** Outlook margin desteği zayıf; bölüm arası boşluk için padding tablosu kullanıyoruz */
  const wrapSection = (s: string) =>
    s ? `<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding-bottom:24px;">${s}</td></tr></table>` : "";

  const sections = [
    wrapSection(notificationsHtml),
    wrapSection(widgetGridHtml),
    wrapSection(todaySummaryHtml),
    wrapSection(overdueSectionHtml(options.overdueTasks, stats.overdueCount, baseUrl)),
    wrapSection(sectionHtml("O gün bitmesi gerekenler", options.todayTasks, SECTION_BORDER_COLORS.today, stats.todayCount, baseUrl, now)),
    options.todayTasks.length === 0
      ? wrapSection(`<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding:18px 20px;background:#F0FDF4;border:1px solid #BBF7D0;text-align:center;"><span style="font-size:14px;color:#166534;font-weight:600;">&#x2728; Bugün için planlanmış görev yok — iyi bir gün!</span></td></tr></table>`)
      : "",
    wrapSection(todayProgressBarHtml(todayCompleted, stats.todayCount)),
    wrapSection(devamEdenGorevlerSectionHtml(options.inProgressTasks, inProgressTotal, baseUrl, now)),
    wrapSection(tomorrowCompactSectionHtml(options.tomorrowTasks, baseUrl, 5)),
    wrapSection(sectionHtml("Son tamamlananlar", options.lastCompleted, SECTION_BORDER_COLORS.completed, options.lastCompleted.length, baseUrl, now)),
    wrapSection(durationStatsHtmlBlock),
  ].filter(Boolean).join("\n");

  const dashboardLink = baseUrl ? `${baseUrl}/dashboard` : "/dashboard";
  const calismalarLink = baseUrl ? `${baseUrl}/dashboard/tum-kayitlar` : "/dashboard/tum-kayitlar";
  const kayitlarLink = baseUrl ? `${baseUrl}/dashboard/talepler` : "/dashboard/talepler";
  const prefsLink = baseUrl ? `${baseUrl}/dashboard/settings` : "/dashboard/settings";

  const quickLinks = `<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr>
  <td style="text-align:center;padding:6px 4px;width:33%;">
    <a href="${escapeHtml(dashboardLink)}" style="display:block;padding:14px 10px;background:${EMAIL_BRAND.primary};color:#fff;text-decoration:none;font-size:14px;font-weight:700;text-align:center;">Dashboard</a>
  </td>
  <td style="text-align:center;padding:6px 4px;width:33%;">
    <a href="${escapeHtml(calismalarLink)}" style="display:block;padding:14px 10px;background:${EMAIL_BRAND.tileGorevler};color:#fff;text-decoration:none;font-size:14px;font-weight:700;text-align:center;">Çalışmalar</a>
  </td>
  <td style="text-align:center;padding:6px 4px;width:33%;">
    <a href="${escapeHtml(kayitlarLink)}" style="display:block;padding:14px 10px;background:${EMAIL_BRAND.tileNotlar};color:#fff;text-decoration:none;font-size:14px;font-weight:700;text-align:center;">Kayıtlar</a>
  </td>
</tr>
</table>`;

  const footer = `<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="border-top:1px solid #E2E8F0;padding-top:24px;text-align:center;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 auto;">
    <tr><td style="font-size:12px;color:${EMAIL_BRAND.textMuted};padding-bottom:4px;">Bu e-posta NotBak tarafından otomatik gönderilir.</td></tr>
    <tr><td style="font-size:11px;color:${EMAIL_BRAND.textMuted};padding-bottom:12px;">Özet sıklığını veya içeriğini değiştirmek için tercihlerinizi güncelleyebilirsiniz.</td></tr>
    <tr><td><a href="${escapeHtml(prefsLink)}" style="font-size:13px;color:${EMAIL_BRAND.primary};text-decoration:none;font-weight:600;">Özet tercihlerini değiştir →</a></td></tr>
  </table>
</td></tr>
</table>`;

  const html = `<!DOCTYPE html>
<html lang="tr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style type="text/css">table{border-collapse:collapse;} .outlook-main{border-radius:0 !important;box-shadow:none !important;}</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.bgLight};font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${EMAIL_BRAND.bgLight};">
<tr><td style="padding:36px 16px;" align="center">
  <table class="outlook-main" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <tr><td style="background:#FFFFFF;padding:20px 24px;border-bottom:1px solid #E2E8F0;text-align:right;">
      <span style="font-size:14px;font-weight:600;color:#8B5CF6;">${escapeHtml(todayStr)}</span>
    </td></tr>

    <tr><td style="background:${EMAIL_BRAND.bgLight};padding:20px 36px;border-bottom:1px solid #E2E8F0;text-align:center;">
      <span style="font-size:16px;color:#334155;">Merhaba <strong style="color:#1E293B;">${escapeHtml(options.toName)}</strong>, günlük özetiniz hazır.</span>
    </td></tr>

    <tr><td style="padding:28px 36px;">
      ${sections}
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="padding-bottom:28px;">${quickLinks}</td></tr></table>
      ${footer}
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  // --- Plain Text İçerik ---
  const notificationsText = (options.unreadNotifications?.length ?? 0) > 0
    ? notificationsSectionText(options.unreadNotifications ?? [], baseUrl)
    : "";
  const textSections = [
    notificationsText,
    widgetCountsSummaryText(options.widgetCounts, baseUrl, showUnknown),
    `Bugünün özeti: ${stats.overdueCount} gecikmiş · ${stats.todayCount} bugün bitmeli · ${completedCount} tamamlandı`,
    "",
    overdueSectionText(options.overdueTasks, stats.overdueCount, baseUrl),
    sectionText("🟡 O GÜN BİTMESİ GEREKENLER", options.todayTasks, stats.todayCount, baseUrl, now),
    options.todayTasks.length === 0 ? "Bugün için planlanmış görev yok — iyi bir gün!\n" : "",
    todayCompleted > 0 && stats.todayCount > 0 ? `Bugünkü ilerleme: ${todayCompleted}/${stats.todayCount} tamamlandı\n` : "",
    devamEdenGorevlerSectionText(options.inProgressTasks, inProgressTotal, baseUrl, now),
    tomorrowCompactText(options.tomorrowTasks, baseUrl, 5),
    sectionText("✅ SON TAMAMLANANLAR", options.lastCompleted, options.lastCompleted.length, baseUrl, now),
    durationStatsSummaryText(options.durationStats, baseUrl),
  ].filter(Boolean).join("\n");

  const text = [
    `NotBak — Günlük Görev Özeti (${todayStr})`,
    "═".repeat(50),
    "",
    `Merhaba ${options.toName},`,
    "",
    textSections,
    "🔗 Dashboard: " + dashboardLink,
    "🔗 Çalışmalar: " + calismalarLink,
    "🔗 Kayıtlar: " + kayitlarLink,
    "",
    "— NotBak",
    "Özet tercihlerini değiştirmek için: " + prefsLink,
  ].join("\n");

  try {
    await transporter.sendMail({ from: fromStr, to: options.toEmail, subject, text, html });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sendDailyDigestMail failed:", message);
    return { ok: false, error: message };
  }
}
