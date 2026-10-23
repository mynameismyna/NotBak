import { prisma } from "@/lib/prisma";
import { getImapConfigFromDb } from "@/lib/imap-config";
import { createNotification } from "@/lib/notifications";
import { ensureInboundEmailRecordTable } from "@/lib/ensure-email-table";
import { htmlToPlainText, cleanBodyText } from "@/lib/html-to-text";

export interface PollResult {
  processed: number;
  matched: number;
  unknown: number;
  skipped: number;
  errors: string[];
}

const POLL_TIMEOUT_MS = 60_000;

export async function pollInboundEmails(): Promise<PollResult> {
  const result: PollResult = { processed: 0, matched: 0, unknown: 0, skipped: 0, errors: [] };

  await ensureInboundEmailRecordTable();

  const config = await getImapConfigFromDb();
  if (!config?.host || !config?.user) {
    result.errors.push("IMAP ayarları eksik veya tanımlı değil.");
    return result;
  }

  const { ImapFlow } = await import("imapflow");
  const mailparser = await import("mailparser");

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: config.rejectUnauthorized },
    logger: false,
  });

  try {
    await client.connect();
  } catch (err) {
    result.errors.push(`IMAP bağlantı hatası: ${(err as Error).message}`);
    return result;
  }

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), POLL_TIMEOUT_MS)
  );

  const pollPromise = (async () => {
    let lock;
    try {
      lock = await client.getMailboxLock(config.folder || "INBOX");

      let uids: number[] = [];
      try {
        const searchResult = await client.search({ seen: false }, { uid: true });
        if (Array.isArray(searchResult)) {
          uids = searchResult as number[];
        }
      } catch {
        // search başarısız — fallback: tüm mesajları deneme
      }

      if (uids.length === 0) {
        return;
      }

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(String(uid), {
            source: true,
            envelope: true,
          }, { uid: true });

          const source = (msg && typeof msg === "object" && "source" in msg ? msg.source : undefined) as Buffer | undefined;
          if (!source) {
            result.skipped++;
            continue;
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed: any = await mailparser.simpleParser(source as any);
          const envelopeMsgId = msg && typeof msg === "object" && "envelope" in msg ? (msg.envelope as { messageId?: string })?.messageId : undefined;
          const messageId: string | null = parsed.messageId || envelopeMsgId || null;
          const fromAddr: string = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
          const subject: string = parsed.subject || "(Konu yok)";
          const bodyHtml: string | null = typeof parsed.html === "string" ? parsed.html : null;
          const rawText: string = typeof parsed.text === "string" ? parsed.text.trim() : "";

          let bodyText: string;
          if (bodyHtml) {
            // HTML varsa kendi dönüştürücümüzle temiz metin üret
            // (mailparser'ın text çıktısı orphan attribute kalıntıları bırakabiliyor)
            bodyText = htmlToPlainText(bodyHtml);
          } else if (rawText) {
            bodyText = cleanBodyText(rawText);
          } else {
            bodyText = "";
          }

          if (messageId) {
            try {
              const exists = await prisma.inboundEmailRecord.findUnique({
                where: { messageId },
              });
              if (exists) {
                result.skipped++;
                try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
                continue;
              }
            } catch {
              // findUnique hatası, devam et
            }
          }

          let userId: string | null = null;
          if (fromAddr) {
            const allUsers = await prisma.user.findMany({
              where: { isActive: true },
              select: { id: true, email: true },
            });
            const matchedUser = allUsers.find(
              (u) => u.email.toLowerCase() === fromAddr
            );
            userId = matchedUser?.id ?? null;
          }

          await prisma.inboundEmailRecord.create({
            data: {
              fromEmail: fromAddr || "(bilinmeyen)",
              userId,
              subject: subject.slice(0, 1000),
              bodyText,
              bodyHtml,
              messageId: messageId?.slice(0, 500) || null,
              status: "PENDING",
            },
          });

          result.processed++;

          if (userId) {
            result.matched++;
            try {
              const pendingCount = await prisma.inboundEmailRecord.count({
                where: { userId, status: "PENDING" },
              });
              if (pendingCount === 1) {
                await createNotification({
                  userId,
                  type: "EMAIL_RECORD_PENDING",
                  title: "E-posta ile gönderilen kayıtlar var",
                  body: `"${subject.slice(0, 100)}" konulu e-postanız alındı.`,
                  link: "/dashboard/email-records",
                });
              }
            } catch { /* bildirim hatası kritik değil */ }
          } else {
            result.unknown++;
            try {
              const admins = await prisma.user.findMany({
                where: {
                  OR: [
                    { isAdmin: true },
                    { globalRole: "ADMIN" },
                  ],
                },
                select: { id: true },
              });
              for (const admin of admins) {
                await createNotification({
                  userId: admin.id,
                  type: "UNKNOWN_EMAIL_RECORD",
                  title: "Bilinmeyen gönderenden e-posta kaydı",
                  body: `"${fromAddr || "?"}" adresinden "${subject.slice(0, 80)}" konulu e-posta alındı.`,
                  link: "/dashboard/unknown-email-records",
                });
              }
            } catch { /* bildirim hatası kritik değil */ }
          }

          try { await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true }); } catch { /* ignore */ }
        } catch (msgErr) {
          result.errors.push(`Mesaj işleme hatası (uid:${uid}): ${(msgErr as Error).message}`);
        }
      }
    } catch (err) {
      result.errors.push(`IMAP işlem hatası: ${(err as Error).message}`);
    } finally {
      if (lock) lock.release();
    }
  })();

  const raceResult = await Promise.race([pollPromise, timeoutPromise]);
  if (raceResult === "timeout") {
    result.errors.push("Yoklama zaman aşımına uğradı (60 saniye). Bazı mesajlar işlenememiş olabilir.");
  }

  try { await client.logout(); } catch { /* ignore */ }

  return result;
}
