import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  GOOGLE_API_KEY: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_NOTIFICATION_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  NEXT_PUBLIC_NOTIFICATION_PAGE_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5_000),
});

export type ServerConfig = z.infer<typeof serverSchema>;
export type ClientConfig = z.infer<typeof clientSchema>;
export type Config = ServerConfig & ClientConfig;

function parse<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown>
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    console.error(
      "Invalid environment configuration:",
      result.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment configuration");
  }
  return result.data;
}

// NEXT_PUBLIC_* vars must be read as literal property accesses so Next.js
// inlines them at build time for the client bundle.
const clientSource = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_NOTIFICATION_POLL_MS:
    process.env.NEXT_PUBLIC_NOTIFICATION_POLL_MS,
  NEXT_PUBLIC_NOTIFICATION_PAGE_POLL_MS:
    process.env.NEXT_PUBLIC_NOTIFICATION_PAGE_POLL_MS,
};

export const clientConfig: ClientConfig = parse(clientSchema, clientSource);

export const serverConfig: ServerConfig =
  typeof window === "undefined"
    ? parse(serverSchema, process.env)
    : new Proxy({} as ServerConfig, {
        get(_target, key) {
          throw new Error(
            `serverConfig.${String(key)} was read on the client; move this code to a server module.`
          );
        },
      });
