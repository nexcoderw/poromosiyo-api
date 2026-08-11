import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  CATALOG_DESCRIPTION_MAX_LENGTH,
  CATALOG_SLUG_MAX_LENGTH,
  CATALOG_SLUG_PATTERN,
  CATEGORY_NAME_MAX_LENGTH,
} from '../catalog.constants';
import { CatalogPaginationDto } from './catalog-pagination.dto';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(2048)
  image?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(CATEGORY_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4')
  parentId?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(CATALOG_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(2048)
  image?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class ListCategoriesDto extends CatalogPaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4')
  parentId?: string;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  rootOnly?: boolean;
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
