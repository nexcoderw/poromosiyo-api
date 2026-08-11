import {
  BadRequestException,
} from '@nestjs/common';

import {
  CATALOG_SLUG_MAX_LENGTH,
  CATALOG_SLUG_PATTERN,
} from '../catalog.constants';

export function normalizeCatalogSlug(
  value: string,
): string {
  const slug =
    value
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .trim()
      .replace(/&/g, ' and ')
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      )
      .slice(
        0,
        CATALOG_SLUG_MAX_LENGTH,
      )
      .replace(
        /-+$/g,
        '',
      );

  if (
    !slug ||
    !CATALOG_SLUG_PATTERN.test(
      slug,
    )
  ) {
    throw new BadRequestException(
      'Unable to create a valid slug from the supplied value.',
    );
  }

  return slug;
}
