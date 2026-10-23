"use client";

import { useState } from "react";
import { WeeklyCalendarView } from "@/components/WeeklyCalendarView";

export function CollapsibleCalendar() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <div
        className="rounded-xl shadow-lg p-3 mb-8 backdrop-blur border border-gray-200"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center justify-between gap-2 text-left py-1 px-2 rounded-lg hover:bg-gray-50 transition"
        >
          <span className="text-sm font-medium text-gray-700">📅 Haftalık Takvim</span>
          <span className="text-xs text-gray-500">Görmek için tıklayın</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl shadow-lg overflow-hidden mb-8 backdrop-blur border border-gray-200"
      style={{ backgroundColor: "var(--metro-card-bg)" }}
    >
      <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-gray-200 bg-gray-50/80">
        <h3 className="typo-section-title">📅 Haftalık Takvim</h3>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
          aria-label="Kapat"
          title="Kapat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
      <div className="[&>div]:!rounded-none [&>div]:!shadow-none [&>div]:!mb-0 [&>div]:!border-0">
        <WeeklyCalendarView />
      </div>
    </div>
  );
}
