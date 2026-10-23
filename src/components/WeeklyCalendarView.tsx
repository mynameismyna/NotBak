"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { ModalShell } from "@/components/ModalShell";
import Link from "next/link";
import { normalizeTaskTitleForDisplay, normalizeTaskDescriptionForDisplay } from "@/lib/task-display";
import { AppSelect } from "@/components/AppSelect";

const ROW_HEIGHT = 24;
const HOURS_START = 8;
const HOURS_END = 19;
const HOUR_LABELS = Array.from(
  { length: HOURS_END - HOURS_START + 1 },
  (_, i) => `${(HOURS_START + i).toString().padStart(2, "0")}:00`
);

interface DayInfo {
  date: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  dueDate: string;
  assignee: { id: string; displayName: string; email: string };
  createdBy?: { id: string; displayName: string; email: string } | null;
  project: { id: string; name: string };
}

interface WeekCalendarResponse {
  weekStart: string;
  weekEnd: string;
  days: DayInfo[];
  tasks: TaskItem[];
}

const STATUS_LABELS: Record<string, string> = {
  YENI: "Yeni",
  ONAY_BEKLIYOR: "Onay Bekliyor",
  DEVAM_EDIYOR: "Devam Ediyor",
  BEKLEMEDE: "Beklemede",
  TAMAMLANDI: "Tamamlandı",
  REDDEDILDI: "Reddedildi",
};
const PRIORITY_LABELS: Record<string, string> = {
  URGENT: "Acil",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
};

/** Takvim hücrelerindeki görev kartı renkleri (tip: Görev, Not, Fikir) */
const TASK_TYPE_STYLES: Record<string, { bg: string; border: string }> = {
  GOREV: { bg: "var(--task-type-gorev-bg)", border: "var(--task-type-gorev-border)" },
  NOT: { bg: "var(--task-type-not-bg)", border: "var(--task-type-not-border)" },
  FIKIR: { bg: "var(--task-type-fikir-bg)", border: "var(--task-type-fikir-border)" },
};

function getDayIndex(dateStr: string, weekStart: string): number {
  const d = new Date(dateStr);
  const start = new Date(weekStart);
  const diff = Math.floor((d.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diff));
}

