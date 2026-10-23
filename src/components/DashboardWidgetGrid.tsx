"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const STORAGE_KEY = "notbak-dashboard-widgets";

const VARIANT_STYLES: Record<string, { bg: string }> = {
  default: { bg: "var(--metro-tile-projeler)" },
  warning: { bg: "var(--metro-tile-gorevler)" },
  success: { bg: "var(--metro-tile-notlar)" },
  info: { bg: "#d97706" },
};

export interface WidgetDef {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  variant: keyof typeof VARIANT_STYLES;
  countKey: keyof WidgetCounts;
  requiredPermission: "any" | "admin";
}

export interface WidgetCounts {
  inProgressCount: number;
  assignedCount: number;
  overdueCount: number;
  pendingApprovalCount: number;
  emailRecordsCount: number;
  unknownRecordsCount: number;
  projectsCount: number;
  notesCount: number;
  completedCount: number;
}

const DEFAULT_WIDGET_ORDER: string[] = [
  "inprogress",
  "assigned",
  "overdue",
  "pending-talepler",
  "email-records",
  "unknown-records",
  "projects",
  "notes",
  "completed",
];

const WIDGET_DEFS: WidgetDef[] = [
  { id: "inprogress", title: "Devam Eden Görevler", subtitle: "Üzerinde çalışılan görevler", href: "/dashboard/tum-kayitlar?view=inprogress", variant: "warning", countKey: "inProgressCount", requiredPermission: "any" },
  { id: "assigned", title: "Atanan Görevler", subtitle: "Atanmış görevlere git", href: "/dashboard/tum-kayitlar?view=assigned", variant: "warning", countKey: "assignedCount", requiredPermission: "any" },
  { id: "overdue", title: "Geciken Kayıtlar", subtitle: "Tarihi geçen kayıtlar", href: "/dashboard/tum-kayitlar?view=overdue", variant: "warning", countKey: "overdueCount", requiredPermission: "any" },
  { id: "pending-talepler", title: "Bekleyen Talepler", subtitle: "Bekleyen Talepler", href: "/dashboard/talepler?tab=sent", variant: "info", countKey: "pendingApprovalCount", requiredPermission: "any" },
  { id: "email-records", title: "E-Posta Talepleri", subtitle: "Gönderilen kayıtları görüntüle", href: "/dashboard/email-records", variant: "info", countKey: "emailRecordsCount", requiredPermission: "any" },
  { id: "unknown-records", title: "Bilinmeyen Kayıtlar", subtitle: "Henüz atanmamış e-posta kayıtları", href: "/dashboard/unknown-email-records", variant: "info", countKey: "unknownRecordsCount", requiredPermission: "admin" },
  { id: "projects", title: "Projeler", subtitle: "Dahil olunan projeler", href: "/dashboard/projects", variant: "default", countKey: "projectsCount", requiredPermission: "any" },
  { id: "notes", title: "Notlar", subtitle: "Notlar panosu", href: "/dashboard/board", variant: "success", countKey: "notesCount", requiredPermission: "any" },
  { id: "completed", title: "Tamamlanan Görevler", subtitle: "Tamamlanan görevler", href: "/dashboard/tum-kayitlar?view=completed", variant: "success", countKey: "completedCount", requiredPermission: "any" },
];

function canSeeWidget(widget: WidgetDef, canAccessSettings: boolean): boolean {
  if (widget.requiredPermission === "any") return true;
  if (widget.requiredPermission === "admin") return canAccessSettings;
  return false;
}

function loadStoredState(): { order: string[]; hidden: string[] } {
  if (typeof window === "undefined") return { order: DEFAULT_WIDGET_ORDER, hidden: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { order: DEFAULT_WIDGET_ORDER, hidden: [] };
    const parsed = JSON.parse(raw) as { order?: string[]; hidden?: string[] };
    return {
      order: Array.isArray(parsed.order) ? parsed.order : DEFAULT_WIDGET_ORDER,
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    return { order: DEFAULT_WIDGET_ORDER, hidden: [] };
  }
}

function saveStoredState(order: string[], hidden: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, hidden }));
  } catch {
    // ignore
  }
}

interface SortableWidgetCardProps {
  widget: WidgetDef;
  value: number;
  borderColor?: string;
  onClose: () => void;
  /** Sürükleme bittiğinde bu id'ye tıklamayı engellemek için */
  lastDroppedId?: string | null;
}

