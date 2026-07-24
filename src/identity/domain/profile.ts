import { DomainException } from 'src/shared-kernel/domain-exception';

export type KycTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export class Bvn {
  private constructor(readonly value: string) {}

  static of(value: string): Bvn {
    if (!/^\d{11}$/.test(value)) {
      throw new DomainException('BVN must be exactly 11 digits');
    }
    return new Bvn(value);
  }

  masked(): string {
    return `•••••••${this.value.slice(-4)}`;
  }
}

export class Nin {
  private constructor(readonly value: string) {}

  static of(value: string): Nin {
    if (!/^\d{11}$/.test(value)) {
      throw new DomainException('NIN must be exactly 11 digits');
    }
    return new Nin(value);
  }

  masked(): string {
    return `•••••••${this.value.slice(-4)}`;
  }
}

export interface PublicProfile {
  userId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  phoneNumber: string;
  kycTier: KycTier;
  bvn: string;
  nin: string | null;
  address: string | null;
}

function calculateAge(dateOfBirth: Date): number {
  const diffMs = Date.now() - dateOfBirth.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

export class Profile {
  private constructor(
    readonly userId: string,
    readonly firstName: string,
    readonly middleName: string | null,
    readonly lastName: string,
    readonly phoneNumber: string,
    readonly dateOfBirth: Date,
    readonly kycTier: KycTier,
    readonly bvn: Bvn,
    readonly nin: Nin | null,
    readonly address: string | null,
  ) {}

  get fullName(): string {
    return [this.firstName, this.middleName, this.lastName]
      .filter(Boolean)
      .join(' ');
  }

  static create(input: {
    userId: string;
    firstName: string;
    middleName?: string | null;
    lastName: string;
    phoneNumber: string;
    dateOfBirth: Date;
    bvn: string;
  }): Profile {
    if (calculateAge(input.dateOfBirth) < 18) {
      throw new DomainException(
        'Must be at least 18 years old to open an account',
      );
    }
    return new Profile(
      input.userId,
      input.firstName,
      input.middleName ?? null,
      input.lastName,
      input.phoneNumber,
      input.dateOfBirth,
      'TIER_1',
      Bvn.of(input.bvn),
      null,
      null,
    );
  }

  static existing(input: {
    userId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    phoneNumber: string;
    dateOfBirth: Date;
    kycTier: KycTier;
    bvn: string;
    nin: string | null;
    address: string | null;
  }): Profile {
    return new Profile(
      input.userId,
      input.firstName,
      input.middleName,
      input.lastName,
      input.phoneNumber,
      input.dateOfBirth,
      input.kycTier,
      Bvn.of(input.bvn),
      input.nin ? Nin.of(input.nin) : null,
      input.address,
    );
  }

  upgradeToTier2(ninValue: string): Profile {
    if (this.kycTier !== 'TIER_1') {
      throw new DomainException('Only a Tier 1 profile can upgrade to Tier 2');
    }
    return new Profile(
      this.userId,
      this.firstName,
      this.middleName,
      this.lastName,
      this.phoneNumber,
      this.dateOfBirth,
      'TIER_2',
      this.bvn,
      Nin.of(ninValue),
      this.address,
    );
  }

  upgradeToTier3(address: string): Profile {
    if (this.kycTier !== 'TIER_2') {
      throw new DomainException('Only a Tier 2 profile can upgrade to Tier 3');
    }
    return new Profile(
      this.userId,
      this.firstName,
      this.middleName,
      this.lastName,
      this.phoneNumber,
      this.dateOfBirth,
      'TIER_3',
      this.bvn,
      this.nin,
      address,
    );
  }

  toPublicProfile(): PublicProfile {
    return {
      userId: this.userId,
      firstName: this.firstName,
      middleName: this.middleName,
      lastName: this.lastName,
      fullName: this.fullName,
      phoneNumber: this.phoneNumber,
      kycTier: this.kycTier,
      bvn: this.bvn.masked(),
      nin: this.nin ? this.nin.masked() : null,
      address: this.address,
    };
  }
}
