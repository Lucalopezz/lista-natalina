import { GroupError } from "./service";
import type { createGroupService } from "./service";
import { candidateQuerySchema, groupIdSchema } from "./validation";

type Dependencies = {
  getUser(): Promise<{ id: string } | null>;
  getService(): Promise<Pick<ReturnType<typeof createGroupService>, "search">>;
};
/** Adapta a leitura interativa sem tornar o diretório de contas público ou cacheável. */
export function createCandidateSearchHandler({ getUser, getService }: Dependencies) {
  return async (request: Request, groupId: string): Promise<Response> => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "private, no-store" } });
    try {
      const user = await getUser();
      if (!user) return json({ message: "Entre na sua conta para continuar." }, 401);
      if (!groupIdSchema.safeParse(groupId).success) return json({ message: "Grupo não encontrado." }, 404);
      const params = new URL(request.url).searchParams;
      const query = candidateQuerySchema.safeParse({ q: params.get("q") ?? "", cursor: params.get("cursor") ?? undefined });
      if (!query.success || params.getAll("q").length > 1 || params.getAll("cursor").length > 1) {
        return json({ message: "Use até 100 caracteres e uma página válida para pesquisar." }, 400);
      }
      // O grupo vem da URL, mas o autor só vem da sessão. O serviço relê seu
      // papel de administrador e os candidatos no mesmo snapshot; esconder o
      // componente ou conhecer o ID não concede acesso a esse endpoint.
      const service = await getService();
      return json(await service.search(user.id, groupId, query.data));
    } catch (error) {
      if (error instanceof GroupError) {
        const status = error.code === "unauthorized" ? 401 : error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 400;
        return json({ message: error.message }, status);
      }
      return json({ message: "Não foi possível pesquisar agora. Tente novamente." }, 503);
    }
  };
}
