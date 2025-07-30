import { createTRPCRouter, baseProcedure } from "@/trpc/init";
import z from "zod";
import { transcribeNextN } from ".";

export const transcriptRouter = createTRPCRouter({
  transcriptNextN: baseProcedure
    .input(
      z.object({
        batchSize: z.number().min(1, { message: "Batch size is required." }),
        n: z.number().min(1, { message: "Number of videos is required." }),
      })
    )
    .mutation(async ({ input: { batchSize, n } }) => {
      return transcribeNextN(n, batchSize);
    }),
});
