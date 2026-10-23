import LdapAuth from "ldapauth-fork";
import ldapjs from "ldapjs";
import { getLdapConfig, type LdapConfig } from "@/lib/ldap";

export type LdapAuthUser = {
  dn: string;
  mail?: string;
  displayName?: string;
  samAccountName?: string;
};

/** LDAP filter değer kaçışı (RFC 4515). */
export function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\0*()\\]/g, (ch) => {
    const hex = ch.charCodeAt(0).toString(16).padStart(2, "0");
    return `\\${hex}`;
  });
}

function normalizeSearchFilter(filter: string): string {
  return filter.replace(/%s/g, "{{username}}");
}

function toStr(val: unknown): string | undefined {
  if (val === undefined || val === null) return undefined;
  const one = Array.isArray(val) ? val[0] : val;
  if (one === undefined || one === null) return undefined;
  if (typeof one === "string") return one.trim() || undefined;
  if (typeof one === "number" || typeof one === "boolean") return String(one);
  if (Buffer.isBuffer(one)) return one.toString("utf8").trim() || undefined;
  return String(one);
}

type AttrLike = { type?: string; name?: string; values?: unknown[]; vals?: unknown[]; buffers?: unknown[] };

function getAttrName(a: AttrLike): string {
  return ((a.type ?? a.name ?? "") as string).toLowerCase();
}

function getVals(a: AttrLike): unknown[] | undefined {
  const v = a.values ?? a.vals ?? a.buffers;
  return Array.isArray(v) && v.length > 0 ? v : undefined;
}

function entryToObj(entry: {
  pojo?: unknown;
  object?: Record<string, unknown>;
  dn?: string | { toString?: () => string };
  attributes?: AttrLike[];
}): Record<string, unknown> {
  const raw = entry.pojo ?? entry.object;
  const fromPojo =
    typeof raw === "function"
      ? (raw as () => Record<string, unknown>)()
      : (raw as Record<string, unknown> | undefined) ?? {};
  if (Array.isArray(entry.attributes) && entry.attributes.length > 0) {
    const fromAttrs: Record<string, unknown> = {};
    for (const a of entry.attributes) {
      const name = getAttrName(a);
      if (!name) continue;
      const vals = getVals(a);
      if (vals?.length) fromAttrs[name] = vals.length === 1 ? vals[0] : vals;
    }
    return { ...fromAttrs, ...fromPojo };
  }
  return { ...fromPojo };
}

function getAttr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key] ?? obj[key.toLowerCase()] ?? obj[key.toUpperCase()];
    const s = toStr(v);
    if (s) return s;
  }
  return undefined;
}

/**
 * sAMAccountName (veya filtredeki {{username}}) ile LDAP doğrulama.
 */
export async function authenticateLdap(
  username: string,
  password: string,
  configOverride?: LdapConfig | null
): Promise<LdapAuthUser | null> {
  const config = configOverride ?? getLdapConfig();
  if (!config) return null;

  return new Promise((resolve) => {
    const ldap = new LdapAuth({
      url: config.url,
      bindDN: config.bindDn,
      bindCredentials: config.bindPassword,
      searchBase: config.searchBase,
      searchFilter: normalizeSearchFilter(config.searchFilter || "(sAMAccountName={{username}})"),
    });

    ldap.on("error", () => {
      ldap.close();
      resolve(null);
    });

    ldap.authenticate(username, password, (err: Error | string | null, user: { dn?: string; mail?: string; displayName?: string; sAMAccountName?: string } | undefined) => {
      ldap.close();
      if (err || !user) {
        resolve(null);
        return;
      }
      const mail = Array.isArray(user.mail) ? user.mail[0] : user.mail;
      const displayName = Array.isArray(user.displayName) ? user.displayName[0] : user.displayName;
      const sam = Array.isArray(user.sAMAccountName) ? user.sAMAccountName[0] : user.sAMAccountName;
      resolve({
        dn: user.dn || "",
        mail: typeof mail === "string" ? mail : undefined,
        displayName: typeof displayName === "string" ? displayName : undefined,
        samAccountName: typeof sam === "string" ? sam : undefined,
      });
    });
  });
}

