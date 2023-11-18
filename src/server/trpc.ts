import { currentUser } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { initTRPC, TRPCError } from "@trpc/server";

const t = initTRPC.create();

const isAuthed = t.middleware(async (opts) => {
  const user = await currentUser();

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }

  return opts.next({
    ctx: {
      user,
    },
  });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const privateProcedure = t.procedure.use(isAuthed);
