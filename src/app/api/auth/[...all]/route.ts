import { getAuth } from "@/modules/auth/server";
import { createAuthHttpHandler } from "@/modules/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    const auth = await getAuth();
    return await createAuthHttpHandler(auth)(request);
  } catch {
    // Falha fechada e sanitizada: a URI/erro do banco nunca deve ir para a resposta.
    return Response.json({ message: "Não foi possível acessar sua conta agora. Tente novamente em instantes." }, {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
}
export { handle as GET, handle as POST };
