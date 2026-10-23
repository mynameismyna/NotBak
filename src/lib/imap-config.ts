import { prisma } from "@/lib/prisma";

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  folder: string;
  pollInterval: number; // dakika
  rejectUnauthorized: boolean;
}

const IMAP_KEY = "imap";

export async function getImapConfigFromDb(): Promise<ImapConfig | null> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: IMAP_KEY },
    });
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    const host = typeof parsed.host === "string" ? parsed.host.trim() : "";
    if (!host) return null;
    return {
      host,
      port: typeof parsed.port === "number" ? parsed.port : 993,
      secure: parsed.secure !== false,
      user: typeof parsed.user === "string" ? parsed.user : "",
      password: typeof parsed.password === "string" ? parsed.password : "",
      folder: typeof parsed.folder === "string" && parsed.folder.trim() ? parsed.folder.trim() : "INBOX",
      pollInterval: typeof parsed.pollInterval === "number" ? parsed.pollInterval : 5,
      rejectUnauthorized: parsed.rejectUnauthorized !== false,
    };
  } catch {
    return null;
  }
}

export async function saveImapConfigToDb(config: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  folder?: string;
  pollInterval?: number;
  rejectUnauthorized?: boolean;
}): Promise<void> {
  const value = JSON.stringify({
    host: config.host.trim(),
    port: config.port || 993,
    secure: config.secure,
    user: config.user.trim(),
    password: config.password,
    folder: config.folder?.trim() || "INBOX",
    pollInterval: config.pollInterval || 5,
    rejectUnauthorized: config.rejectUnauthorized !== false,
  });
  await prisma.appSetting.upsert({
    where: { key: IMAP_KEY },
    create: { id: `imap-${Date.now()}`, key: IMAP_KEY, value },
    update: { value },
  });
}
