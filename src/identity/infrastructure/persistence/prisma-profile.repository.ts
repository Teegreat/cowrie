import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { EncryptionService } from 'src/identity/application/ports/encryption-service.port';
import { ProfileRepository } from 'src/identity/application/ports/profile-repository.port';
import { Profile } from 'src/identity/domain/profile';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';
import { TransactionContext } from 'src/common/transaction/transaction-manager.port';

@Injectable()
export class PrismaProfileRepository extends ProfileRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    super();
  }

  private client(ctx?: TransactionContext) {
    return (ctx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const record = await this.prisma.profile.findUnique({ where: { userId } });
    if (!record) return null;
    return Profile.existing({
      ...record,
      bvn: this.encryptionService.decrypt(record.bvn),
      nin: record.nin ? this.encryptionService.decrypt(record.nin) : null,
      address: record.address
        ? this.encryptionService.decrypt(record.address)
        : null,
    });
  }

  async create(profile: Profile, ctx?: TransactionContext): Promise<Profile> {
    try {
      const created = await this.client(ctx).profile.create({
        data: {
          userId: profile.userId,
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          phoneNumber: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
          kycTier: profile.kycTier,
          bvn: this.encryptionService.encrypt(profile.bvn.value),
          bvnHash: this.encryptionService.hash(profile.bvn.value),
          riskScore: profile.riskScore,
          screeningStatus: profile.screeningStatus,
        },
      });
      return Profile.existing({
        ...created,
        bvn: profile.bvn.value, // already have the plaintext — no need to decrypt what we just encrypted
        nin: null,
        address: null,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'This phone number or BVN is already in use, or a profile already exists for this account',
        );
      }
      throw error;
    }
  }

  async update(profile: Profile, ctx?: TransactionContext): Promise<Profile> {
    try {
      const updated = await this.client(ctx).profile.update({
        where: { userId: profile.userId },
        data: {
          kycTier: profile.kycTier,
          nin: profile.nin
            ? this.encryptionService.encrypt(profile.nin.value)
            : null,
          ninHash: profile.nin
            ? this.encryptionService.hash(profile.nin.value)
            : null,
          address: profile.address
            ? this.encryptionService.encrypt(profile.address)
            : null,
          screeningStatus: profile.screeningStatus,
        },
      });
      return Profile.existing({
        ...updated,
        bvn: profile.bvn.value,
        nin: profile.nin?.value ?? null,
        address: profile.address,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new DomainException(
          'This BVN or NIN is already linked to another account',
        );
      }
      throw error;
    }
  }
}
