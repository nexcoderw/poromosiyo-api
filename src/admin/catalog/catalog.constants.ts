export const CATALOG_DEFAULT_PAGE = 1;
export const CATALOG_DEFAULT_LIMIT = 20;
export const CATALOG_MAX_LIMIT = 100;

export const CATEGORY_NAME_MAX_LENGTH = 120;
export const BRAND_NAME_MAX_LENGTH = 120;
export const STORE_NAME_MAX_LENGTH = 160;
export const PRODUCT_NAME_MAX_LENGTH = 255;

export const CATALOG_SLUG_MAX_LENGTH = 191;
export const PRODUCT_SKU_MAX_LENGTH = 64;

export const PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH = 500;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 10_000;

export const PRODUCT_IMAGE_URL_MAX_LENGTH = 2048;
export const PRODUCT_IMAGE_ALT_MAX_LENGTH = 255;

export const CATALOG_DESCRIPTION_MAX_LENGTH = 10_000;

export const CATALOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const PRODUCT_SKU_PATTERN = /^[A-Za-z0-9._-]{2,64}$/;

export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;

export type CatalogProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_EXPIRATION_STATUSES = [
  'VALID',
  'EXPIRED',
  'EXPIRING_SOON',
] as const;

export type CatalogProductExpirationStatus =
  (typeof PRODUCT_EXPIRATION_STATUSES)[number];
