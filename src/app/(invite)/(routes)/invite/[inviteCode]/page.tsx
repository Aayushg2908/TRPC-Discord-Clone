import { serverClient } from "@/app/_trpc/serverClient";
import { currentProfile } from "@/lib/current-profile";
import { db } from "@/lib/db";
import { redirectToSignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

const InviteCodePage = async ({
  params,
}: {
  params: { inviteCode: string };
}) => {
  const profile = await currentProfile();
  if (!profile) {
    return redirectToSignIn();
  }

  if (!params.inviteCode) {
    return redirect("/");
  }

  const existingServer = await serverClient.existingServer({
    inviteCode: params.inviteCode,
    profileId: profile.id,
  });

  if (existingServer) {
    return redirect(`/servers/${existingServer.id}`);
  }

  const server = await serverClient.joinThroughInvite({
    inviteCode: params.inviteCode,
    profileId: profile.id,
  });

  if (server) {
    return redirect(`/servers/${server.id}`);
  }

  return null;
};

export default InviteCodePage;
