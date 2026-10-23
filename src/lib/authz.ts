/**
 * Yetkilendirme (Authorization) modülü.
 * Rol hiyerarşisi ve scope kurallarına göre erişim kontrolü.
 * Doküman: docs/PROJE_PLANI_VE_ROL_YETKILERI.md
 */

import { prisma } from "@/lib/prisma";

/** Global roller */
export const GLOBAL_ROLE = {
  ADMIN: "ADMIN",
  YONETICI: "YONETICI",
} as const;

/** Birim/Proje/Ekip roller */
export const UNIT_ROLE = { BIRIM_YONETICISI: "BIRIM_YONETICISI", EKIP_UYESI: "EKIP_UYESI" } as const;
export const PROJECT_ROLE = { PROJE_YONETICISI: "PROJE_YONETICISI", EKIP_UYESI: "EKIP_UYESI" } as const;
export const TEAM_ROLE = { EKIP_YONETICISI: "EKIP_YONETICISI", EKIP_UYESI: "EKIP_UYESI" } as const;

/** Delegasyon / Collaborator yetkisi */
export const PERMISSION = { READ_ONLY: "READ_ONLY", FULL: "FULL" } as const;

export type GlobalRole = (typeof GLOBAL_ROLE)[keyof typeof GLOBAL_ROLE] | null;
export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  isAdmin?: boolean;
  globalRole?: string | null;
}

/**
 * Kullanıcının efektif global rolü: isAdmin true ise ADMIN, yoksa globalRole.
 */
export function getEffectiveGlobalRole(user: AuthUser): GlobalRole {
  if (user.isAdmin) return GLOBAL_ROLE.ADMIN;
  if (user.globalRole === GLOBAL_ROLE.ADMIN) return GLOBAL_ROLE.ADMIN;
  if (user.globalRole === GLOBAL_ROLE.YONETICI) return GLOBAL_ROLE.YONETICI;
  return null;
}

/**
 * Ayarlar (Settings/Config) sayfalarına sadece Admin erişebilir.
 * Yönetici erişemez.
 */
export function canAccessSettings(user: AuthUser): boolean {
  return getEffectiveGlobalRole(user) === GLOBAL_ROLE.ADMIN;
}

/**
 * Çerezdeki yetki bilgisi (isAdmin/globalRole) girişte yazılır ve 7 güne
 * kadar bayat kalabilir. Ayarlar/LDAP/kullanıcı yönetimi gibi kritik
 * rotalarda yetki DB'deki güncel kayıttan doğrulanır: hesap pasifleştirilen
 * veya yetkisi düşürülen kullanıcının erişimi hemen kesilir.
 */
export async function canAccessSettingsFresh(session: AuthUser | null | undefined): Promise<boolean> {
  if (!session?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { isAdmin: true, globalRole: true, isActive: true },
  });
  if (!user?.isActive) return false;
  return getEffectiveGlobalRole({ ...session, isAdmin: user.isAdmin, globalRole: user.globalRole }) === GLOBAL_ROLE.ADMIN;
}

/**
 * Sadece Admin, Admin rolü atayabilir (kullanıcı oluşturma/güncelleme).
 */
export function canAssignAdmin(actor: AuthUser): boolean {
  return getEffectiveGlobalRole(actor) === GLOBAL_ROLE.ADMIN;
}

/**
 * Yönetici en fazla Yönetici rolü atayabilir; Admin atayamaz.
 */
export function canAssignRole(actor: AuthUser, targetGlobalRole: string | null, targetIsAdmin: boolean): boolean {
  const actorRole = getEffectiveGlobalRole(actor);
  if (actorRole === GLOBAL_ROLE.ADMIN) return true;
  if (actorRole === GLOBAL_ROLE.YONETICI) {
    if (targetIsAdmin || targetGlobalRole === GLOBAL_ROLE.ADMIN) return false;
    return true;
  }
  return false;
}

/**
 * Admin kullanıcıya yardımcı atanamaz.
 */
export function canHaveAssistant(user: AuthUser): boolean {
  return getEffectiveGlobalRole(user) !== GLOBAL_ROLE.ADMIN;
}

/**
 * Yardımcı atamayı yapabilir mi:
 * - Admin: herkes için (master role).
 * - Kendisi: sadece kendi hesabı için.
 * - Hiyerarşik üst: sadece altındaki kullanıcılar için (yönettiği birimlerdeki üyeler).
 */
export async function canAssignAssistant(actor: AuthUser, targetUserId: string): Promise<boolean> {
  const actorRole = getEffectiveGlobalRole(actor);
  if (actorRole === GLOBAL_ROLE.ADMIN) return true;
  if (actor.id === targetUserId) return true;
  const managedUnitIds = await getUnitIdsWhereUserIsManager(actor.id);
  if (managedUnitIds.length === 0) return false;
  const targetInManaged = await prisma.unitMember.findFirst({
    where: { userId: targetUserId, unitId: { in: managedUnitIds } },
  });
  return !!targetInManaged;
}

/**
 * Kullanıcının yöneticisi olduğu birim ID'leri (Birim Yöneticisi için).
 */
export async function getUnitIdsWhereUserIsManager(userId: string): Promise<string[]> {
  const memberships = await prisma.unitMember.findMany({
    where: { userId, role: UNIT_ROLE.BIRIM_YONETICISI },
    select: { unitId: true },
  });
  return memberships.map((m) => m.unitId);
}

/**
 * İki kullanıcı aynı birimde mi (en az bir ortak birim).
 */
export async function areUsersInSameUnit(userId1: string, userId2: string): Promise<boolean> {
  const u1 = await prisma.unitMember.findMany({ where: { userId: userId1 }, select: { unitId: true } });
  const u2 = await prisma.unitMember.findMany({ where: { userId: userId2 }, select: { unitId: true } });
  const set1 = new Set(u1.map((x) => x.unitId));
  return u2.some((x) => set1.has(x.unitId));
}

/**
 * Proje yedeği: süre dolmuşsa efektif yetki READ_ONLY.
 */
export function getEffectiveProjectDelegatePermission(
  permission: string,
  fullPermissionExpiresAt: Date | null
): Permission {
  if (permission === PERMISSION.FULL && fullPermissionExpiresAt && new Date() < fullPermissionExpiresAt) {
    return PERMISSION.FULL;
  }
  return PERMISSION.READ_ONLY;
}
