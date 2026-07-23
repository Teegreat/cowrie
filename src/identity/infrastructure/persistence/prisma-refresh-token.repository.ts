import { Injectable } from '@nestjs/common';
import { RefreshTokenRepository } from 'src/identity/application/ports/refresh-token-repository.port';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';

@Injectable()
export class PrismaRefreshTokenRepository extends RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async store(input: {
    userId: string;
    hashedToken: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.refreshToken.create({ data: input });
  }

  async consumeValidToken(
    hashedToken: string,
  ): Promise<{ userId: string } | null> {
    // DELETE ... RETURNING is atomic: only one concurrent caller can
    // ever successfully delete a given row. A second, simultaneous
    // attempt with the same token finds nothing left to delete and
    // safely returns empty, rather than racing to both succeed.
    const rows = await this.prisma.$queryRaw<
      { userId: string; expiresAt: Date }[]
    >`
      DELETE FROM "RefreshToken" WHERE "hashedToken" = ${hashedToken} RETURNING "userId", "expiresAt"
    `;
    const deleted = rows[0];
    if (!deleted || deleted.expiresAt < new Date()) {
      return null;
    }
    return { userId: deleted.userId };
  }

  async revokeByHashedToken(hashedToken: string): Promise<void> {
    // deleteMany, not delete — idempotent, so revoking an
    // already-revoked or nonexistent token never throws.
    await this.prisma.refreshToken.deleteMany({ where: { hashedToken } });
  }

  async replaceAllForUser(input: {
    userId: string;
    hashedToken: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Lock the user row as a mutex — same technique as Ch. 16's
      // insufficient-balance check — so two concurrent logins for the
      // same user can never both leave a surviving session behind.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;

      await tx.refreshToken.deleteMany({ where: { userId: input.userId } });
      await tx.refreshToken.create({
        data: {
          userId: input.userId,
          hashedToken: input.hashedToken,
          expiresAt: input.expiresAt,
        },
      });
    });
  }
}
