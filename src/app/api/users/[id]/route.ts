import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetupConfig } from "@/lib/config";
import { getSessionFromHeaders } from "@/lib/auth";
import { canAssignRole, canAssignAssistant, canAccessSettingsFresh, getEffectiveGlobalRole, GLOBAL_ROLE, UNIT_ROLE, areUsersInSameUnit, getUnitIdsWhereUserIsManager } from "@/lib/authz";

/** Kullanıcı güncelle: globalRole, assistantUserId, isActive, displayName. Yetki kuralları uygulanır. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }

    const { id: targetUserId } = await params;
    const body = await request.json();
    const {
      displayName: bodyDisplayName,
      isActive: bodyIsActive,
      globalRole: bodyGlobalRole,
      isAdmin: bodyIsAdmin,
      assistantUserId: bodyAssistantId,
      unitMemberships: bodyUnitMemberships,
    } = body;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true, isActive: true, isAdmin: true, globalRole: true, assistantUserId: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const wantAdmin = bodyIsAdmin === undefined ? targetUser.isAdmin : !!bodyIsAdmin;
    const wantGlobalRole =
      bodyGlobalRole === undefined
        ? targetUser.globalRole
        : bodyGlobalRole === GLOBAL_ROLE.ADMIN
          ? GLOBAL_ROLE.ADMIN
          : bodyGlobalRole === GLOBAL_ROLE.YONETICI
            ? GLOBAL_ROLE.YONETICI
            : null;
    const assistantUserId =
      bodyAssistantId === undefined
        ? targetUser.assistantUserId
        : typeof bodyAssistantId === "string" && bodyAssistantId.trim()
          ? bodyAssistantId.trim()
          : null;

    if (!canAssignRole(session, wantGlobalRole, wantAdmin)) {
      return NextResponse.json(
        { error: "Sadece Admin kullanıcıları Admin rolü atayabilir. Yönetici en fazla Yönetici rolü atayabilir." },
        { status: 403 }
      );
    }

    if (session.id !== targetUserId) {
      const canAssign = await canAssignAssistant(session, targetUserId);
      if (!canAssign) {
        return NextResponse.json({ error: "Bu kullanıcının bilgilerini güncelleme yetkiniz yok" }, { status: 403 });
      }
      if (session.globalRole === GLOBAL_ROLE.YONETICI || session.isAdmin) {
        // Admin veya global Yönetici: tüm alanları güncelleyebilir (rol kuralı zaten yukarıda)
      } else {
        const managedUnitIds = await getUnitIdsWhereUserIsManager(session.id);
        if (managedUnitIds.length === 0) {
          return NextResponse.json({ error: "Bu kullanıcıyı güncelleme yetkiniz yok" }, { status: 403 });
        }
        const targetInManagedUnit = await prisma.unitMember.findFirst({
          where: { userId: targetUserId, unitId: { in: managedUnitIds } },
        });
        if (!targetInManagedUnit) {
          return NextResponse.json({ error: "Sadece kendi biriminizdeki kullanıcıları güncelleyebilirsiniz" }, { status: 403 });
        }
      }
    } else {
      // Kendi profilini güncelliyor: sadece displayName ve assistantUserId (rol/isActive değiştirilemez)
    }

    if (wantAdmin && assistantUserId) {
      return NextResponse.json({ error: "Admin kullanıcıya yardımcı atanamaz" }, { status: 400 });
    }
    if (assistantUserId) {
      const assistantUser = await prisma.user.findUnique({
        where: { id: assistantUserId },
        select: { id: true, isAdmin: true, globalRole: true },
      });
      if (!assistantUser) {
        return NextResponse.json({ error: "Yardımcı olarak seçilen kullanıcı bulunamadı" }, { status: 400 });
      }
      if (assistantUser.isAdmin || assistantUser.globalRole === GLOBAL_ROLE.ADMIN) {
        return NextResponse.json({ error: "Admin kullanıcı yardımcı olarak atanamaz" }, { status: 400 });
      }
      const sameUnit = await areUsersInSameUnit(targetUserId, assistantUserId);
      if (!sameUnit) {
        return NextResponse.json({ error: "Yardımcı, atanan kullanıcıyla aynı birimde olmalıdır" }, { status: 400 });
      }
    }

    const updateData: {
      displayName?: string;
      isActive?: boolean;
      isAdmin?: boolean;
      globalRole?: string | null;
      assistantUserId?: string | null;
    } = {};
    const isSelf = session.id === targetUserId;
    if (bodyDisplayName !== undefined && typeof bodyDisplayName === "string") {
      updateData.displayName = bodyDisplayName.trim() || targetUser.displayName;
    }
    if (!isSelf) {
      if (bodyIsActive !== undefined) updateData.isActive = !!bodyIsActive;
      if (bodyGlobalRole !== undefined || bodyIsAdmin !== undefined) {
        updateData.isAdmin = wantAdmin;
        updateData.globalRole = wantGlobalRole;
      }
    }
    if (bodyAssistantId !== undefined) {
      updateData.assistantUserId = assistantUserId;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      select: {
        id: true,
        email: true,
        displayName: true,
        isActive: true,
        isAdmin: true,
        globalRole: true,
        assistantUserId: true,
        assistant: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (bodyUnitMemberships !== undefined) {
      // Yetki yükseltme koruması: birim üyeliklerini yalnızca Admin/Yönetici
      // veya (kendi yönettiği birimlerle sınırlı olmak üzere) Birim Yöneticisi
      // değiştirebilir. Kullanıcı kendi üyeliklerini değiştiremez.
      const actorRole = getEffectiveGlobalRole(session);
      const isGlobalManager = actorRole === GLOBAL_ROLE.ADMIN || actorRole === GLOBAL_ROLE.YONETICI;
      let allowedUnitIds: string[] | null = null; // null = tüm birimler
      if (!isGlobalManager) {
        const managedUnitIds = isSelf ? [] : await getUnitIdsWhereUserIsManager(session.id);
        if (managedUnitIds.length === 0) {
          return NextResponse.json(
            { error: "Birim üyeliklerini değiştirme yetkiniz yok" },
            { status: 403 }
          );
        }
        allowedUnitIds = managedUnitIds;
      }
      const unitMemberships = (Array.isArray(bodyUnitMemberships)
        ? bodyUnitMemberships.filter(
            (m: unknown): m is { unitId: string; role: string } =>
              typeof m === "object" &&
              m !== null &&
              typeof (m as { unitId?: unknown }).unitId === "string" &&
              typeof (m as { role?: unknown }).role === "string"
          )
        : []
      ).filter((m) => allowedUnitIds === null || allowedUnitIds.includes(m.unitId));
      await prisma.unitMember.deleteMany({
        where: {
          userId: targetUserId,
          ...(allowedUnitIds !== null ? { unitId: { in: allowedUnitIds } } : {}),
        },
      });
      for (const m of unitMemberships) {
        const role = m.role === UNIT_ROLE.BIRIM_YONETICISI ? UNIT_ROLE.BIRIM_YONETICISI : UNIT_ROLE.EKIP_UYESI;
        const unitExists = await prisma.unit.findUnique({ where: { id: m.unitId }, select: { id: true } });
        if (unitExists) {
          await prisma.unitMember.create({
            data: { unitId: m.unitId, userId: targetUserId, role },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        isActive: updated.isActive,
        isAdmin: updated.isAdmin,
        globalRole: updated.globalRole ?? null,
        assistantUserId: updated.assistantUserId ?? null,
        assistant: updated.assistant
          ? { id: updated.assistant.id, email: updated.assistant.email, displayName: updated.assistant.displayName }
          : null,
      },
    });
  } catch (error) {
    console.error("User update failed:", error);
    return NextResponse.json(
      { error: "Kullanıcı güncellenemedi" },
      { status: 500 }
    );
  }
}

/** Kullanıcıyı sistemden kaldır. Sadece Admin yapabilir; kendini kaldıramaz. Atanmış görev varsa silinemez. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const setupConfig = getSetupConfig();
    if (!setupConfig?.setupComplete) {
      return NextResponse.json({ error: "Kurulum tamamlanmamış" }, { status: 400 });
    }

    const session = getSessionFromHeaders(_request.headers.get("cookie"));
    if (!session?.id) {
      return NextResponse.json({ error: "Oturum açmanız gerekiyor" }, { status: 401 });
    }
    if (!(await canAccessSettingsFresh(session))) {
      return NextResponse.json({ error: "Kullanıcı kaldırmak için Admin yetkisi gerekir" }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    if (session.id === targetUserId) {
      return NextResponse.json({ error: "Kendinizi kaldıramazsınız" }, { status: 400 });
    }

    const assignedTaskCount = await prisma.task.count({ where: { assigneeId: targetUserId } });
    if (assignedTaskCount > 0) {
      return NextResponse.json(
        {
          error:
            "Bu kullanıcıya atanmış görevler var. Kullanıcıyı kaldırmak için önce görev atamalarını değiştirin.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { assistantUserId: targetUserId },
        data: { assistantUserId: null },
      });
      await tx.unitMember.deleteMany({ where: { userId: targetUserId } });
      await tx.teamMember.deleteMany({ where: { userId: targetUserId } });
      await tx.projectMember.deleteMany({ where: { userId: targetUserId } });
      await tx.projectDelegate.deleteMany({ where: { delegateUserId: targetUserId } });
      await tx.taskCollaborator.deleteMany({ where: { userId: targetUserId } });
      await tx.comment.deleteMany({ where: { authorId: targetUserId } });
      await tx.project.updateMany({
        where: { ownerId: targetUserId },
        data: { ownerId: null },
      });
      await tx.user.delete({ where: { id: targetUserId } });
    });

    return NextResponse.json({ success: true, message: "Kullanıcı kaldırıldı" });
  } catch (error) {
    console.error("User delete failed:", error);
    return NextResponse.json(
      { error: "Kullanıcı kaldırılamadı" },
      { status: 500 }
    );
  }
}
