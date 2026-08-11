import { Injectable } from '@nestjs/common';
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

@Injectable()
export class TokenHasherService {
  createToken(
    byteLength = 48,
  ): string {
    if (
      !Number.isInteger(byteLength) ||
      byteLength < 32
    ) {
      throw new Error(
        'Authentication token byte length must be at least 32.',
      );
    }

    return randomBytes(byteLength).toString(
      'base64url',
    );
  }

  hashToken(
    token: string,
  ): string {
    return createHash('sha256')
      .update(token, 'utf8')
      .digest('hex');
  }

  verifyToken(
    token: string,
    expectedHash: string,
  ): boolean {
    const actualHash =
      this.hashToken(token);

    const actualBuffer =
      Buffer.from(actualHash, 'hex');

    const expectedBuffer =
      Buffer.from(expectedHash, 'hex');

    if (
      actualBuffer.length !==
      expectedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      actualBuffer,
      expectedBuffer,
    );
  }
}
