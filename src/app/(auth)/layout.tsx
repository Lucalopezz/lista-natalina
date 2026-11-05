import { Brand } from "@/components/brand";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/modules/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/dashboard");
  return <main className="mx-auto max-w-[600px] px-6 pt-7 pb-12 md:px-12 md:pt-10"><Brand />{children}</main>;
}
