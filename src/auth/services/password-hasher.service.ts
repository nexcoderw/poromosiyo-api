import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.HashOptions & {
  raw?: false;
} = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordHasherService {
  private readonly dummyHashPromise = argon2.hash(
    'Poromosiyo-authentication-dummy-password',
    ARGON2_OPTIONS,
  );

  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    return argon2.verify(passwordHash, password);
  }

  async verifyOrDummy(
    passwordHash: string | null,
    password: string,
  ): Promise<boolean> {
    if (passwordHash) {
      return this.verify(passwordHash, password);
    }

    const dummyHash = await this.dummyHashPromise;

    await this.verify(dummyHash, password);

    return false;
  }
}
