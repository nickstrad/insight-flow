import { PrismaClient } from "@/generated/prisma";
import { serverConfig } from "@/lib/config";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (serverConfig.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
