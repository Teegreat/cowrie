// Opaque on purpose: the application layer threads this through repository
// calls but never inspects it. Only infrastructure knows it's really a
// Prisma.TransactionClient — that cast lives in exactly one file.
export type TransactionContext = unknown;

export abstract class TransactionManager {
  abstract run<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
