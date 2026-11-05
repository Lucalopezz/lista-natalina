import { Brand } from "@/components/brand";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");
  return <main className="mx-auto max-w-xl px-4 py-6 sm:px-6"><Brand />{children}</main>;
}
