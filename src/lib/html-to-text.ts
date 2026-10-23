const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"',
  "&apos;": "'", "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—",
  "&laquo;": "«", "&raquo;": "»", "&copy;": "©", "&reg;": "®",
  "&trade;": "™", "&euro;": "€", "&pound;": "£", "&yen;": "¥",
};

function decodeEntities(text: string): string {
  let t = text;
  t = t.replace(/&[a-zA-Z]+;/g, (entity) =>
    HTML_ENTITY_MAP[entity.toLowerCase()] ?? entity
  );
  t = t.replace(/&#(\d+);/g, (_, code) => {
    const n = parseInt(code, 10);
    return n > 0 && n < 0x10FFFF ? String.fromCodePoint(n) : "";
  });
  t = t.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
    const n = parseInt(hex, 16);
    return n > 0 && n < 0x10FFFF ? String.fromCodePoint(n) : "";
  });
  return t;
}

function collapseWhitespace(text: string): string {
  let t = text;
  t = t.replace(/[ \t]+$/gm, "");
  t = t.replace(/^[ \t]+/gm, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

/**
 * mailparser bazen `<` karakterini kaldırıp etiket attribute'larını bırakır:
 *   class="MsoNormal">  /  style="text-align:center">  /  align="center">
 * Bu kalıntıları temizler.
 */
function stripOrphanedTagFragments(text: string): string {
  // "class/style/align/id/width/height/border/cellpadding/cellspacing/colspan/rowspan/valign/bgcolor/color/src/href/rel/type/name/content/charset/http-equiv=..."  şeklindeki kalıntılar
  // Kalıp: opsiyonel boşluk + bilinen HTML attribute adı + ="..." + >
  return text.replace(
    /^\s*(?:class|style|align|id|width|height|border|cellpadding|cellspacing|colspan|rowspan|valign|bgcolor|color|src|href|rel|type|name|content|charset|http-equiv|data-\w+)\s*=\s*"[^"]*"\s*(?:(?:(?:class|style|align|id|width|height|border|cellpadding|cellspacing|colspan|rowspan|valign|bgcolor|color|src|href|rel|type|name|content|charset|http-equiv|data-\w+)\s*=\s*"[^"]*"\s*)*)?\/?>/gmi,
    ""
  );
}

// ── Yaklaşım 2: HTML seviyesinde bilinen imza container'larını kaldır ──

