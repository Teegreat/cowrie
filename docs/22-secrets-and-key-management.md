# Chapter 22 — Secrets & Key Management

## Learning Objectives

- Implement real field-level encryption at rest for `Profile.bvn`/`nin`/
  `address` — deferred since Ch. 19.
- Understand why encrypting a unique column with a random-IV cipher
  (AES-GCM) silently breaks its uniqueness guarantee, and fix it with a
  separate deterministic hash.
- Understand why that hash must be keyed (HMAC), not a plain hash,
  because of BVN/NIN's low entropy.
- Confirm that encryption, done correctly, requires zero changes to the
  domain or application layers — only the repository.

## Key Concepts

**The subtlety naive encryption gets wrong**
- AES-GCM requires a fresh random IV per encryption (reusing one with
  the same key is a real cryptographic failure). This means encrypting
  the same BVN twice produces different ciphertext — so a `@unique`
  constraint directly on the encrypted column stops working; two users
  could submit the identical real BVN without colliding.
- Fix: store the encrypted value (for retrieval) *and* a separate
  deterministic, keyed hash (`bvnHash`/`ninHash`, HMAC-SHA256) for
  uniqueness/lookup — never decrypted, never exposed.

**Why the hash must be keyed, not plain**
- Ch. 17's refresh token hash safely used plain SHA-256 because a
  refresh token has 256 bits of entropy — nothing to brute-force. A
  BVN/NIN is only 11 digits; an unkeyed hash of it is brute-forceable in
  seconds. HMAC with a secret key (`HASH_KEY`, separate from
  `ENCRYPTION_KEY`) makes that infeasible without the key too.

**GCM's authentication tag**
- Unlike CBC, GCM is authenticated encryption: tampering with the
  ciphertext makes decryption throw (via `setAuthTag`/`getAuthTag`)
  instead of silently returning corrupted plaintext.

**Encryption lives entirely in the repository**
- `Bvn`, `Nin`, `Profile`, `CreateProfileUseCase`, the sanctions
  screening logic (Ch. 20), and `RevealBvnUseCase` (Ch. 21) are
  completely unchanged. They only ever see plaintext, encrypted/
  decrypted transparently at the repository boundary — the actual
  payoff of Ch. 6's Dependency Rule, three chapters later.

**Key management: real now, deferred later**
- `ENCRYPTION_KEY`/`HASH_KEY` in `.env` is the same honest limitation as
  `JWT_SECRET` since Ch. 17. A mature system pulls these from a KMS
  (AWS KMS, GCP Secret Manager, HashiCorp Vault) with rotation and
  access auditing — deferred to the deployment chapters (Ch. 42+),
  consistent with every other external dependency mocked first in this
  course.

## Setup

```bash
openssl rand -hex 32   # ENCRYPTION_KEY
openssl rand -hex 32   # HASH_KEY
```
`.env`:
```
ENCRYPTION_KEY="<generated>"
HASH_KEY="<generated>"
```

## Schema

```prisma
model Profile {
  userId          String          @id
  user            User            @relation(fields: [userId], references: [id])
  firstName       String
  middleName      String?
  lastName        String
  phoneNumber     String          @unique
  dateOfBirth     DateTime
  kycTier         KycTier         @default(TIER_1)
  bvn             String
  bvnHash         String          @unique
  nin             String?
  ninHash         String?         @unique
  address         String?
  riskScore       Int
  screeningStatus ScreeningStatus @default(CLEARED)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```
Existing test rows held plaintext under the old `bvn @unique` — cleared
before migrating (disposable dev data; a real migration would backfill/
re-encrypt existing rows instead of wiping them):
```sql
DELETE FROM "Profile";
```
```bash
npx prisma migrate dev --name encrypt_profile_pii
```

## File Changes

```
src/identity/application/ports/encryption-service.port.ts   (new)
src/infrastructure/encryption/aes-encryption.service.ts     (new — top-level, reusable)
src/identity/infrastructure/persistence/prisma-profile.repository.ts (updated)
src/identity/identity.module.ts (bind EncryptionService -> AesEncryptionService)
```

### `src/identity/application/ports/encryption-service.port.ts`

