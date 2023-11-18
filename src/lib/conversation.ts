import { serverClient } from "@/app/_trpc/serverClient";

export const getOrCreateConversation = async (
  memberOneId: string,
  memberTwoId: string
) => {
  const conversation1 = await serverClient.findConversation({
    memberOneId: memberOneId,
    memberTwoId: memberTwoId,
  });
  const conversation2 = await serverClient.findConversation({
    memberTwoId: memberOneId,
    memberOneId: memberTwoId,
  });

  let conversation = conversation1 || conversation2;

  if (!conversation) {
    conversation = await serverClient.createNewConversation({
      memberOneId,
      memberTwoId,
    });
  }

  return conversation;
};
