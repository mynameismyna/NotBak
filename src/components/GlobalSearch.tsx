"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SearchResult {
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    dueDate: string;
    project?: { name: string };
  }>;
  projects: Array<{ id: string; name: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  GOREV: "Görev",
  NOT: "Not",
  FIKIR: "Fikir",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
        return;
      }
      if (!open || !results) return;
      const totalItems = (results.tasks?.length ?? 0) + (results.projects?.length ?? 0);
      if (totalItems === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % totalItems);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + totalItems) % totalItems);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const taskCount = results.tasks?.length ?? 0;
        if (selectedIndex < taskCount) {
          const task = results.tasks[selectedIndex];
          if (task) router.push(`/dashboard/tasks/${task.id}`);
        } else {
          const project = results.projects?.[selectedIndex - taskCount];
          if (project) router.push(`/dashboard/projects/${project.id}`);
        }
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, results, selectedIndex, router]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalItems = (results?.tasks?.length ?? 0) + (results?.projects?.length ?? 0);
  const hasResults = totalItems > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          placeholder="Görev, not veya proje ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="w-64 sm:w-72 pl-4 pr-10 py-2 rounded-lg border border-gray-300 bg-white text-gray-800 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          aria-label="Ara"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0111 0z" />
          </svg>
        </span>
      </div>

      {open && query.length >= 2 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl border border-gray-200 bg-white overflow-hidden z-50 max-h-80 overflow-y-auto"
          role="listbox"
        >
          {loading ? (
            <div className="p-4 text-gray-500 text-sm">Aranıyor...</div>
          ) : !hasResults ? (
            <div className="p-4 text-gray-500 text-sm">Sonuç bulunamadı.</div>
          ) : (
            <div className="py-2">
              {results?.tasks?.map((task, i) => (
                <Link
                  key={task.id}
                  href={`/dashboard/tasks/${task.id}`}
                  className={`block px-4 py-2.5 hover:bg-gray-50 ${selectedIndex === i ? "bg-indigo-50" : ""}`}
                  role="option"
                  aria-selected={selectedIndex === i}
                  onClick={() => setOpen(false)}
                >
                  <div className="font-medium text-gray-900 truncate">{task.title}</div>
                  <div className="text-xs text-gray-500 flex gap-2">
                    <span>{TYPE_LABELS[task.type] ?? task.type}</span>
                    {task.project?.name && <span>• {task.project.name}</span>}
                  </div>
                </Link>
              ))}
              {results?.projects?.map((project, i) => {
                const idx = (results.tasks?.length ?? 0) + i;
                return (
                  <Link
                    key={project.id}
                    href={`/dashboard/projects/${project.id}`}
                    className={`block px-4 py-2.5 hover:bg-gray-50 ${selectedIndex === idx ? "bg-indigo-50" : ""}`}
                    role="option"
                    aria-selected={selectedIndex === idx}
                    onClick={() => setOpen(false)}
                  >
                    <div className="font-medium text-gray-900 truncate">{project.name}</div>
                    <div className="text-xs text-gray-500">Proje</div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
