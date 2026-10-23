"use client";

/** **bold** -> <strong>bold</strong> */
function renderBold(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const start = remaining.indexOf("**");
    if (start === -1) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
    if (start > 0) parts.push(<span key={key++}>{remaining.slice(0, start)}</span>);
    const end = remaining.indexOf("**", start + 2);
    if (end === -1) {
      parts.push(<span key={key++}>{remaining.slice(start)}</span>);
      break;
    }
    parts.push(<strong key={key++}>{remaining.slice(start + 2, end)}</strong>);
    remaining = remaining.slice(end + 2);
  }
  return <>{parts}</>;
}

/** Markdown metnini bölüm başlıkları ve listelerle örnekteki gibi render eder. */
export function ManualContent({ content }: { content: string }) {
  if (!content) return <p className="typo-loading-on-card">Yükleniyor...</p>;

  const lines = content.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // # Ana başlık - atla (modal başlığında zaten var)
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      i++;
      continue;
    }

    // --- ayırıcı
    if (/^---+$/.test(trimmed)) {
      i++;
      continue;
    }

    // ## Bölüm başlığı
    if (trimmed.startsWith("## ")) {
      const title = trimmed.slice(3).trim();
      blocks.push(
        <h3
          key={blockKey++}
          className="font-bold text-gray-900 mt-6 mb-2 text-base first:mt-0"
        >
          {renderBold(title)}
        </h3>
      );
      i++;
      continue;
    }

    // ### Alt başlık
    if (trimmed.startsWith("### ")) {
      const title = trimmed.slice(4).trim();
      blocks.push(
        <h4
          key={blockKey++}
          className="font-semibold text-gray-900 mt-4 mb-1.5 text-sm"
        >
          {renderBold(title)}
        </h4>
      );
      i++;
      continue;
    }

    // Liste satırı (- veya * ile başlayan)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trim();
        const bullet = t.match(/^[-*]\s+/);
        if (bullet) {
          listItems.push(t.slice(bullet[0].length));
          i++;
        } else if (t.startsWith("  - ") || t.startsWith("  * ")) {
          listItems.push(t.slice(4));
          i++;
        } else if (t === "" || t.startsWith("#") || t.startsWith("|")) {
          break;
        } else {
          break;
        }
      }
      blocks.push(
        <ul key={blockKey++} className="list-disc list-outside ml-5 mb-3 space-y-1.5 text-gray-900 text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-0.5">
              {renderBold(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numaralı liste (1. 2. 3.)
    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trim();
        const num = t.match(/^\d+\.\s+/);
        if (num) {
          listItems.push(t.slice(num[0].length));
          i++;
        } else if (t.startsWith("   - ") || t.startsWith("   * ")) {
          listItems.push(t.slice(5));
          i++;
        } else if (t === "" || t.startsWith("#") || t.startsWith("|") || /^\d+\.\s/.test(t)) {
          break;
        } else {
          break;
        }
      }
      blocks.push(
        <ol key={blockKey++} className="list-decimal list-outside ml-5 mb-3 space-y-1.5 text-gray-900 text-sm">
          {listItems.map((item, idx) => (
            <li key={idx} className="pl-0.5">
              {renderBold(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Tablo (| ile başlayan satırlar)
    if (trimmed.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const row = lines[i]
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        if (row.some((c) => c.length > 0) && !row.every((c) => /^-+$/.test(c))) {
          rows.push(row);
        }
        i++;
      }
      if (rows.length > 0) {
        blocks.push(
          <div key={blockKey++} className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm text-gray-900">
              <thead>
                <tr>
                  {rows[0].map((cell, idx) => (
                    <th
                      key={idx}
                      className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold"
                    >
                      {renderBold(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ridx) => (
                  <tr key={ridx}>
                    {row.map((cell, cidx) => (
                      <td
                        key={cidx}
                        className="border border-gray-200 px-3 py-2"
                      >
                        {renderBold(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Boş satır
    if (trimmed === "") {
      i++;
      continue;
    }

    // Paragraf
    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i];
      const nextTrim = next.trim();
      if (
        nextTrim === "" ||
        nextTrim.startsWith("#") ||
        nextTrim.startsWith("- ") ||
        nextTrim.startsWith("* ") ||
        nextTrim.startsWith("|") ||
        /^\d+\.\s/.test(nextTrim)
      ) {
        break;
      }
      paraLines.push(nextTrim);
      i++;
    }
    blocks.push(
      <p key={blockKey++} className="text-gray-900 text-sm mb-3 leading-relaxed">
        {renderBold(paraLines.join(" "))}
      </p>
    );
  }

  return (
    <div className="manual-content text-gray-900">
      {blocks}
    </div>
  );
}
