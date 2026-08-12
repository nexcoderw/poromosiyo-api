export const IMAGE_UPLOAD_FIELD =
  'image';

export const IMAGE_UPLOAD_MAX_BYTES =
  12 * 1024 * 1024;

export const IMAGE_OUTPUT_MAX_BYTES =
  500 * 1024;

export const IMAGE_MAX_DIMENSION =
  1600;

export const CATALOG_IMAGE_OUTPUT_MAX_BYTES =
  350 * 1024;

export const CATALOG_IMAGE_MAX_DIMENSION =
  1200;

export const LOGO_IMAGE_OUTPUT_MAX_BYTES =
  220 * 1024;

export const LOGO_IMAGE_MAX_DIMENSION =
  800;

export const IMAGE_WEBP_QUALITY =
  80;

export const PRODUCT_IMAGE_LIMIT =
  10;

export const IMAGE_CACHE_CONTROL =
  'public, max-age=31536000, s-maxage=31536000, immutable';

export const ACCEPTED_IMAGE_MIME_TYPES =
  new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]);
