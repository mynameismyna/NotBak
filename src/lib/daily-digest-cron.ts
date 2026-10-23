import { prisma } from "@/lib/prisma";
import { formatUserDisplayName } from "@/lib/display-name";
import { getSetupConfig } from "@/lib/config";
import { getDailyDigestDataForUser } from "@/lib/daily-digest";
import { sendDailyDigestMail } from "@/lib/email";

const DEFAULT_DIGEST_TIME = "08:00";

export type RunDailyDigestOptions = {
  /** E-posta içindeki linkler için base URL. Verilmezse resolveBaseUrl() ile belirlenir. */
  baseUrl?: string;
};

export type RunDailyDigestResult = {
  ok: boolean;
  sent: number;
  totalEligible: number;
  currentTime: string;
  errors?: string[];
  error?: string;
};

/**
 * Günlük e-posta özetini çalıştırır: sunucunun yerel saatine göre "bu saatte mail almak isteyen"
 * kullanıcılara özet gönderir. Hem API route hem uygulama içi zamanlayıcı tarafından kullanılır.
 */
export async function runDailyDigest(
  options: RunDailyDigestOptions = {}
): Promise<RunDailyDigestResult> {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return {
        ok: false,
        sent: 0,
        totalEligible: 0,
        currentTime: "",
        error: "Kurulum tamamlanmamış",
      };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // Saat filtresi DB'de uygulanır: dakikalık tetiklemelerin çoğunda sorgu
    // 0 satır döner (önceden tüm uygun kullanıcılar her dakika belleğe
    // çekilip JS'te filtreleniyordu).
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        dailyDigestEnabled: true,
        ...(currentTimeStr === DEFAULT_DIGEST_TIME
          ? { OR: [{ dailyDigestTime: currentTimeStr }, { dailyDigestTime: null }] }
          : { dailyDigestTime: currentTimeStr }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        lastDigestSentAt: true,
        dailyDigestTime: true,
      },
    });

    const baseUrl = options.baseUrl;

    let sent = 0;
    const errors: string[] = [];

    for (const user of users) {
      const lastSent = user.lastDigestSentAt;
      if (lastSent && lastSent >= startOfToday) {
        continue;
      }

      const digestData = await getDailyDigestDataForUser(user.id);
      const result = await sendDailyDigestMail({
        toEmail: user.email,
        toName: formatUserDisplayName(user.displayName) || user.displayName,
        ...digestData,
        baseUrl: baseUrl || undefined,
      });

      if (result.ok) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastDigestSentAt: new Date() },
        });
        sent++;
      } else {
        errors.push(`${user.email}: ${result.error || "Bilinmeyen hata"}`);
      }
    }

    return {
      ok: true,
      sent,
      totalEligible: users.length,
      currentTime: currentTimeStr,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("runDailyDigest failed:", message);
    return {
      ok: false,
      sent: 0,
      totalEligible: 0,
      currentTime: "",
      error: message,
    };
  }
}
