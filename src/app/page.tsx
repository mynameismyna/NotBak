import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/config";

export default function HomePage() {
  if (!isSetupComplete()) {
    redirect("/setup");
  }
  redirect("/dashboard");
}