function getTodayColumnIndex(): number {
  const d = new Date();
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

/** Tarihi "2 Şubat 2026" formatında döndürür. */
function formatDateLong(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getWeekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Yerel tarihi YYYY-MM-DD formatında döndürür (toISOString UTC kullandığı için hata veriyordu). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeeklyCalendarView() {
  const [data, setData] = useState<WeekCalendarResponse | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [weekStartStr, setWeekStartStr] = useState(() =>
    toLocalDateString(getWeekStart(new Date()))
  );
  const [filterProject, setFilterProject] = useState("");
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const currentHourRowRef = useRef<HTMLTableRowElement | null>(null);

  const goToPrevWeek = () => {
    const d = new Date(weekStartStr + "T12:00:00");
    d.setDate(d.getDate() - 7);
    setWeekStartStr(toLocalDateString(d));
  };
  const goToNextWeek = () => {
    const d = new Date(weekStartStr + "T12:00:00");
    d.setDate(d.getDate() + 7);
    setWeekStartStr(toLocalDateString(d));
  };
  const goToThisWeek = () => {
    setWeekStartStr(toLocalDateString(getWeekStart(new Date())));
  };

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tasks/week-calendar?date=${weekStartStr}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.days && d.tasks) {
          setData(d);
          const projMap = new Map<string, string>();
          (d.tasks as TaskItem[]).forEach((t) => {
            if (t.project?.id && t.project?.name) projMap.set(t.project.id, t.project.name);
          });
          setProjects(Array.from(projMap.entries()).map(([id, name]) => ({ id, name })));
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [weekStartStr]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const theadHeight = 44;

  const scrollToCurrentHour = () => {
    const el = scrollBodyRef.current;
    if (!el || !data) return;
    const currentHour = new Date().getHours() + new Date().getMinutes() / 60;
    const rowIdx = Math.max(
      0,
      Math.min(HOUR_LABELS.length - 1, Math.floor(currentHour - HOURS_START))
    );
    const targetScrollTop = theadHeight + rowIdx * ROW_HEIGHT;
    el.scrollTop = Math.max(0, targetScrollTop);
  };

  useLayoutEffect(() => {
    if (!data) return;
    scrollToCurrentHour();
    const t = setTimeout(scrollToCurrentHour, 50);
    const t2 = setTimeout(scrollToCurrentHour, 200);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [data]);

  useEffect(() => {
    if (!data) return;
    scrollToCurrentHour();
  }, [data, now]);

  const weekStartDate = new Date(weekStartStr + "T12:00:00");
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekRangeLabel = `${weekStartDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} - ${weekEndDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;
  const isCurrentWeek =
    weekStartStr === toLocalDateString(getWeekStart(new Date()));

  const weekNav = (
    <div className="flex items-center justify-between gap-4 p-4 border-b border-gray-200 bg-gray-50/80">
      <button
        type="button"
        onClick={goToPrevWeek}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition font-medium text-sm shrink-0"
        aria-label="Önceki hafta"
        title="Önceki hafta"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Önceki Hafta
      </button>
      <div className="flex-1 flex justify-center min-w-0">
        {isCurrentWeek ? (
          <span className="typo-subsection-title truncate">
            {weekRangeLabel}
          </span>
        ) : (
          <button
            type="button"
            onClick={goToThisWeek}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Bu haftaya git
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={goToNextWeek}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-200 hover:text-gray-800 transition font-medium text-sm shrink-0"
        aria-label="Sonraki hafta"
        title="Sonraki hafta"
      >
        Sonraki Hafta
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  if (loading) {
    return (
      <div
        className="rounded-xl shadow-lg overflow-hidden mb-6 backdrop-blur min-h-[320px]"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {weekNav}
        <div className="p-6">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="h-9 w-32 rounded-lg bg-gray-200/60 animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-gray-200/60 animate-pulse" />
            <div className="h-9 w-28 rounded-lg bg-gray-200/60 animate-pulse" />
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="h-11 bg-gray-100/80 animate-pulse" />
            <div className="h-[280px] bg-gray-50/50 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!data?.days?.length) {
    return (
      <div
        className="rounded-xl shadow-lg overflow-hidden mb-6 backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        {weekNav}
        <div className="p-6">
          <p className="text-gray-500 text-center">Bu hafta için görev bulunamadı.</p>
        </div>
      </div>
    );
  }

  const todayCol = getTodayColumnIndex();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const currentHourRowIdx = Math.max(
    0,
    Math.min(HOUR_LABELS.length - 1, Math.floor(currentHour - HOURS_START))
  );

  const filteredTasks = data.tasks.filter((task) => {
    if (filterProject && task.project?.id !== filterProject) return false;
    return true;
  });

  const tasksByCell: Record<string, TaskItem[]> = {};
  filteredTasks.forEach((task) => {
    const due = new Date(task.dueDate);
    const dateStr = due.toISOString().slice(0, 10);
    const dayIdx = getDayIndex(dateStr, data.weekStart);
    const hour = due.getHours() + due.getMinutes() / 60;
    let hourIdx = Math.floor(hour - HOURS_START);
    if (hourIdx < 0) hourIdx = 0;
    if (hourIdx > HOURS_END - HOURS_START) hourIdx = HOURS_END - HOURS_START;
    const key = `${dayIdx}-${hourIdx}`;
    if (!tasksByCell[key]) tasksByCell[key] = [];
    tasksByCell[key].push(task);
  });

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden mb-8 backdrop-blur border border-gray-200"
      style={{ backgroundColor: "var(--metro-card-bg)" }}
    >
      {weekNav}
      {data && projects.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 border-b border-gray-200 bg-gray-50/80">
          <AppSelect
              value={filterProject}
              onChange={(v) => setFilterProject(v)}
              size="sm"
              aria-label="Proje filtresi"
            >
              <option value="">Tüm projeler</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </AppSelect>
        </div>
      )}
      <div
        ref={scrollBodyRef}
        className="overflow-x-auto"
        style={{ height: theadHeight + HOUR_LABELS.length * ROW_HEIGHT }}
      >
        <div
          className="relative min-w-[350px]"
          style={{ height: theadHeight + HOUR_LABELS.length * ROW_HEIGHT }}
        >
          <table className="w-full min-w-[350px] border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "3rem" }} />
            {data.days.map((day) => (
              <col key={day.date} style={{ width: "calc((100% - 3rem) / 7)" }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-20" style={{ backgroundColor: "var(--metro-card-bg)" }}>
            <tr className="border-b border-gray-200">
              <th className="w-12 py-1.5 text-left text-xs font-semibold text-gray-500 bg-gray-50/80 border-r border-gray-200">
                {" "}
              </th>
              {data.days.map((day) => (
                <th
                  key={day.date}
                  className={`py-1.5 px-1 text-center text-xs font-semibold border-r border-gray-200 last:border-r-0 ${
                    day.isToday
                      ? "bg-blue-200/80 text-blue-900 ring-2 ring-inset ring-blue-400"
                      : "bg-gray-50/80 text-gray-700"
                  }`}
                >
                  <div>{day.dayName}</div>
                  <div className="text-xs font-bold mt-0.5">{formatDateLong(day.date)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="relative">
            {HOUR_LABELS.map((label, hourIdx) => {
              const isSelectedHour = hourIdx === currentHourRowIdx;
              return (
                <tr
                  key={label}
                  ref={isSelectedHour ? currentHourRowRef : undefined}
                  className={`border-b border-gray-100 ${
                    isSelectedHour ? "bg-amber-50/70" : ""
                  }`}
                >
                  <td
                    className={`w-12 py-0 text-xs border-r border-gray-200 align-top ${
                      isSelectedHour ? "bg-amber-100/80 text-amber-900 font-semibold" : "text-gray-500 bg-gray-50/60"
                    }`}
                  >
                    {label}
                  </td>
                  {data.days.map((day, dayIdx) => {
                    const key = `${dayIdx}-${hourIdx}`;
                    const cellTasks = tasksByCell[key] ?? [];
                    const isSelectedCell = day.isToday && isSelectedHour;
                    return (
                      <td
                        key={day.date + hourIdx}
                        className={`border-r border-gray-100 last:border-r-0 align-top overflow-hidden ${
                          isSelectedCell
                            ? "bg-amber-100/60 ring-2 ring-inset ring-amber-500"
                            : day.isToday
                              ? "bg-blue-50/50"
                              : "bg-white"
                        }`}
                        style={{ width: "calc((100% - 3rem) / 7)", minWidth: 0, height: ROW_HEIGHT, verticalAlign: "top" }}
                      >
                        <div className="h-full p-0.5 flex flex-col gap-0.5 overflow-hidden min-w-0">
                          {cellTasks.map((task) => {
                            const typeStyle = TASK_TYPE_STYLES[task.type] ?? TASK_TYPE_STYLES.GOREV;
                            const displayTitle = normalizeTaskTitleForDisplay(task.title) || "(Başlıksız)";
                            return (
                            <button
                              key={task.id}
                              type="button"
                              className="text-left w-full min-w-0 rounded px-1 py-0.5 text-xs font-medium overflow-hidden transition hover:ring-2 hover:ring-[var(--metro-tile-gorevler)] focus:outline-none focus:ring-2 focus:ring-[var(--metro-tile-gorevler)]"
                              style={{
                                backgroundColor: typeStyle.bg,
                                color: "#374151",
                                borderLeft: `3px solid ${typeStyle.border}`,
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                setSelectedTask(task);
                              }}
                              title={task.title || ""}
                            >
                              <span className="block min-w-0 truncate" title={task.title || ""}>
                                {displayTitle}
                              </span>
                            </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Görev detay popup: Portal ile body'de, takvimin üstünde açılır */}
      <ModalShell
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        layer="base"
        panelClassName="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
      >
        {selectedTask && (
          <>
              <div className="flex items-start justify-between gap-2 mb-4">
                <h3 className="typo-modal-title">{normalizeTaskTitleForDisplay(selectedTask.title)}</h3>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="p-1 rounded hover:bg-gray-100 text-gray-500"
                  aria-label="Kapat"
                >
                  ✕
                </button>
              </div>
              {selectedTask.description && (
                <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">{normalizeTaskDescriptionForDisplay(selectedTask.description)}</p>
              )}
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-gray-500">Durum</dt>
                  <dd className="font-medium text-gray-800">
                    {selectedTask.type === "NOT"
                      ? selectedTask.status === "TAMAMLANDI"
                        ? "Tamamlandı"
                        : "Bekleyen"
                      : STATUS_LABELS[selectedTask.status] ?? selectedTask.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Öncelik</dt>
                  <dd className="font-medium text-gray-800">
                    {PRIORITY_LABELS[selectedTask.priority] ?? selectedTask.priority}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Bitiş tarihi</dt>
                  <dd className="font-medium text-gray-800">
                    {new Date(selectedTask.dueDate).toLocaleString("tr-TR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </dd>
                </div>
                {selectedTask.project?.name ? (
                  <div>
                    <dt className="text-gray-500">Proje</dt>
                    <dd className="font-medium text-gray-800">{selectedTask.project.name}</dd>
                  </div>
                ) : null}
                {selectedTask.assignee?.displayName && (
                  <div>
                    <dt className="text-gray-500">Sorumlu</dt>
                    <dd className="font-medium text-gray-800">{selectedTask.assignee.displayName}</dd>
                  </div>
                )}
                {selectedTask.createdBy?.displayName && (
                  <div>
                    <dt className="text-gray-500">Ekleyen</dt>
                    <dd className="font-medium text-gray-800">{selectedTask.createdBy.displayName}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-4 flex gap-2">
                <Link
                  href={`/dashboard/tasks/${selectedTask.id}`}
                  className="btn-cta-gorevler px-4 py-2 rounded-lg font-medium text-sm"
                >
                  Görev detayına git
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50"
                >
                  Kapat
                </button>
              </div>
          </>
        )}
      </ModalShell>
    </div>
  );
}