/** DN + parola ile doğrudan bind. */
export async function authenticateLdapByDn(
  dn: string,
  password: string,
  configOverride?: LdapConfig | null
): Promise<boolean> {
  const config = configOverride ?? getLdapConfig();
  if (!config?.url || !dn || !password) return false;

  return new Promise((resolve) => {
    const client = ldapjs.createClient({ url: config.url, reconnect: false });
    client.on("error", () => {
      client.destroy();
      resolve(false);
    });
    client.bind(dn, password, (err: Error | null) => {
      client.unbind(() => {});
      client.destroy();
      resolve(!err);
    });
  });
}

/**
 * Service bind ile AD'de e-posta / UPN / proxyAddresses arar; güncel DN döner.
 * DN yeniden adlandırıldığında bayat DB ldapDn sorununu çözer.
 */
export async function findLdapUserByEmail(
  email: string,
  configOverride?: LdapConfig | null
): Promise<LdapAuthUser | null> {
  const config = configOverride ?? getLdapConfig();
  if (!config?.url || !config.searchBase || !email.includes("@")) return null;

  const safe = escapeLdapFilterValue(email.trim());
  const filter =
    `(&(objectClass=user)(!(objectClass=computer))` +
    `(|(mail=${safe})(userPrincipalName=${safe})` +
    `(proxyAddresses=SMTP:${safe})(proxyAddresses=smtp:${safe})))`;

  return new Promise((resolve) => {
    const client = ldapjs.createClient({ url: config.url, reconnect: false });
    let settled = false;
    const finish = (value: LdapAuthUser | null) => {
      if (settled) return;
      settled = true;
      try {
        client.unbind(() => {});
      } catch {
        /* ignore */
      }
      try {
        client.destroy();
      } catch {
        /* ignore */
      }
      resolve(value);
    };

    client.on("error", () => finish(null));

    client.bind(config.bindDn, config.bindPassword, (bindErr: Error | null) => {
      if (bindErr) {
        finish(null);
        return;
      }

      let found: LdapAuthUser | null = null;

      client.search(
        config.searchBase,
        {
          filter,
          scope: "sub",
          sizeLimit: 5,
          attributes: ["mail", "displayName", "userPrincipalName", "sAMAccountName", "cn", "proxyAddresses"],
        },
        (searchErr: Error | null, res: { on: (e: string, fn: (arg: unknown) => void) => void }) => {
          if (searchErr) {
            finish(null);
            return;
          }

          res.on("searchEntry", (entry: unknown) => {
            if (found) return;
            const e = entry as {
              pojo?: unknown;
              dn?: string | { toString?: () => string };
              object?: Record<string, unknown>;
              attributes?: AttrLike[];
            };
            const obj = entryToObj(e);
            const dnRaw = e.dn;
            const dnStr =
              typeof dnRaw === "string"
                ? dnRaw
                : typeof dnRaw?.toString === "function"
                  ? dnRaw.toString()
                  : getAttr(obj, "dn") ?? "";
            if (!dnStr) return;

            const mail =
              getAttr(obj, "mail") ??
              getAttr(obj, "userPrincipalName") ??
              email;
            const displayName = getAttr(obj, "displayName", "cn") ?? undefined;
            const samAccountName = getAttr(obj, "sAMAccountName") ?? undefined;
            found = {
              dn: dnStr,
              mail: typeof mail === "string" ? mail : email,
              displayName,
              samAccountName,
            };
          });

          res.on("error", () => finish(null));
          res.on("end", () => finish(found));
        }
      );
    });
  });
}

/**
 * E-posta + parola ile LDAP doğrulama: AD'de e-posta ile ara → güncel DN'e bind.
 */
export async function authenticateLdapByEmail(
  email: string,
  password: string,
  configOverride?: LdapConfig | null
): Promise<LdapAuthUser | null> {
  const found = await findLdapUserByEmail(email, configOverride);
  if (!found?.dn) return null;
  const ok = await authenticateLdapByDn(found.dn, password, configOverride);
  if (!ok) return null;
  return found;
}
