import { BadRequestException } from '@nestjs/common';

import { MONEY_PATTERN } from '../catalog.constants';

export function normalizeMoney(value: string): string {
  const trimmed = value.trim();

  if (!MONEY_PATTERN.test(trimmed)) {
    throw new BadRequestException(
      'Price must contain no more than 10 integer digits and 2 decimal places.',
    );
  }

  const minor = moneyToMinorUnits(trimmed);

  const whole = minor / 100n;

  const fraction = (minor % 100n).toString().padStart(2, '0');

  return `${whole}.${fraction}`;
}

export function assertDiscountedPrice(
  originalPrice: string,
  sellingPrice: string,
): void {
  const original = moneyToMinorUnits(originalPrice);

  const selling = moneyToMinorUnits(sellingPrice);

  if (original <= 0n) {
    throw new BadRequestException('Original price must be greater than zero.');
  }

  if (selling <= 0n) {
    throw new BadRequestException('Selling price must be greater than zero.');
  }

  if (selling >= original) {
    throw new BadRequestException(
      'Selling price must be lower than original price.',
    );
  }
}

export function calculateDiscountPercentage(
  originalPrice: string,
  sellingPrice: string,
): string {
  const original = moneyToMinorUnits(originalPrice);

  const selling = moneyToMinorUnits(sellingPrice);

  const difference = original - selling;

  const basisPoints = (difference * 10_000n + original / 2n) / original;

  const whole = basisPoints / 100n;

  const fraction = (basisPoints % 100n).toString().padStart(2, '0');

  return `${whole}.${fraction}`;
}

function moneyToMinorUnits(value: string): bigint {
  const normalized = value.trim();

  if (!MONEY_PATTERN.test(normalized)) {
    throw new BadRequestException('Invalid price format.');
  }

  const [whole, fraction = ''] = normalized.split('.');

  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