```ts
export abstract class EncryptionService {
  abstract encrypt(plaintext: string): string;
  abstract decrypt(ciphertext: string): string;
  abstract hash(plaintext: string): string;
}
```

### `src/infrastructure/encryption/aes-encryption.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'crypto';
import { EncryptionService } from 'src/identity/application/ports/encryption-service.port';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

@Injectable()
export class AesEncryptionService extends EncryptionService {
  private readonly encryptionKey: Buffer;
  private readonly hashKey: string;

  constructor() {
    super();
    const encryptionKeyHex = process.env.ENCRYPTION_KEY;
    const hashKey = process.env.HASH_KEY;
    if (!encryptionKeyHex || encryptionKeyHex.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    if (!hashKey) {
      throw new Error('HASH_KEY must be set');
    }
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
    this.hashKey = hashKey;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  hash(plaintext: string): string {
    return createHmac('sha256', this.hashKey).update(plaintext).digest('hex');
  }
}
```

### `src/identity/infrastructure/persistence/prisma-profile.repository.ts`

```ts
import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { ProfileRepository } from 'src/identity/application/ports/profile-repository.port';
import { EncryptionService } from 'src/identity/application/ports/encryption-service.port';
import { Profile } from 'src/identity/domain/profile';
import { PrismaService } from 'src/infrastructure/prisma/prisma.service';
import { DomainException } from 'src/shared-kernel/domain-exception';

@Injectable()
export class PrismaProfileRepository extends ProfileRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    super();
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const record = await this.prisma.profile.findUnique({ where: { userId } });
    if (!record) return null;
    return Profile.existing({
      ...record,
      bvn: this.encryptionService.decrypt(record.bvn),
      nin: record.nin ? this.encryptionService.decrypt(record.nin) : null,
      address: record.address ? this.encryptionService.decrypt(record.address) : null,
    });
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
          bvn: this.encryptionService.encrypt(profile.bvn.value),
          bvnHash: this.encryptionService.hash(profile.bvn.value),
          riskScore: profile.riskScore,
          screeningStatus: profile.screeningStatus,
        },
      });
      return Profile.existing({
        ...created,
        bvn: profile.bvn.value,
        nin: null,
        address: null,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
          nin: profile.nin ? this.encryptionService.encrypt(profile.nin.value) : null,
          ninHash: profile.nin ? this.encryptionService.hash(profile.nin.value) : null,
          address: profile.address ? this.encryptionService.encrypt(profile.address) : null,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException('This BVN or NIN is already linked to another account');
      }
      throw error;
    }
  }
}
```

Register `{ provide: EncryptionService, useClass: AesEncryptionService }`
in `identity.module.ts`.

## Business Rules

- `bvn`, `nin`, and `address` are always stored encrypted (AES-256-GCM),
  never as plaintext.
- Uniqueness for BVN/NIN is enforced via `bvnHash`/`ninHash` (HMAC-SHA256),
  never via the encrypted column itself.
- `ENCRYPTION_KEY` and `HASH_KEY` are distinct secrets, never reused for
  both purposes.

## Definition of Done

- [ ] `EncryptionService` port + `AesEncryptionService` adapter
      (AES-256-GCM + HMAC-SHA256) implemented.
- [ ] `bvn`/`nin`/`address` encrypted at rest; `bvnHash`/`ninHash` carry
      the unique constraints instead.
- [ ] Verified: raw DB values are unreadable ciphertext/hash; masked
      profile view still works; Ch. 21's BVN reveal still works
      unchanged; duplicate-BVN rejection still works; tier 2/3 NIN and
      address round-trip correctly.

## Common Interview Questions

- Why does encrypting a column with AES-GCM break a naive uniqueness
  constraint on that column, and how do you fix it?
- Why does BVN/NIN need a keyed hash (HMAC) while a refresh token was
  fine with plain SHA-256?
- What does GCM's authentication tag protect against that CBC mode
  doesn't?
- Why should the encryption key and the hash key be different secrets?

## Further Reading (optional)

- Node.js `crypto` module documentation: `createCipheriv`/`createDecipheriv`,
  AES-GCM authentication tags.
- OWASP Cryptographic Storage Cheat Sheet.
