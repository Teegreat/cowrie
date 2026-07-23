import { Injectable } from '@nestjs/common';
import { PasswordHasher } from 'src/identity/application/ports/password-hasher.port';
import * as argon2 from 'argon2';

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  hash(plain: string): Promise<string> {
    return argon2.hash(plain);
  }

  verify(plain: string, hashed: string): Promise<boolean> {
    return argon2.verify(hashed, plain);
  }
}
