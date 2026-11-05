import "server-only";
import type { Auth } from "./config";
import { signInSchema, signUpSchema } from "./validation";

const messages = {
  unauthorized: "Entre na sua conta para continuar.",
  credentials: "Email ou senha inválidos.",
  invalid: "Confira os dados informados e tente novamente.",
  unavailable: "Não foi possível acessar sua conta agora. Tente novamente em instantes.",
};
function json(body: unknown, status: number, headers?: Headers) {
  const safeHeaders = new Headers(headers);
  safeHeaders.set("cache-control", "no-store");
  safeHeaders.set("content-type", "application/json");
  return new Response(JSON.stringify(body), { status, headers: safeHeaders });
}

/** Limita o corpo de verdade, inclusive se o cliente omitir/forjar Content-Length. */
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new Error("Body too large"); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

/**
 * Expõe somente o contrato desta fase. A validação ocorre aqui para proteger também
 * chamadas diretas, e não só formulários. Cookies da biblioteca são preservados,
 * mas tokens, documentos de sessão e campos internos não são serializados ao cliente.
 */
export function createAuthHttpHandler(auth: Auth) {
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
    const allowed = request.method === "GET"
      ? ["get-session", "ok"].includes(path)
      : request.method === "POST" && ["sign-up/email", "sign-in/email", "sign-out"].includes(path);
    if (!allowed) return json({ message: "Operação não encontrada." }, 404);
    if (request.method === "POST" && request.headers.get("origin") !== auth.options.baseURL) {
      return json({ message: "Origem não autorizada." }, 403);
    }

    let safeRequest = request;
    if (path === "sign-up/email" || path === "sign-in/email") {
      try {
        const schema = path === "sign-up/email" ? signUpSchema : signInSchema;
        const parsed = schema.safeParse(await readBody(request));
        if (!parsed.success) return json({ message: messages.invalid }, 400);
        // Reconstrói o body com campos permitidos. Identidade, papel, callbackURL e
        // qualquer privilégio arbitrário enviado pelo cliente são descartados.
        safeRequest = new Request(request.url, {
          method: "POST", headers: request.headers, body: JSON.stringify(parsed.data),
        });
      } catch { return json({ message: messages.invalid }, 400); }
    }
    try {
      const response = await auth.handler(safeRequest);
      const data = await response.json();
      if (!response.ok) {
        if (String(data.code).includes("USER_ALREADY_EXISTS")) {
          return json({ message: "Este email já está cadastrado." }, 409, response.headers);
        }
        const status = response.status;
        const message = status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente."
          : status === 401 ? messages.credentials
          : status >= 500 ? messages.unavailable : messages.invalid;
        return json({ message }, status, response.headers);
      }
      if (path === "sign-out" || path === "ok") return json({ success: true }, 200, response.headers);
      if (!data?.user) return json({ message: messages.unauthorized }, 401, response.headers);
      const { id, name, email } = data.user;
      return json({ user: { id, name, email } }, 200, response.headers);
    } catch {
      return json({ message: messages.unavailable }, 503);
    }
  };
}
