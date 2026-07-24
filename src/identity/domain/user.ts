export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface PublicUserProfile {
  id: string;
  email: string;
  role: UserRole;
}

export class User {
  private constructor(
    readonly id: string | undefined,
    readonly email: string,
    readonly hashedPassword: string,
    readonly role: UserRole,
  ) {}

  static register(email: string, hashedPassword: string): User {
    return new User(
      undefined,
      User.normalizeEmail(email),
      hashedPassword,
      'CUSTOMER',
    );
  }

  static existing(
    id: string,
    email: string,
    hashedPassword: string,
    role: UserRole,
  ): User {
    return new User(id, email, hashedPassword, role);
  }

  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  toPublicProfile(): PublicUserProfile {
    // The only sanctioned way to expose a User outward. Centralizing
    // this here — instead of trusting every call site to manually pick
    // safe fields — means hashedPassword can't leak through a future
    // careless `return user`.
    return { id: this.id!, email: this.email, role: this.role };
  }
}
