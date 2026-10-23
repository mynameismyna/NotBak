export default function ReportPage() {
  return (
    <>
      <h1 className="typo-page-title mb-4">Sorun Bildir</h1>
      <div
        className="rounded-xl shadow-lg p-6 max-w-2xl backdrop-blur"
        style={{ backgroundColor: "var(--metro-card-bg)" }}
      >
        <p className="text-gray-600 text-sm">
          Teknik bir sorun yaşadığınızda sistem yöneticiniz veya IT destek biriminizle iletişime geçin. Gerekirse hatanın ekran görüntüsü ve adımları paylaşmanız faydalı olur.
        </p>
      </div>
    </>
  );
}