function stripHtmlSignatureBlocks(html: string): string {
  let h = html;

  // Gmail: <div class="gmail_signature" ...>...</div>
  h = h.replace(/<div[^>]*class\s*=\s*["'][^"']*gmail_signature[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Gmail: <div class="gmail_quote">...</div> (yanıt alıntısı)
  h = h.replace(/<div[^>]*class\s*=\s*["'][^"']*gmail_quote[^"']*["'][^>]*>[\s\S]*?$/gi, "");

  // Outlook: <div id="Signature"> veya <div id="signature">
  h = h.replace(/<div[^>]*id\s*=\s*["'](?:Signature|signature|mail-signature|email-signature)["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Outlook: <div class="MsoSignature">
  h = h.replace(/<div[^>]*class\s*=\s*["'][^"']*MsoSignature[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Apple Mail: <div dir="ltr" class="gmail_attr"> (ileri yönlendirme başlığı)
  h = h.replace(/<div[^>]*class\s*=\s*["'][^"']*gmail_attr[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Thunderbird / generic: <div class="moz-signature">
  h = h.replace(/<div[^>]*class\s*=\s*["'][^"']*moz-signature[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");

  // Yahoo: <div class="yahoo_quoted">
  h = h.replace(/<div[^>]*class\s*=\s*["'][^"']*yahoo_quoted[^"']*["'][^>]*>[\s\S]*?$/gi, "");

  // Outlook/Exchange: <table> içinde imza — id veya class ile işaretlenmiş
  h = h.replace(/<table[^>]*(?:id|class)\s*=\s*["'][^"']*(?:signature|Signature|imza)[^"']*["'][^>]*>[\s\S]*?<\/table>/gi, "");

  return h;
}

// ── Yaklaşım 1: Düz metin seviyesinde imza tespiti ve kaldırma ──

function stripPlainTextSignature(text: string): string {
  const lines = text.split("\n");
  let cutIndex = -1;

  // RFC 3676 imza ayırıcısı: "-- " (tam olarak iki tire ve bir boşluk)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === "--" || lines[i] === "-- ") {
      if (i > 0 && i < lines.length - 1) {
        cutIndex = i;
        break;
      }
    }
  }

  // "-- " bulunamadıysa, yaygın Outlook/Exchange imza kalıpları ara
  if (cutIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (/^[_\-=]{3,}\s*$/.test(line) && i > 0 && i < lines.length - 1) {
        const remainingContent = lines.slice(i + 1).join(" ").trim();
        if (remainingContent.length > 0 && remainingContent.length < 1000) {
          cutIndex = i;
          break;
        }
      }
    }
  }

  // İmza kalıp tespiti: metnin son %60'ında en az 3 ardışık imza satırı
  if (cutIndex === -1) {
    const searchStart = Math.floor(lines.length * 0.4);
    let sigBlockStart = -1;
    let consecutiveHits = 0;

    for (let i = searchStart; i < lines.length; i++) {
      const line = lines[i].trim();
      if (isSignatureLine(line)) {
        if (sigBlockStart === -1) sigBlockStart = i;
        consecutiveHits++;
      } else if (line === "") {
        // Boş satırlar imza bloğunu bozmaz
      } else {
        if (consecutiveHits < 3) {
          sigBlockStart = -1;
          consecutiveHits = 0;
        }
      }
    }

    if (sigBlockStart !== -1 && consecutiveHits >= 3 && sigBlockStart > 0) {
      cutIndex = sigBlockStart;
    }
  }

  if (cutIndex > 0) {
    return lines.slice(0, cutIndex).join("\n");
  }

  return text;
}

function isSignatureLine(line: string): boolean {
  if (!line) return false;
  const l = line.toLowerCase();

  // Telefon / faks / mobil
  if (/^(?:t(?:el(?:efon)?)?|f(?:ax|aks)?|m(?:ob(?:il)?)?|p(?:hone)?|gsm)\s*[.:+]?\s*[+\d(]/.test(l)) return true;
  if (/^(?:tel|fax|faks|phone|mobile|mobil|gsm)\s*:/i.test(l)) return true;

  // E-posta
  if (/^(?:e-?posta|e-?mail|mail)\s*:/i.test(l)) return true;

  // Web
  if (/^(?:web|www|http|site)\s*[.:]/i.test(l)) return true;

  // Adres: posta kodu + şehir
  if (/\d{5}\s*\/?\s*(?:istanbul|ankara|izmir|bursa|antalya|adana)/i.test(l)) return true;

  // Ünvan
  if (/^(?:ceo|cto|cfo|coo|cio|md|gm|evp|svp|vp|director|manager|müdür|yönetici|uzman|mühendis|koordinatör|sorumlu|başkan|genel\s+müdür|bilgi\s+işlem|insan\s+kaynakları|it\s+manager|proje\s+yöneticisi)$/i.test(l)) return true;

  // Kapanış ifadeleri
  if (/^(?:sayg[ıi]lar[ıi]mla|sayg[ıi]lar[ıi]m[ıi]zla|iyi\s+çalışmalar|iyi\s+günler|kolay\s+gelsin|regards|kind\s+regards|best\s+regards|sincerely|best|thanks|thank\s+you|cheers|with\s+regards)/i.test(l)) return true;

  return false;
}

// ── Ana dönüştürme fonksiyonu ──

export function htmlToPlainText(html: string): string {
  let text = html;

  // 1. Bilinen imza HTML container'larını kaldır
  text = stripHtmlSignatureBlocks(text);

  // 2. Meta blokları kaldır
  text = text.replace(/<head[\s>][\s\S]*?<\/head>/gi, "");
  text = text.replace(/<style[\s>][\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[\s>][\s\S]*?<\/script>/gi, "");
  text = text.replace(/<xml[\s>][\s\S]*?<\/xml>/gi, "");
  text = text.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 3. VML namespace (v:*, o:*, w:*)
  text = text.replace(/<[vow]:[^>]*>[\s\S]*?<\/[vow]:[^>]*>/gi, "");
  text = text.replace(/<[vow]:[^>]*\/>/gi, "");

  // 4. Blok yapılarını satır sonlarına dönüştür
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, "\n");
  text = text.replace(/<(p|div|tr|li|h[1-6]|blockquote)[\s>]/gi, "\n");
  text = text.replace(/<\/td>/gi, "\t");

  // 5. Kalan HTML etiketlerini kaldır
  text = text.replace(/<[^>]*>/g, "");

  // 6. Yarım kalmış HTML tag attribute kalıntılarını kaldır
  text = stripOrphanedTagFragments(text);

  // 7. HTML entity çöz
  text = decodeEntities(text);

  // 8. Boşlukları düzenle
  text = collapseWhitespace(text);

  // 9. Düz metin imza tespiti
  text = stripPlainTextSignature(text);

  return collapseWhitespace(text);
}

// ── rawText kontrolü: HTML kalıntısı var mı? ──

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/;
const VML_RE = /[vow]\\?:\*\s*\{behavior:url\(#default#VML\)/i;

// mailparser'ın bıraktığı kalıntılar: class="..">  style="..">
const ORPHAN_ATTR_RE = /(?:class|style|align|id)\s*=\s*"[^"]*"\s*>/i;

export function looksLikeHtml(text: string): boolean {
  if (HTML_TAG_RE.test(text)) return true;
  if (VML_RE.test(text)) return true;
  if (ORPHAN_ATTR_RE.test(text)) return true;

  // Yoğun entity kullanımı
  const entityCount = (text.match(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi) || []).length;
  if (entityCount > 5 && entityCount / text.length > 0.01) return true;

  return false;
}

// ── DB'den okunan bodyText'i temizle (eski kirli kayıtlar dahil) ──

export function cleanBodyText(bodyText: string | null): string {
  if (!bodyText) return "";

  // Eğer metin HTML gibi görünüyorsa (tam tag veya orphan attribute kalıntısı)
  if (looksLikeHtml(bodyText)) {
    return htmlToPlainText(bodyText);
  }

  let text = bodyText;

  // VML behavior tanımları
  text = text.replace(/[vow]\\?:\*\s*\{behavior:url\(#default#VML\);?\}/gi, "");
  text = text.replace(/\.shape\s*\{behavior:url\(#default#VML\);?\}/gi, "");

  // Entity çöz
  text = decodeEntities(text);

  // İmza kaldır
  text = stripPlainTextSignature(text);

  return collapseWhitespace(text);
}
