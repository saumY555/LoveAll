import dns from "node:dns";
import { PrismaClient } from "@prisma/client";

// Prefer IPv4 across all networks/ISPs to prevent hanging on broken IPv6 routes
try {
  dns.setDefaultResultOrder("ipv4first");
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

  const origLookup = dns.lookup;
  dns.lookup = function (
    hostname: string,
    options: any,
    callback: (err: NodeJS.ErrnoException | null, address: any, family?: any) => void
  ) {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    origLookup(hostname, options, (err, address, family) => {
      if (err && hostname.includes("neon.tech")) {
        dns.resolve4(hostname, (rErr, addrs) => {
          if (!rErr && addrs && addrs.length > 0) {
            return callback(null, addrs[0], 4);
          }
          return callback(err, address, family);
        });
      } else {
        return callback(err, address, family);
      }
    });
  } as typeof dns.lookup;
} catch {
  // Ignored in environments where setServers or setDefaultResultOrder is restricted
}

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
