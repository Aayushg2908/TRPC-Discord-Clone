import { redirectToSignIn } from "@clerk/nextjs";
import { serverClient } from "@/app/_trpc/serverClient";
import { redirect } from "next/navigation";
import { InitialModal } from "@/components/modals/initial-modal";

const SetupPage = async () => {
  const profile = await serverClient.initialProfile();
  if (!profile) {
    return redirectToSignIn();
  }

  const server = await serverClient.findServer(profile.id);
  if (server) {
    return redirect(`/servers/${server.id}`);
  }
  return <InitialModal />;
};

export default SetupPage;