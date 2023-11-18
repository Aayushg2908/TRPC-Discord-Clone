import { privateProcedure, publicProcedure, router } from "./trpc";
import { db } from "@/lib/db";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { ChannelType, MemberRole } from "@prisma/client";
import { currentProfile } from "@/lib/current-profile";

export const appRouter = router({
  initialProfile: privateProcedure.query(async (opts) => {
    const user = opts.ctx.user;
    if (!user) {
      return null;
    }

    const profile = await db.profile.findFirst({
      where: {
        userId: user.id,
      },
    });
    if (profile) {
      return profile;
    }

    const newProfile = await db.profile.create({
      data: {
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`,
        imageUrl: user.imageUrl,
        email: user.emailAddresses[0].emailAddress,
      },
    });
    return newProfile;
  }),
  findServer: privateProcedure.input(z.string()).query(async (opts) => {
    const server = await db.server.findFirst({
      where: {
        members: {
          some: {
            profileId: opts.input,
          },
        },
      },
    });

    return server;
  }),
  initialServer: privateProcedure
    .input(
      z.object({
        name: z.string().min(1),
        imageUrl: z.string().min(1),
      })
    )
    .mutation(async (opts) => {
      const profile = await db.profile.findUnique({
        where: {
          userId: opts.ctx.user.id,
        },
      });
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }
      const { name, imageUrl } = opts.input;

      const server = await db.server.create({
        data: {
          profileId: profile.id,
          name,
          imageUrl,
          inviteCode: uuidv4(),
          channels: {
            create: [{ name: "general", profileId: profile.id }],
          },
          members: {
            create: [{ profileId: profile.id, role: MemberRole.ADMIN }],
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  findServers: privateProcedure.input(z.string()).query(async (opts) => {
    const servers = await db.server.findMany({
      where: {
        members: {
          some: {
            profileId: opts.input,
          },
        },
      },
    });

    return servers;
  }),
  createServer: privateProcedure
    .input(
      z.object({
        name: z.string().min(1),
        imageUrl: z.string().min(1),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }
      const { name, imageUrl } = opts.input;

      const server = await db.server.create({
        data: {
          profileId: profile.id,
          name,
          imageUrl,
          inviteCode: uuidv4(),
          channels: {
            create: [{ name: "general", profileId: profile.id }],
          },
          members: {
            create: [{ profileId: profile.id, role: MemberRole.ADMIN }],
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  generateNewInviteCode: privateProcedure
    .input(z.string().nullish())
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const serverId = opts.input;
      if (!serverId) {
        throw new TRPCError({
          code: "NOT_FOUND",
        });
      }

      const server = await db.server.update({
        where: {
          id: serverId,
          profileId: profile.id,
        },
        data: {
          inviteCode: uuidv4(),
        },
      });

      return { code: 200, server };
    }),
  existingServer: privateProcedure
    .input(
      z.object({
        inviteCode: z.string(),
        profileId: z.string(),
      })
    )
    .query(async (opts) => {
      const { inviteCode, profileId } = opts.input;
      const existingServer = await db.server.findFirst({
        where: {
          inviteCode: inviteCode,
          members: {
            some: {
              profileId: profileId,
            },
          },
        },
      });

      return existingServer;
    }),
  joinThroughInvite: privateProcedure
    .input(
      z.object({
        inviteCode: z.string(),
        profileId: z.string(),
      })
    )
    .query(async (opts) => {
      const { inviteCode, profileId } = opts.input;

      const server = await db.server.update({
        where: {
          inviteCode: inviteCode,
        },
        data: {
          members: {
            create: [
              {
                profileId: profileId,
              },
            ],
          },
        },
      });

      return server;
    }),
  updateServer: privateProcedure
    .input(
      z.object({
        name: z.string().min(1),
        imageUrl: z.string().min(1),
        serverId: z.string().optional(),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const { name, imageUrl, serverId } = opts.input;

      const server = await db.server.update({
        where: {
          id: serverId,
          profileId: profile.id,
        },
        data: {
          name,
          imageUrl,
        },
      });

      return { code: 200, server };
    }),
  roleChange: privateProcedure
    .input(
      z.object({
        serverId: z.string().min(1),
        memberId: z.string().min(1),
        role: z.enum([
          MemberRole.ADMIN,
          MemberRole.MODERATOR,
          MemberRole.GUEST,
        ]),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const { serverId, role, memberId } = opts.input;

      const server = await db.server.update({
        where: {
          id: serverId,
          profileId: profile.id,
        },
        data: {
          members: {
            update: {
              where: {
                id: memberId,
                profileId: {
                  not: profile.id,
                },
              },
              data: {
                role,
              },
            },
          },
        },
        include: {
          members: {
            include: {
              profile: true,
            },
            orderBy: {
              role: "asc",
            },
          },
        },
      });

      return { code: 200, server };
    }),
  kickMember: privateProcedure
    .input(
      z.object({
        memberId: z.string().min(1),
        serverId: z.string().min(1),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const { serverId, memberId } = opts.input;

      const server = await db.server.update({
        where: {
          id: serverId,
          profileId: profile.id,
        },
        data: {
          members: {
            deleteMany: {
              id: memberId,
              profileId: {
                not: profile.id,
              },
            },
          },
        },
        include: {
          members: {
            include: {
              profile: true,
            },
            orderBy: {
              role: "asc",
            },
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  createChannel: privateProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.nativeEnum(ChannelType),
        serverId: z.string().min(1).optional(),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const { name, type, serverId } = opts.input;

      if (name === "general") {
        throw new TRPCError({
          message: "Name cannot be general",
          code: "BAD_REQUEST",
        });
      }

      const server = await db.server.update({
        where: {
          id: serverId,
          members: {
            some: {
              profileId: profile.id,
              role: {
                in: [MemberRole.ADMIN, MemberRole.MODERATOR],
              },
            },
          },
        },
        data: {
          channels: {
            create: {
              profileId: profile.id,
              name,
              type,
            },
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  leaveServer: privateProcedure
    .input(z.string().min(1).optional())
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const serverId = opts.input;

      const server = await db.server.update({
        where: {
          id: serverId,
          profileId: {
            not: profile.id,
          },
          members: {
            some: {
              profileId: profile.id,
            },
          },
        },
        data: {
          members: {
            deleteMany: {
              profileId: profile.id,
            },
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  deleteServer: privateProcedure
    .input(z.string().min(1).optional())
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const serverId = opts.input;

      const server = await db.server.delete({
        where: {
          id: serverId,
          profileId: profile.id,
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  deleteChannel: privateProcedure
    .input(
      z.object({
        channelId: z.string().min(1).optional(),
        serverId: z.string().min(1).optional(),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const { channelId, serverId } = opts.input;

      const server = await db.server.update({
        where: {
          id: serverId,
          members: {
            some: {
              profileId: profile.id,
              role: {
                in: [MemberRole.ADMIN, MemberRole.MODERATOR],
              },
            },
          },
        },
        data: {
          channels: {
            delete: {
              id: channelId,
              name: {
                not: "general",
              },
            },
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  editChannel: privateProcedure
    .input(
      z.object({
        name: z.string().min(1),
        type: z.nativeEnum(ChannelType),
        channelId: z.string().min(1).optional(),
        serverId: z.string().min(1).optional(),
      })
    )
    .mutation(async (opts) => {
      const profile = await currentProfile();
      if (!profile) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
        });
      }

      const { name, type, channelId, serverId } = opts.input;
      if (name === "general") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Name cannot be general",
        });
      }

      const server = await db.server.update({
        where: {
          id: serverId,
          members: {
            some: {
              profileId: profile.id,
              role: {
                in: [MemberRole.ADMIN, MemberRole.MODERATOR],
              },
            },
          },
        },
        data: {
          channels: {
            update: {
              where: {
                id: channelId,
                NOT: {
                  name: "general",
                },
              },
              data: {
                name,
                type,
              },
            },
          },
        },
      });

      return {
        code: 200,
        server,
      };
    }),
  findConversation: privateProcedure
    .input(
      z.object({
        memberOneId: z.string(),
        memberTwoId: z.string(),
      })
    )
    .query(async (opts) => {
      const { memberOneId, memberTwoId } = opts.input;
      const conversation = await db.conversation.findFirst({
        where: {
          AND: [{ memberOneId: memberOneId }, { memberTwoId: memberTwoId }],
        },
        include: {
          memberOne: {
            include: {
              profile: true,
            },
          },
          memberTwo: {
            include: {
              profile: true,
            },
          },
        },
      });

      return conversation;
    }),
  createNewConversation: privateProcedure
    .input(
      z.object({
        memberOneId: z.string(),
        memberTwoId: z.string(),
      })
    )
    .query(async (opts) => {
      const { memberOneId, memberTwoId } = opts.input;
      const conversation = await db.conversation.create({
        data: {
          memberOneId,
          memberTwoId,
        },
        include: {
          memberOne: {
            include: {
              profile: true,
            },
          },
          memberTwo: {
            include: {
              profile: true,
            },
          },
        },
      });

      return conversation;
    }),
  currentMember: privateProcedure
    .input(
      z.object({
        serverId: z.string().min(1),
        profileId: z.string().min(1),
      })
    )
    .query(async (opts) => {
      const { serverId, profileId } = opts.input;

      const currentMember = await db.member.findFirst({
        where: {
          serverId: serverId,
          profileId: profileId,
        },
        include: {
          profile: true,
        },
      });

      return currentMember;
    }),
});

export type AppRouter = typeof appRouter;
