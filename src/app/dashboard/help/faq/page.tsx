import Link from "next/link";
import { FAQ_ITEMS } from "@/lib/help-content";

export default function FaqPage() {
  return (
    <>
      <h1 className="typo-page-title mb-4">Sıkça Sorulan Sorular</h1>
      <div className="space-y-4 max-w-3xl">
        <div
          className="rounded-xl shadow-lg p-6 backdrop-blur"
          style={{ backgroundColor: "var(--metro-card-bg)" }}
        >
          <p className="typo-body mb-6">
            Aşağıda NotBak ile ilgili sık sorulan sorular ve kısa yanıtları yer almaktadır. Daha ayrıntılı bilgi için Kullanım Kılavuzu’na bakabilirsiniz.
          </p>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item, index) => (
              <div key={index} className="border-b border-gray-200 last:border-0 pb-5 last:pb-0">
                <h3 className="typo-subsection-title mb-1.5">{item.question}</h3>
                <p className="typo-body leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <Link
              href="/dashboard/help/manual"
              className="text-sm text-[var(--metro-tile-gorevler)] hover:underline font-medium"
            >
              Kullanım Kılavuzu →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
