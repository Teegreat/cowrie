export abstract class EncryptionService {
  abstract encrypt(plaintext: string): string;
  abstract decrypt(ciphertext: string): string;
  // Deterministic, keyed hash for uniqueness/lookup only — never
  // reversible. Necessary because BVN/NIN have low entropy; an unkeyed
  // hash would be brute-forceable, unlike Ch. 17's refresh token hash.
  abstract hash(plaintext: string): string;
}
