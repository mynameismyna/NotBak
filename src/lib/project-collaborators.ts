import { prisma } from "@/lib/prisma";

/** Projede ilgili kişi olarak seçilebilecek kullanıcı kimlikleri (sorumlu + proje üyeleri). */
export async function getProjectCollaboratorAllowedUserIds(
  projectId: string
): Promise<Set<string>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      ownerId: true,
      members: { select: { userId: true } },
    },
  });
  const allowed = new Set<string>();
  if (!project) return allowed;
  if (project.ownerId) allowed.add(project.ownerId);
  for (const m of project.members) allowed.add(m.userId);
  return allowed;
}
