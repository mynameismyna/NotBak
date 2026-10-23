import Link from "next/link";

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-white/90 hover:text-white"
        >
          ← Ana Sayfa
        </Link>
      </div>
      {children}
    </div>
  );
}
