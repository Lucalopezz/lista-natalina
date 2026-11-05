import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./server";

/**
 * Lê a identidade validada no banco, não dados de formulário nem apenas presença
 * de cookie. A ausência de cookie permite negar anônimos sem abrir conexão.
 * O DTO contém somente o perfil próprio; sessão e token não chegam ao JSX.
 */
export async function getCurrentUser() {
  const requestHeaders = await headers();
  if (!requestHeaders.get("cookie")) return null;
  try {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session) return null;
    const { id, name, email } = session.user;
    return { id, name, email };
  } catch {
    // Não devolver erro/cause do driver ao Next: o framework pode registrá-lo.
    // Falha de infraestrutura permanece erro, sem fingir que a sessão foi revogada.
    throw new Error("Não foi possível carregar sua conta agora.");
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  return user;
}
