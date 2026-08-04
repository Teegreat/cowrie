import { Injectable, Logger } from '@nestjs/common';
import { ProfileRepository } from '../ports/profile-repository.port';
import { Profile, PublicProfile } from 'src/identity/domain/profile';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { SanctionsScreeningGateway } from '../ports/sanctions-screening-gateway.port';
import { ComplianceCaseRepository } from '../ports/compliance-case-repository.port';
import { TransactionManager } from 'src/common/transaction/transaction-manager.port';
import { AuditLogRepository } from 'src/audit/application/ports/audit-log-repository.port';
import { AuditLog } from 'src/audit/domain/audit-log';
import { CreateWalletUseCase } from 'src/wallet/application/use-cases/create-wallet.use-case';
import { CreateVirtualAccountUseCase } from 'src/wallet/application/use-cases/create-virtual-account.use-case';

@Injectable()
export class CreateProfileUseCase {
  private readonly logger = new Logger(CreateProfileUseCase.name);
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly screeningGateway: SanctionsScreeningGateway,
    private readonly complianceCaseRepository: ComplianceCaseRepository,
    private readonly transactionManager: TransactionManager,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly createVirtualAccountUseCase: CreateVirtualAccountUseCase,
  ) {}

  async execute(input: {
    userId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    phoneNumber: string;
    dateOfBirth: Date;
    bvn: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<PublicProfile> {
    const existing = await this.profileRepository.findByUserId(input.userId);
    if (existing) {
      throw new DomainException('Profile already exists for this account');
    }
    const screening = await this.screeningGateway.screen({
      firstName: input.firstName,
      middleName: input.middleName ?? null,
      lastName: input.lastName,
      dateOfBirth: input.dateOfBirth,
    });

    const profile = Profile.create({
      ...input,
      riskScore: screening.riskScore,
      watchlistHits: screening.watchlistHits,
    });

    const { profile: created, walletId } = await this.transactionManager.run(
      async (ctx) => {
        const created = await this.profileRepository.create(profile, ctx);

        if (created.screeningStatus !== 'CLEARED') {
          await this.complianceCaseRepository.create(
            {
              userId: created.userId,
              riskScore: screening.riskScore,
              watchlistHits: screening.watchlistHits,
            },
            ctx,
          );
        }

        let walletId: string | null = null;

        // A confirmed sanctions hit (BLOCKED) withholds wallet creation
        // entirely. CLEARED and FLAGGED (pending manual review) both still
        // get a wallet — matching how Kuda/Moniepoint/OPay provision a Naira
        // wallet automatically the moment BVN-based Tier 1 KYC completes.

        if (created.screeningStatus !== 'BLOCKED') {
          const wallet = await this.createWalletUseCase.execute(
            created.userId,
            ctx,
          );
          walletId = wallet.id ?? null;
          await this.auditLogRepository.create(
            AuditLog.record({
              actorUserId: input.userId,
              actorEmail: null,
              action: 'WALLET_CREATED',
              targetType: 'Wallet',
              targetId: wallet.id,
              ipAddress: input.ipAddress,
              userAgent: input.userAgent,
            }),
            ctx,
          );
        }

        await this.auditLogRepository.create(
          AuditLog.record({
            actorUserId: input.userId,
            actorEmail: null,
            action: 'PROFILE_CREATED',
            targetType: 'Profile',
            targetId: created.userId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          }),
          ctx,
        );

        return { profile: created, walletId };
      },
    );

    // Deliberately outside the transaction — an external call that can
    // fail independently of whether the profile/wallet were created.
    if (walletId) {
      try {
        await this.createVirtualAccountUseCase.execute(
          walletId,
          created.userId,
          created.fullName,
          input.ipAddress,
          input.userAgent,
        );
      } catch (error) {
        // The wallet still works for in-app operations without a NUBAN
        // — only inbound external bank transfers need one. Proper
        // retry-with-backoff belongs to Ch. 35 (BullMQ); for now this
        // is surfaced via the manual retry endpoint below.
        this.logger.error(
          `Virtual account provisioning failed for wallet ${walletId}: ${error}`,
        );
      }
    }

    return created.toPublicProfile();
  }
}
