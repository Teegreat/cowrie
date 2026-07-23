export abstract class RefreshTokenRepository {
  abstract store(input: {
    userId: string;
    hashedToken: string;
    expiresAt: Date;
  }): Promise<void>;
  abstract consumeValidToken(
    hashedToken: string,
  ): Promise<{ userId: string } | null>;
  abstract revokeByHashedToken(hashedToken: string): Promise<void>;
  abstract replaceAllForUser(input: {
    userId: string;
    hashedToken: string;
    expiresAt: Date;
  }): Promise<void>;
}
