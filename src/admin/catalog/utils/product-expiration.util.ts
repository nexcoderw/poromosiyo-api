import { BadRequestException } from '@nestjs/common';

export const PRODUCT_EXPIRING_SOON_DAYS = 7;

export function parseFutureProductExpiration(
  value: string,
  now = new Date(),
): Date {
  const expiresAt = new Date(value);

  if (Number.isNaN(expiresAt.getTime())) {
    throw new BadRequestException('Product expiration date is invalid.');
  }

  if (expiresAt.getTime() <= now.getTime()) {
    throw new BadRequestException(
      'Product expiration date must be in the future.',
    );
  }

  return expiresAt;
}

export function isProductExpired(
  expiresAt: Date | null,
  now = new Date(),
): boolean {
  return !expiresAt || expiresAt.getTime() <= now.getTime();
}

export function getExpiringSoonBoundary(now = new Date()): Date {
  return new Date(
    now.getTime() + PRODUCT_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000,
  );
}
