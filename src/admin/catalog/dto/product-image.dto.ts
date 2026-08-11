import {
  Type,
} from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  PRODUCT_IMAGE_ALT_MAX_LENGTH,
  PRODUCT_IMAGE_URL_MAX_LENGTH,
} from '../catalog.constants';

export class CreateProductImageDto {
  @IsUrl({
    protocols: [
      'http',
      'https',
    ],
    require_protocol: true,
  })
  @MaxLength(PRODUCT_IMAGE_URL_MAX_LENGTH)
  url!: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCT_IMAGE_ALT_MAX_LENGTH)
  altText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateProductImageDto {
  @IsOptional()
  @IsUrl({
    protocols: [
      'http',
      'https',
    ],
    require_protocol: true,
  })
  @MaxLength(PRODUCT_IMAGE_URL_MAX_LENGTH)
  url?: string;

  @IsOptional()
  @ValidateIf(
    (_object, value) =>
      value !== null,
  )
  @IsString()
  @MaxLength(PRODUCT_IMAGE_ALT_MAX_LENGTH)
  altText?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
