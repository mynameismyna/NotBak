import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessSettings } from "@/lib/authz";
import LdapSettingsClient from "./LdapSettingsClient";

export default async function LdapSettingsPage() {
  const session = await getSession();
  if (!session || !canAccessSettings(session)) redirect("/dashboard");
  return <LdapSettingsClient />;
}
