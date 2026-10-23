import type { LdapConfig } from "./ldap";

export interface LdapUserEntry {
  email: string;
  displayName: string;
  ldapDn: string;
  /** Oturum adı (AD: sAMAccountName) */
  samAccountName?: string;
}

export interface FetchUsersFromLdapOptions {
  /** true ise Grup Filtresi yok sayılır, tüm kullanıcılar listelenir */
  noGroupFilter?: boolean;
  /** İlk kaydın ham attribute isimleri ve örnek değerleri (debug) */
  collectFirstEntryDebug?: boolean;
  /** Exchange: tercih edilen e-posta domain (örn. "example.com"). proxyAddresses içinde bu domain ile biten SMTP adresi kullanılır. */
  preferredEmailDomain?: string;
}

export interface FirstEntryDebug {
  dn: string;
  attributeNames: string[];
  sample: Record<string, string>;
}

/**
 * AD/LDAP üzerinde arama yapıp e-posta + DN çıkarılabilen kullanıcıları döndürür.
 * Veritabanına yazmaz; sadece LDAP'tan okur.
 */
export async function fetchUsersFromLdap(
  config: LdapConfig,
  options?: FetchUsersFromLdapOptions
): Promise<{ users: LdapUserEntry[]; entriesFound: number; firstEntryDebug?: FirstEntryDebug }> {
  if (!config.searchBase?.trim()) {
    throw new Error("Search Base (Base DN) boş olamaz.");
  }
  if (!config.bindDn?.trim()) {
    throw new Error("Bind DN boş olamaz.");
  }

  const ldap = await import("ldapjs");
  const client = ldap.createClient({ url: config.url });

  const useGroupFilter = !options?.noGroupFilter && config.groupFilter?.trim();
  const filter = useGroupFilter
    ? `(&(objectClass=user)(memberOf=${config.groupFilter!.trim()}))`
    : "(objectClass=user)";

  return new Promise((resolve, reject) => {
    const users: LdapUserEntry[] = [];
    let entriesFound = 0;
    let firstEntryDebug: FirstEntryDebug | undefined;

    function toStr(val: unknown): string | undefined {
      if (val === undefined || val === null) return undefined;
      const one = Array.isArray(val) ? val[0] : val;
      if (one === undefined || one === null) return undefined;
      if (typeof one === "string") return one.trim() || undefined;
      if (typeof one === "number" || typeof one === "boolean") return String(one);
      if (Buffer.isBuffer(one)) return one.toString("utf8").trim() || undefined;
      if (typeof (one as { toString?: () => string }).toString === "function") {
        try {
          const s = (one as Buffer).toString("utf8");
          return s?.trim() || undefined;
        } catch {
          return String(one);
        }
      }
      return String(one);
    }

    type AttrLike = { type?: string; name?: string; values?: unknown[]; vals?: unknown[]; buffers?: unknown[] };
    function getVals(a: AttrLike): unknown[] | undefined {
      const v = a.values ?? a.vals ?? a.buffers;
      return Array.isArray(v) && v.length > 0 ? v : undefined;
    }
    function getAttrName(a: AttrLike): string {
      return ((a.type ?? a.name ?? "") as string).toLowerCase();
    }

    function getAttr(
      obj: Record<string, unknown>,
      ...keys: string[]
    ): string | undefined {
      const keySet = new Set(keys.map((k) => k.toLowerCase()));
      if (Array.isArray(obj.attributes)) {
        const attrs = obj.attributes as AttrLike[];
        for (const a of attrs) {
          const name = getAttrName(a);
          if (!name) continue;
          if (keySet.has(name) || keys.some((k) => name.includes(k.toLowerCase()) || k.toLowerCase().includes(name))) {
            const vals = getVals(a);
            if (vals?.length) {
              const s = toStr(vals);
              if (s) return s;
            }
          }
        }
        for (const key of keys) {
          const lower = key.toLowerCase();
          const a = attrs.find((x) => getAttrName(x) === lower || getAttrName(x).includes(lower));
          if (a) {
            const vals = getVals(a);
            if (vals?.length) {
              const s = toStr(vals);
              if (s) return s;
            }
          }
        }
      }
      for (const key of keys) {
        const v = obj[key] ?? obj[key.toLowerCase()] ?? obj[key.toUpperCase()];
        const s = toStr(v);
        if (s) return s;
      }
      for (const [k, v] of Object.entries(obj)) {
        if (k === "attributes" || v === undefined) continue;
        const kLower = k.toLowerCase();
        if (keys.some((key) => key.toLowerCase() === kLower || kLower.includes(key.toLowerCase()))) {
          const s = toStr(v);
          if (s) return s;
        }
      }
      return undefined;
    }

    /** proxyAddresses (Exchange) içinden birincil SMTP veya tercih edilen domain ile biten e-postayı döndürür. */
    function getEmailFromProxyAddresses(
      obj: Record<string, unknown>,
      preferredDomain?: string
    ): string | undefined {
      const raw = getAttrMulti(obj, "proxyaddresses");
      if (!raw?.length) return undefined;
      const preferred = preferredDomain?.toLowerCase().replace(/^@/, "");
      let primary: string | undefined;
      let preferredMatch: string | undefined;
      for (const entry of raw) {
        const s = (typeof entry === "string" ? entry : toStr(entry))?.trim();
        if (!s) continue;
        const upper = s.toUpperCase();
        if (upper.startsWith("SMTP:")) {
          const addr = s.slice(5).trim();
          if (addr && /@/.test(addr)) {
            primary = addr;
            if (preferred && addr.toLowerCase().endsWith("@" + preferred)) preferredMatch = addr;
          }
        }
      }
      return preferredMatch ?? primary;
    }

    function getAttrMulti(obj: Record<string, unknown>, ...keys: string[]): unknown[] {
      for (const key of keys) {
        const keyLower = key.toLowerCase();
        if (Array.isArray(obj.attributes)) {
          const attrs = obj.attributes as AttrLike[];
          const a = attrs.find((x) => getAttrName(x) === keyLower || getAttrName(x).includes(keyLower));
          const vals = a ? getVals(a) : undefined;
          if (vals?.length) return vals;
        }
        const v = obj[key] ?? obj[keyLower] ?? obj[key.toUpperCase()];
        if (Array.isArray(v)) return v;
        if (v !== undefined && v !== null) return [v];
      }
      return [];
    }

    function entryToObj(entry: {
      pojo?: unknown;
      object?: Record<string, unknown>;
      dn?: string;
      attributes?: AttrLike[];
    }): Record<string, unknown> & { attributes?: unknown } {
      const raw = entry.pojo ?? entry.object;
      const fromPojo =
        typeof raw === "function"
          ? (raw as () => Record<string, unknown>)()
          : (raw as Record<string, unknown> | undefined) ?? {};
      const pojoAttrs = fromPojo?.attributes;
      if (Array.isArray(entry.attributes) && entry.attributes.length > 0) {
        const fromAttrs: Record<string, unknown> = {};
        for (const a of entry.attributes) {
          const name = getAttrName(a);
          if (!name) continue;
          const vals = getVals(a);
          if (vals?.length) fromAttrs[name] = vals.length === 1 ? vals[0] : vals;
        }
        return { ...fromAttrs, ...fromPojo, attributes: entry.attributes };
      }
      if (Array.isArray(pojoAttrs) && pojoAttrs.length > 0) {
        const fromAttrs: Record<string, unknown> = {};
        for (const a of pojoAttrs as AttrLike[]) {
          const name = getAttrName(a);
          if (!name) continue;
          const vals = getVals(a);
          if (vals?.length) fromAttrs[name] = vals.length === 1 ? vals[0] : vals;
        }
        return { ...fromAttrs, ...fromPojo, attributes: pojoAttrs };
      }
      return { ...fromPojo, attributes: fromPojo?.attributes };
    }

    client.bind(config.bindDn, config.bindPassword, (bindErr: Error | null) => {
      if (bindErr) {
        client.destroy();
        reject(new Error(`LDAP bağlanamadı (Bind): ${bindErr.message}`));
        return;
      }

      const opts = {
        filter,
        scope: "sub" as const,
        attributes: ["*", "mail", "displayName", "dn", "userPrincipalName", "sAMAccountName", "cn", "proxyAddresses"],
      };

      client.search(
        config.searchBase,
        opts,
        (searchErr: Error | null, res: { on: (e: string, fn: (arg: unknown) => void) => void }) => {
          if (searchErr) {
            client.unbind();
            client.destroy();
            reject(new Error(`LDAP arama hatası: ${searchErr.message}`));
            return;
          }

          res.on(
            "searchEntry",
            (entry: unknown) => {
              const e = entry as {
                pojo?: unknown;
                dn?: string;
                object?: Record<string, unknown>;
                attributes?: AttrLike[];
              };
              entriesFound++;
              const obj = entryToObj(e);
              const dnStr = typeof e.dn === "string" ? e.dn : getAttr(obj, "dn") ?? "";

              if (options?.collectFirstEntryDebug && entriesFound === 1) {
                const names: string[] = [];
                const sample: Record<string, string> = {};
                const attrs = (obj.attributes ?? e.attributes) as AttrLike[] | undefined;
                if (Array.isArray(attrs)) {
                  for (const a of attrs) {
                    const name = getAttrName(a) || (a.type ?? a.name ?? "");
                    if (name) {
                      names.push(String(a.type ?? a.name ?? name));
                      const vals = getVals(a);
                      if (vals?.length) {
                        const s = toStr(vals);
                        if (s && s.length < 200) sample[name] = s;
                        else if (s) sample[name] = s.substring(0, 120) + "...";
                      }
                    }
                  }
                }
                for (const k of Object.keys(obj)) {
                  if (k === "attributes") continue;
                  const v = obj[k];
                  const s = toStr(v);
                  if (s && !sample[k]) sample[k] = s.length < 200 ? s : s.substring(0, 120) + "...";
                }
                firstEntryDebug = { dn: dnStr, attributeNames: names.length ? names : Object.keys(sample), sample };
              }

              const preferredDomain = options?.preferredEmailDomain;
              const emailFromProxy = getEmailFromProxyAddresses(obj, preferredDomain);
              const mail =
                emailFromProxy ??
                getAttr(obj, "mail", "userPrincipalName") ??
                getAttr(obj, "sAMAccountName");
              const displayName = getAttr(obj, "displayName", "cn") ?? mail ?? "Unknown";

              const domainFromBase = config.searchBase
                .replace(/DC=/gi, "")
                .replace(/,/g, ".")
                .trim() || "local";
              const email =
                mail && /[@.]/.test(mail) ? mail : mail ? `${mail}@${domainFromBase}` : undefined;
              if (email && dnStr) {
                const allowedDomain = (options?.preferredEmailDomain ?? config.preferredEmailDomain)?.toLowerCase().replace(/^@/, "");
                if (allowedDomain && !email.toLowerCase().endsWith("@" + allowedDomain)) return;
                const samAccountName = getAttr(obj, "sAMAccountName");
                users.push({
                  email,
                  displayName: typeof displayName === "string" ? displayName : "Unknown",
                  ldapDn: dnStr,
                  samAccountName: samAccountName || undefined,
                });
              }
            }
          );

          res.on("error", (e: unknown) => {
            client.unbind();
            client.destroy();
            reject(e instanceof Error ? e : new Error(String(e)));
          });

          res.on("end", () => {
            client.unbind();
            client.destroy();
            resolve({ users, entriesFound, firstEntryDebug });
          });
        }
      );
    });
  });
}
