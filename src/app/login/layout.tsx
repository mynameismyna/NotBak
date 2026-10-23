import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/config";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSetupComplete()) {
    redirect("/setup");
  }
  return <>{children}</>;
}
