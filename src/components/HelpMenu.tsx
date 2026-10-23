"use client";

import { useState, useRef, useEffect } from "react";
import { ModalShell } from "@/components/ModalShell";
import { ManualContent } from "@/components/ManualContent";
import {
  ABOUT_DESCRIPTION,
  ABOUT_FEATURES,
  APP_VERSION,
  FAQ_ITEMS,
} from "@/lib/help-content";
import { caveat } from "@/lib/fonts";

const iconClass = "w-5 h-5 text-gray-800 shrink-0";

type HelpItemId = "manual" | "faq" | "about" | "report";

const menuItems: { id: HelpItemId; label: string; icon: React.ReactNode }[] = [
  {
    id: "manual",
    label: "Kullanım Kılavuzu",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6H6zm0 0v6h6" />
      </svg>
    ),
  },
  {
    id: "faq",
    label: "SSS",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.09 4h.01" />
      </svg>
    ),
  },
  {
    id: "about",
    label: "Hakkında",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4" />
        <circle cx="12" cy="9" r="1.25" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: "report",
    label: "Sorun Bildir",
    icon: (
      <svg className={iconClass} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const TITLES: Record<HelpItemId, string> = {
  manual: "Kullanım Kılavuzu",
  faq: "Sıkça Sorulan Sorular",
  about: "Hakkında",
  report: "Sorun Bildir",
};

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [modalItem, setModalItem] = useState<HelpItemId | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const handleItemClick = (id: HelpItemId) => {
    setOpen(false);
    setModalItem(id);
  };

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex items-center gap-1.5 px-0 py-2 bg-transparent border-0 font-medium transition cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Yardım menüsü"
      >
        <svg
          className="w-5 h-5 shrink-0 text-gray-800"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m.09 4h.01" />
        </svg>
        <span className="text-gray-800 group-hover:text-gray-900 font-light text-sm">Yardım</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 py-2 min-w-[220px] rounded-lg bg-white z-50"
          role="menu"
          style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleItemClick(item.id)}
              className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-gray-900 hover:bg-gray-50 transition"
              role="menuitem"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      {modalItem && (
        <HelpModal
          title={TITLES[modalItem]}
          itemId={modalItem}
          onClose={() => setModalItem(null)}
        />
      )}
    </div>
  );
}

