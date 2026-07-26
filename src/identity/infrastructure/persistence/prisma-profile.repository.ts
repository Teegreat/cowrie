import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { ProfileRepository } from 'src/identity/application/ports/profile-repository.port';
import { Profile } from 'src/identity/domain/profile';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class PrismaProfileRepository extends ProfileRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const record = await this.prisma.profile.findUnique({ where: { userId } });
    if (!record) return null;
    return Profile.existing(record);
  }

  async create(profile: Profile): Promise<Profile> {
    try {
      const created = await this.prisma.profile.create({
        data: {
          userId: profile.userId,
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          phoneNumber: profile.phoneNumber,
          dateOfBirth: profile.dateOfBirth,
          kycTier: profile.kycTier,
          bvn: profile.bvn.value,
          riskScore: profile.riskScore,
          screeningStatus: profile.screeningStatus,
        },
      });
      return Profile.existing(created);
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

  async update(profile: Profile): Promise<Profile> {
    try {
      const updated = await this.prisma.profile.update({
        where: { userId: profile.userId },
        data: {
          kycTier: profile.kycTier,
          nin: profile.nin?.value ?? null,
          address: profile.address,
          screeningStatus: profile.screeningStatus,
        },
      });
      return Profile.existing(updated);
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
