import { PrismaClient } from "@prisma/client";

function makePrismaClient() {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          let attempts = 0;
          const maxAttempts = 5;
          while (attempts < maxAttempts) {
            try {
              return await query(args);
            } catch (error: unknown) {
              attempts++;
              const err = error as { code?: string; message?: string };
              const isTransient =
                err?.code === "P1001" || // Can't reach database server (Neon cold-start)
                err?.code === "P1002" || // Database server was reached but timed out
                err?.code === "P1008" || // Operations timed out
                err?.code === "P1017" || // Server closed the connection
                err?.message?.includes("Can't reach database server") ||
                err?.message?.includes("connection closed") ||
                err?.message?.includes("Connection terminated") ||
                err?.message?.includes("Connection reset") ||
                err?.message?.includes("connection pool") ||
                err?.message?.includes("Timed out fetching") ||
                err?.message?.includes("closed unexpectedly");

              if (isTransient && attempts < maxAttempts) {
                const delayMs = Math.min(800 * attempts, 4000);
                console.warn(
                  `[Prisma Auto-Retry] Transient Neon connection event on ${model}.${operation} (${err.code || "timeout"}). Retrying attempt ${attempts}/${maxAttempts} in ${delayMs}ms...`,
                );
                await new Promise((r) => setTimeout(r, delayMs));
              } else {
                throw error;
              }
            }
          }
        },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof makePrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedPrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? makePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