function SortableWidgetCard({ widget, value, borderColor, onClose, lastDroppedId }: SortableWidgetCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = VARIANT_STYLES[widget.variant] ?? VARIANT_STYLES.default;

  const transformStyle = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : { transition };

  const content = (
    <div
      ref={setNodeRef}
      style={{
        ...transformStyle,
        backgroundColor: style.bg,
        borderLeft: borderColor ? `4px solid ${borderColor}` : undefined,
      }}
      className={`group rounded-lg overflow-hidden shadow-lg transition-all duration-200 h-full flex flex-col min-h-[88px] relative ${
        isDragging ? "opacity-90 shadow-2xl z-10" : ""
      }`}
    >
      {/* Sürükleme ve kapatma Link dışında - bırakınca click Link'e gitmez */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
        <div
          {...listeners}
          {...attributes}
          className="p-1 cursor-grab active:cursor-grabbing rounded text-white/50 hover:text-white/80 select-none"
          aria-label="Sürükle"
        >
          <span className="text-[10px] pointer-events-none">⋮⋮</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="p-1 w-5 h-5 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
          aria-label="Kapat"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <Link
        href={widget.href}
        className="block flex-1 p-3 pr-14 text-white"
        onClick={(e) => {
          if (lastDroppedId === widget.id) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <h3 className="text-xs font-medium opacity-90">{widget.title}</h3>
        <p className="text-xl font-bold mt-1">{value}</p>
        {widget.subtitle && <p className="text-xs mt-0.5 opacity-75 line-clamp-1">{widget.subtitle}</p>}
      </Link>
      <div className="h-0.5 bg-white/20 group-hover:bg-white/30 transition" />
    </div>
  );

  return content;
}

interface DashboardWidgetGridProps {
  canAccessSettings: boolean;
}

export function DashboardWidgetGrid({ canAccessSettings }: DashboardWidgetGridProps) {
  const [counts, setCounts] = useState<WidgetCounts>({
    inProgressCount: 0,
    assignedCount: 0,
    overdueCount: 0,
    pendingApprovalCount: 0,
    emailRecordsCount: 0,
    unknownRecordsCount: 0,
    projectsCount: 0,
    notesCount: 0,
    completedCount: 0,
  });
  const [order, setOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const [hidden, setHidden] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [lastDroppedId, setLastDroppedId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const { order: o, hidden: h } = loadStoredState();
    setOrder(o);
    setHidden(h);
  }, []);

  useEffect(() => {
    fetch("/api/dashboard/widget-counts")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        setCounts({
          inProgressCount: d.inProgressCount ?? 0,
          assignedCount: d.assignedCount ?? 0,
          overdueCount: d.overdueCount ?? 0,
          pendingApprovalCount: d.pendingApprovalCount ?? 0,
          emailRecordsCount: d.emailRecordsCount ?? 0,
          unknownRecordsCount: d.unknownRecordsCount ?? 0,
          projectsCount: d.projectsCount ?? 0,
          notesCount: d.notesCount ?? 0,
          completedCount: d.completedCount ?? 0,
        });
      })
      .catch(() => {});
  }, []);

  const visibleWidgets = WIDGET_DEFS.filter(
    (w) => canSeeWidget(w, canAccessSettings) && !hidden.includes(w.id)
  );

  const orderedIds = order.filter((id) => visibleWidgets.some((w) => w.id === id));
  const extraIds = visibleWidgets.filter((w) => !order.includes(w.id)).map((w) => w.id);
  const displayOrder = [...orderedIds, ...extraIds];

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setLastDroppedId(active.id as string);
      setTimeout(() => setLastDroppedId(null), 150);
      if (!over || active.id === over.id) return;
      const oldIndex = displayOrder.indexOf(active.id as string);
      const newIndex = displayOrder.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;
      const newOrder = arrayMove(displayOrder, oldIndex, newIndex);
      setOrder(newOrder);
      saveStoredState(newOrder, hidden);
    },
    [displayOrder, hidden]
  );

  const handleClose = useCallback(
    (id: string) => {
      const newHidden = [...hidden, id];
      setHidden(newHidden);
      saveStoredState(order, newHidden);
    },
    [hidden, order]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const restoreHidden = useCallback(() => {
    setHidden([]);
    saveStoredState(order, []);
  }, [order]);

  const hiddenCount = hidden.filter((id) => WIDGET_DEFS.some((w) => w.id === id && canSeeWidget(w, canAccessSettings))).length;

  if (!mounted) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-lg h-[88px] bg-white/10 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="mb-8">
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={restoreHidden}
          className="mb-3 text-sm text-white/80 hover:text-white underline"
        >
          Kapatılan kutuları geri getir ({hiddenCount})
        </button>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
          {displayOrder.map((id) => {
            const widget = WIDGET_DEFS.find((w) => w.id === id);
            if (!widget || !canSeeWidget(widget, canAccessSettings) || hidden.includes(widget.id)) return null;
            const value = counts[widget.countKey] ?? 0;
            const borderColor = widget.id === "overdue" && value > 0 ? "#dc2626" : undefined;
            return (
              <SortableWidgetCard
                key={widget.id}
                widget={widget}
                value={value}
                borderColor={borderColor}
                onClose={() => handleClose(widget.id)}
                lastDroppedId={lastDroppedId}
              />
            );
          })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
