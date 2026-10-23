"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DropdownMenu } from "@/components/DropdownMenu";
import { formatUserDisplayName } from "@/lib/display-name";
import { OVERLAY_Z } from "@/lib/overlay-layer";
import { ProjectIcon, PrivateProjectIcon } from "@/components/ProjectIcon";
import { ProjectStatsModal } from "@/components/ProjectStatsModal";
import { RECORD_CARD_HEIGHT_CLASS } from "@/components/RecordListCard";
import { normalizeProjectIconKey } from "@/lib/project-icons";
import { emptyProjectTaskCounts, type ProjectTaskCounts } from "@/lib/project-task-stats";

const CONTENT_LINE_CLASS = "typo-card-line";
const CARD_ICON_SVG = "w-4 h-4";
const CARD_ICON_INNER = "w-9 h-9";
const CARD_TITLE_ROW = "min-h-9";

export interface ProjectCardData {
  id: string;
  name: string;
  iconKey?: string | null;
  owner?: { id: string; displayName: string; email: string } | null;
  unit?: { id: string; name: string } | null;
  taskCounts?: ProjectTaskCounts;
  canDelete?: boolean;
}

function buildMetaLine(project: ProjectCardData): string | null {
  if (project.unit?.name) return `Birim: ${project.unit.name}`;
  if (project.owner?.displayName) {
    return `Sorumlu: ${formatUserDisplayName(project.owner.displayName)}`;
  }
  return null;
}

function privateBadgeClass(): string {
  return "bg-violet-100 text-violet-800";
}

function ProjectStatsIconButton({
  iconKey,
  onOpenStats,
}: {
  iconKey: string | null | undefined;
  onOpenStats: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenStats();
      }}
      className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--metro-tile-projeler)]/40"
      aria-label="Proje özeti"
      title="Proje özeti"
    >
      <ProjectIcon
        iconKey={normalizeProjectIconKey(iconKey)}
        className={CARD_ICON_SVG}
        boxClassName={CARD_ICON_INNER}
      />
    </button>
  );
}

export function PrivateProjectCard({ onOpen }: { onOpen: () => void }) {
  const contentLines = [
    "Sadece sizin gördüğünüz",
    "görev, not ve fikirler",
  ];

  return (
    <div className={`min-w-0 relative ${RECORD_CARD_HEIGHT_CLASS}`}>
      <article
        className="group relative h-full flex flex-col rounded-lg shadow-sm backdrop-blur border border-gray-100 transition hover:shadow-md"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <button
          type="button"
          onClick={onOpen}
          className="w-full h-full min-h-0 text-left p-2.5 flex flex-col"
        >
          <div className={`flex items-center gap-2 min-w-0 shrink-0 ${CARD_TITLE_ROW}`}>
            <PrivateProjectIcon
              className={CARD_ICON_SVG}
              boxClassName={`${CARD_ICON_INNER} bg-violet-50 text-violet-700`}
            />
            <h3 className="typo-card-title leading-5 line-clamp-1 min-w-0 flex-1">Bana Özel</h3>
          </div>

          <div className="mt-0.5 h-11 shrink-0 flex flex-col overflow-hidden">
            {contentLines.map((line, index) => (
              <p key={index} className={CONTENT_LINE_CLASS}>
                {line}
              </p>
            ))}
          </div>

          <div className="flex flex-wrap gap-1 mt-auto pt-1 min-h-[1.375rem] shrink-0 items-center">
            <span
              className={`typo-badge inline-flex items-center px-1.5 py-0.5 rounded leading-none ${privateBadgeClass()}`}
            >
              Özel
            </span>
          </div>
        </button>
      </article>
    </div>
  );
}

