import { apiRoute } from "@/lib/api/handler";
import { getActiveMemberships } from "@/lib/auth/authorize";
import { roleHome } from "@/lib/auth/permissions";
import { switchEstateSchema } from "@/lib/validation/members";
import { switchActiveEstate } from "@/server/services/members";

export const POST = apiRoute({ auth: "user", body: switchEstateSchema }, async ({ user, body }) => {
  await switchActiveEstate(user, body.estateId);
  const member = (await getActiveMemberships(user.uid)).find((candidate) => candidate.estateId === body.estateId);
  return { redirectTo: member ? roleHome(member.role) : "/" };
});
