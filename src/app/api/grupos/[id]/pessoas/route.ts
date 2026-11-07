import { getCurrentUser } from "@/modules/auth/session";
import { getGroupService } from "@/modules/groups/server";
import { createCandidateSearchHandler } from "@/modules/groups/search-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const search = createCandidateSearchHandler({ getUser: getCurrentUser, getService: getGroupService });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return search(request, (await params).id);
}
