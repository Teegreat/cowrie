export interface PublicUserProfile {
  id: string;
  email: string;
}

export class User {
  private constructor(
    readonly id: string | undefined,
    readonly email: string,
    readonly hashedPassword: string,
  ) {}

  static register(email: string, hashedPassword: string): User {
    return new User(undefined, User.normalizeEmail(email), hashedPassword);
  }

  static existing(id: string, email: string, hashedPassword: string): User {
    return new User(id, email, hashedPassword);
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  toPublicProfile(): PublicUserProfile {
    // The only sanctioned way to expose a User outward. Centralizing
    // this here — instead of trusting every call site to manually pick
    // safe fields — means hashedPassword can't leak through a future
    // careless `return user`.
    return { id: this.id!, email: this.email };
  }
}
