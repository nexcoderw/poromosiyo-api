import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  CATALOG_SLUG_MAX_LENGTH,
  CATALOG_SLUG_PATTERN,
  CURRENCY_PATTERN,
  MONEY_PATTERN,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_EXPIRATION_STATUSES,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
  PRODUCT_SKU_PATTERN,
  PRODUCT_STATUSES,
  type CatalogProductExpirationStatus,
  type CatalogProductStatus,
} from '../catalog.constants';
import { CatalogPaginationDto } from './catalog-pagination.dto';

export class CreateProductDto {
  @IsUUID('4')
  storeId!: string;

  @IsUUID('4')
  categoryId!: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  slug?: string;

  @IsString()
  @MaxLength(PRODUCT_SKU_MAX_LENGTH)
  @Matches(PRODUCT_SKU_PATTERN)
  sku!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH)
  shortDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  originalPrice!: string;

  @IsString()
  @Matches(MONEY_PATTERN)
  sellingPrice!: string;

  @IsDateString({
    strict: true,
  })
  expiresAt!: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class UpdateProductDto {
  @IsOptional()
  @IsUUID('4')
  storeId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  brandId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(PRODUCT_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_SKU_MAX_LENGTH)
  @Matches(PRODUCT_SKU_PATTERN)
  sku?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(PRODUCT_SHORT_DESCRIPTION_MAX_LENGTH)
  shortDescription?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(PRODUCT_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  originalPrice?: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  sellingPrice?: string;

  @IsOptional()
  @IsDateString({
    strict: true,
  })
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;
}

export class ListProductsDto extends CatalogPaginationDto {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: CatalogProductStatus;

  @IsOptional()
  @IsIn(PRODUCT_EXPIRATION_STATUSES)
  expirationStatus?: CatalogProductExpirationStatus;

  @IsOptional()
  @IsUUID('4')
  storeId?: string;

  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @IsOptional()
  @IsUUID('4')
  brandId?: string;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  isFeatured?: boolean;
}

function parseOptionalBoolean(value: unknown): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}
