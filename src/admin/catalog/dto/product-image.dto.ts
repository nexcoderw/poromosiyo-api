import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { PRODUCT_IMAGE_ALT_MAX_LENGTH } from '../catalog.constants';

export class CreateProductImageDto {
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
  @ValidateIf((_object, value) => value !== null)
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