export function ProjectListCard({
  project,
  menuOpenId,
  setMenuOpenId,
  onDelete,
}: {
  project: ProjectCardData;
  menuOpenId: string | null;
  setMenuOpenId: (id: string | null) => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const [statsOpen, setStatsOpen] = useState(false);
  const counts = project.taskCounts ?? emptyProjectTaskCounts();
  const metaLine = buildMetaLine(project);
  const isMenuOpen = menuOpenId === project.id;

  const openRecords = () => {
    router.push(`/dashboard/tum-kayitlar?projectId=${project.id}`);
  };

  const openSettings = () => {
    router.push(`/dashboard/projects/${project.id}`);
  };

  return (
    <>
      <div
        className={`min-w-0 relative ${RECORD_CARD_HEIGHT_CLASS}`}
        style={isMenuOpen ? { zIndex: OVERLAY_Z.dropdownMenu } : undefined}
      >
        <article
          className={`group relative h-full flex flex-col rounded-lg shadow-sm backdrop-blur border border-gray-100 transition hover:shadow-md ${
            isMenuOpen ? "shadow-lg" : ""
          } ${counts.total === 0 ? "opacity-90" : ""}`}
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <button
            type="button"
            onClick={openRecords}
            className="w-full h-full min-h-0 text-left p-2.5 pb-7 flex flex-col pr-8"
          >
            <div className={`flex items-center gap-2 min-w-0 shrink-0 ${CARD_TITLE_ROW}`}>
              <ProjectStatsIconButton
                iconKey={project.iconKey}
                onOpenStats={() => setStatsOpen(true)}
              />
              <h3 className="typo-card-title leading-5 line-clamp-1 min-w-0 flex-1">
                {project.name}
              </h3>
            </div>

            <p className={`mt-1 ${CONTENT_LINE_CLASS} truncate`} title="Tamamlanmamış · Tamamlanan · Toplam">
              <span className="font-medium text-indigo-800">{counts.active}</span>
              <span className="text-gray-500"> tamamlanmamış · </span>
              <span className="font-medium text-emerald-700">{counts.completed}</span>
              <span className="text-gray-500"> tamamlanan · </span>
              <span className="font-medium text-gray-700">{counts.total}</span>
              <span className="text-gray-500"> toplam</span>
            </p>

            {metaLine && (
              <p className={`mt-0.5 ${CONTENT_LINE_CLASS} truncate`}>
                {metaLine}
              </p>
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStatsOpen(true);
            }}
            className="absolute bottom-2 right-2 z-10 max-w-[calc(100%-2.5rem)] typo-badge inline-flex items-center px-1.5 py-0.5 rounded leading-none bg-indigo-50 text-indigo-800 hover:bg-indigo-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--metro-tile-projeler)]/40 truncate"
            aria-label={`Tamamlanma oranı: yüzde ${counts.completionPercent}`}
            title="Proje özeti"
          >
            Tamamlanma oranı: %{counts.completionPercent}
          </button>

          <div className="absolute top-1.5 right-1 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : project.id);
              }}
              className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--metro-tile-projeler)]/30"
              aria-label="İşlemler"
              aria-expanded={isMenuOpen}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            <DropdownMenu
              open={isMenuOpen}
              onClose={() => setMenuOpenId(null)}
              menuClassName="absolute right-0 top-full mt-1 w-44 rounded-lg shadow-xl bg-white ring-1 ring-black/10 py-1"
            >
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 outline-none focus:outline-none focus-visible:bg-gray-50"
                onClick={() => {
                  setMenuOpenId(null);
                  setStatsOpen(true);
                }}
              >
                Proje özeti
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 outline-none focus:outline-none focus-visible:bg-gray-50"
                onClick={() => {
                  setMenuOpenId(null);
                  openRecords();
                }}
              >
                Kayıtları aç
              </button>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 outline-none focus:outline-none focus-visible:bg-gray-50"
                onClick={() => {
                  setMenuOpenId(null);
                  openSettings();
                }}
              >
                Ekip / Ayarlar
              </button>
              {onDelete && (
                <button
                  type="button"
                  role="menuitem"
                  disabled={!project.canDelete}
                  title={
                    project.canDelete
                      ? undefined
                      : "Projeyi yalnızca sorumlu, proje yöneticisi veya admin silebilir."
                  }
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed outline-none focus:outline-none focus-visible:bg-red-50"
                  onClick={() => {
                    setMenuOpenId(null);
                    if (project.canDelete) onDelete(project.id);
                  }}
                >
                  Sil
                </button>
              )}
            </DropdownMenu>
          </div>
        </article>
      </div>

      <ProjectStatsModal
        open={statsOpen}
        projectId={project.id}
        projectName={project.name}
        onClose={() => setStatsOpen(false)}
      />
    </>
  );
}

export function ProjectsEmptyCard() {
  return (
    <div className={`min-w-0 col-span-full ${RECORD_CARD_HEIGHT_CLASS}`}>
      <article
        className="h-full flex items-center rounded-lg shadow-sm backdrop-blur border border-gray-100 px-4"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="typo-empty-on-card">
          Henüz proje yok. Yeni proje eklemek için Yeni Proje butonuna tıklayın.
        </p>
      </article>
    </div>
  );
}