function HelpModal({
  title,
  itemId,
  onClose,
}: {
  title: string;
  itemId: HelpItemId;
  onClose: () => void;
}) {
  const [manualContent, setManualContent] = useState<string | null>(itemId === "manual" ? "" : null);
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [reportError, setReportError] = useState("");

  useEffect(() => {
    if (itemId === "manual") {
      fetch("/api/help/manual")
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) {
            setManualContent(typeof d.error === "string" ? d.error : "Yüklenemedi.");
            return;
          }
          setManualContent(d.content ?? "Yüklenemedi.");
        })
        .catch(() => setManualContent("Yüklenemedi."));
    }
  }, [itemId]);

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError("");
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/help/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: reportSubject.trim(), description: reportDescription.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(data.error || "Gönderilemedi.");
        return;
      }
      setReportSuccess(true);
      setReportSubject("");
      setReportDescription("");
    } finally {
      setReportSubmitting(false);
    }
  };

  const renderBody = () => {
    switch (itemId) {
      case "manual":
        return (
          <div className="overflow-y-auto max-h-[70vh] px-6 pb-6 pt-2">
            <ManualContent content={manualContent ?? ""} />
          </div>
        );
      case "faq":
        return (
          <div className="overflow-y-auto max-h-[70vh] px-6 pb-6 pt-2">
            <p className="text-gray-600 text-sm mb-4">
              NotBak ile ilgili sık sorulan sorular ve kısa yanıtları. Daha ayrıntılı bilgi için Kullanım Kılavuzu&apos;na bakabilirsiniz.
            </p>
            <div className="space-y-5 text-sm">
              {FAQ_ITEMS.map((item, index) => (
                <div
                  key={index}
                  className="border-b border-gray-200 last:border-0 pb-4 last:pb-0"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{item.question}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs pt-4">
              Burada bulamadığınız sorular için Kullanım Kılavuzu&apos;na bakın veya yöneticinizle iletişime geçin.
            </p>
          </div>
        );
      case "about":
        return (
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            <div className="flex flex-col items-center text-center">
              <div
                className="w-16 h-16 mb-4 rounded-xl overflow-hidden bg-[var(--metro-tile-projeler)] shrink-0 flex items-center justify-center"
                style={{ minWidth: 64, minHeight: 64 }}
              >
                <img
                  src="/notbak_logo.png"
                  alt="NotBak"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }}
                />
                <span
                  className="text-white font-bold text-xl items-center justify-center w-full h-full hidden"
                  style={{ display: "none" }}
                  aria-hidden
                >
                  NB
                </span>
              </div>
              <h2 className={`text-3xl font-bold text-gray-900 mb-1 ${caveat.className}`}>
                NotBak
              </h2>
              <p className="text-gray-500 text-sm font-medium mb-0.5">{APP_VERSION}</p>
              <p className="text-gray-600 text-sm max-w-md mb-4 leading-relaxed">
                {ABOUT_DESCRIPTION}
              </p>
              <div className="w-full max-w-md text-left mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {ABOUT_FEATURES.map(([title, desc]) => (
                    <div key={title}>
                      <span className="text-gray-800 font-medium">{title}</span>
                      <p className="text-gray-500 leading-snug mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-xs text-gray-400 space-y-0.5">
                <p>Burak Türk tarafından geliştirilmiştir.</p>
                <p>Next.js &middot; React &middot; Prisma &middot; Tailwind CSS</p>
              </div>
            </div>
          </div>
        );
      case "report":
        if (reportSuccess) {
          return (
            <div className="p-6">
              <p className="text-gray-700 text-sm font-medium mb-2">
                Bildiriminiz alındı. En kısa sürede değerlendirilecektir.
              </p>
              <p className="text-gray-500 text-xs">
                Yeni bir bildirim göndermek için pencereyi kapatıp tekrar &quot;Sorun Bildir&quot; seçebilirsiniz.
              </p>
            </div>
          );
        }
        return (
          <div className="p-6">
            <p className="text-gray-600 text-sm mb-4">
              Teknik bir sorun veya hata yaşadığınızda aşağıdaki formu doldurarak bildirebilirsiniz. Gerekirse hatanın ekran görüntüsü ve adımları açıklamada belirtin.
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label htmlFor="report-subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Konu
                </label>
                <input
                  id="report-subject"
                  type="text"
                  value={reportSubject}
                  onChange={(e) => setReportSubject(e.target.value)}
                  placeholder="Örn: Görev kaydedilirken hata"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--metro-tile-gorevler)] focus:border-transparent"
                  maxLength={500}
                  required
                />
              </div>
              <div>
                <label htmlFor="report-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  id="report-description"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Sorunu veya hatayı mümkün olduğunca detaylı yazın (hata mesajı, yaptığınız adımlar vb.)"
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-[var(--metro-tile-gorevler)] focus:border-transparent resize-y"
                  required
                />
              </div>
              {reportError && (
                <p className="text-sm text-red-600">{reportError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="px-4 py-2 rounded-lg font-medium text-sm text-white transition disabled:opacity-50"
                  style={{ backgroundColor: "var(--metro-tile-gorevler)" }}
                >
                  {reportSubmitting ? "Gönderiliyor..." : "Gönder"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium text-sm hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      layer="base"
      panelClassName="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 shrink-0">
        <h2 className="typo-modal-title">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
          aria-label="Kapat"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="overflow-hidden">{renderBody()}</div>
    </ModalShell>
  );
}
