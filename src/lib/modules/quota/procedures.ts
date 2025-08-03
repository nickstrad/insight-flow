import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { getQuota } from "./utils";

export const quotasRouter = createTRPCRouter({
  getQuota: baseProcedure
    .input(
      z.object({
        userEmail: z.string().min(1, { message: "User email is required." }),
      })
    )
    .query(async ({ input: { userEmail } }) => {
      return getQuota(userEmail);
    }),
});
