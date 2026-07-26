import { DomainException } from 'src/shared-kernel/domain-exception';

export type KycTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

export type ScreeningStatus = 'CLEARED' | 'FLAGGED' | 'BLOCKED';

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
  riskScore: number;
  screeningStatus: ScreeningStatus;
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
    readonly riskScore: number,
    readonly screeningStatus: ScreeningStatus,
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
    riskScore: number;
    watchlistHits: string[];
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
      input.riskScore,
      Profile.resolveScreeningStatus(input.riskScore, input.watchlistHits),
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
    riskScore: number;
    screeningStatus: ScreeningStatus;
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
      input.riskScore,
      input.screeningStatus,
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
      this.riskScore,
      this.screeningStatus,
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
      this.riskScore,
      this.screeningStatus,
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
      riskScore: this.riskScore,
      screeningStatus: this.screeningStatus,
    };
  }

  private static resolveScreeningStatus(
    riskScore: number,
    watchlistHits: string[],
  ): ScreeningStatus {
    // The CBN's 2024 PEP Screening Guidelines: a direct watchlist hit
    // blocks outright; otherwise a risk score below 70/100 flags for
    // manual review rather than blocking automatically.
    if (watchlistHits.length > 0) return 'BLOCKED';
    if (riskScore < 70) return 'FLAGGED';
    return 'CLEARED';
  }

  clearScreening(): Profile {
    return new Profile(
      this.userId,
      this.firstName,
      this.middleName,
      this.lastName,
      this.phoneNumber,
      this.dateOfBirth,
      this.kycTier,
      this.bvn,
      this.nin,
      this.address,
      this.riskScore,
      'CLEARED',
    );
  }

  confirmBlock(): Profile {
    return new Profile(
      this.userId,
      this.firstName,
      this.middleName,
      this.lastName,
      this.phoneNumber,
      this.dateOfBirth,
      this.kycTier,
      this.bvn,
      this.nin,
      this.address,
      this.riskScore,
      'BLOCKED',
    );
  }
}
