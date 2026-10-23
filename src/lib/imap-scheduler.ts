import { getImapConfigFromDb } from "@/lib/imap-config";

let timer: ReturnType<typeof setInterval> | null = null;
let currentIntervalMs = 0;

async function tick() {
  try {
    const { pollInboundEmails } = await import("@/lib/imap-poller");
    const result = await pollInboundEmails();
    if (result.processed > 0 || result.errors.length > 0) {
      console.log(
        `[IMAP Scheduler] Yoklama tamamlandı: ${result.processed} işlendi, ${result.matched} eşleşti, ${result.unknown} bilinmeyen, ${result.skipped} atlandı` +
        (result.errors.length > 0 ? ` | Hatalar: ${result.errors.join("; ")}` : "")
      );
    }
  } catch (err) {
    console.error("[IMAP Scheduler] Yoklama hatası:", err);
  }
}

export async function startImapScheduler() {
  stopImapScheduler();

  // Dahili IMAP yoklaması kapatılabilir (örn. harici zamanlayıcı
  // /api/cron/imap-poll'u tetikliyorsa web process'i bu işi yapmaz).
  if (process.env.ENABLE_INTERNAL_IMAP_POLL === "false") {
    console.log("[IMAP Scheduler] ENABLE_INTERNAL_IMAP_POLL=false, dahili zamanlayıcı kapalı.");
    return;
  }

  try {
    const config = await getImapConfigFromDb();
    if (!config?.host || !config?.user) {
      console.log("[IMAP Scheduler] IMAP ayarları tanımlı değil, zamanlayıcı başlatılmadı.");
      return;
    }

    const intervalMin = config.pollInterval || 5;
    currentIntervalMs = intervalMin * 60 * 1000;

    console.log(`[IMAP Scheduler] ${intervalMin} dakika aralıkla otomatik yoklama başlatıldı.`);

    // İlk yoklamayı 30 saniye sonra yap (sunucu tam ayağa kalksın)
    setTimeout(() => {
      tick();
      timer = setInterval(tick, currentIntervalMs);
    }, 30_000);
  } catch (err) {
    console.error("[IMAP Scheduler] Başlatma hatası:", err);
  }
}

export function stopImapScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    currentIntervalMs = 0;
  }
}

export async function restartImapScheduler() {
  console.log("[IMAP Scheduler] Yeniden başlatılıyor...");
  await startImapScheduler();
}
