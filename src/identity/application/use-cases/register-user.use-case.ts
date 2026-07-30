import { Injectable } from '@nestjs/common';
import { UserRepository } from '../ports/user-repository.port';
import { PasswordHasher } from '../ports/password-hasher.port';
import { User } from 'src/identity/domain/user';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';

@Injectable()
export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  async execute(input: {
    email: string;
    password: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<{ id: string; email: string }> {
    const normalizedEmail = User.normalizeEmail(input.email);

    // A fast, friendly pre-check — not the real guarantee. See
    // PrismaUserRepository.create for why.
    const existing = await this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new DomainException('Email already registered');
    }

    const hashedPassword = await this.passwordHasher.hash(input.password);
    const user = User.register(normalizedEmail, hashedPassword);

    const created = await this.transactionManager.run(async (ctx) => {
      const created = await this.userRepository.create(user, ctx);
      await this.auditLogRepository.create(
        AuditLog.record({
          actorUserId: created.id ?? null,
          actorEmail: created.email,
          action: 'USER_REGISTERED',
          targetType: 'User',
          targetId: created.id,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        }),
        ctx,
      );
      return created;
    });

    return created.toPublicProfile();
  }
}
