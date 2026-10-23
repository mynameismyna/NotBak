export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startImapScheduler } = await import("@/lib/imap-scheduler");
    await startImapScheduler();

    if (process.env.ENABLE_INTERNAL_CRON !== "false") {
      const cron = await import("node-cron");
      const { runDailyDigest } = await import("@/lib/daily-digest-cron");
      const { resolveBaseUrl } = await import("@/lib/base-url");

      cron.schedule("* * * * *", async () => {
        try {
          const baseUrl = resolveBaseUrl();
          const result = await runDailyDigest({ baseUrl });
          if (result.totalEligible > 0 || result.sent > 0) {
            console.log(
              `[Daily digest] ${result.currentTime} – gönderilen: ${result.sent}, uygun: ${result.totalEligible}`,
              result.errors?.length ? result.errors : ""
            );
          }
        } catch (e) {
          console.error("[Daily digest] Tetikleme hatası:", e);
        }
      });
      console.log("[NotBak] Dahili günlük özet zamanlayıcısı açıldı (her dakika).");
    }
  }
}
