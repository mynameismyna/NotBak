import { readFile } from "fs/promises";
import path from "path";

export default async function ManualPage() {
  let content = "";
  try {
    const filePath = path.join(process.cwd(), "docs", "KULLANIM_KILAVUZU.md");
    content = await readFile(filePath, "utf-8");
  } catch {
    content = "Kullanım kılavuzu dosyası bulunamadı.";
  }

  return (
    <>
      <h1 className="typo-page-title mb-4">Kullanım Kılavuzu</h1>
      <div
        className="rounded-xl shadow-lg p-6 max-w-4xl overflow-x-auto backdrop-blur prose prose-sm prose-gray max-w-none"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm leading-relaxed m-0">
          {content}
        </pre>
      </div>
    </>
  );
}
