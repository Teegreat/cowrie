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
      throw new Error(
        'ENCRYPTION_KEY myst be a 64-character hex string (32 bytes',
      );
    }
    if (!hashKey) {
      throw new Error('HASH_KEY must be set');
    }
    this.encryptionKey = Buffer.from(encryptionKeyHex, 'hex');
    this.hashKey = hashKey;
  }

  encrypt(plaintext: string): string {
    // A fresh random IV every call is mandatory for GCM — reusing one
    // with the same key breaks both confidentiality and integrity.
    // iv/authTag aren't secret, just need to travel with the ciphertext.
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf-8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext);
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    // GCM's authentication tag check: tampered ciphertext throws here
    // instead of silently decrypting to garbage.
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf-8');
  }

  hash(plaintext: string): string {
    return createHmac('sha256', this.hashKey).update(plaintext).digest('hex');
  }
}
