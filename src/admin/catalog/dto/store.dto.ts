import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

import {
  CATALOG_DESCRIPTION_MAX_LENGTH,
  CATALOG_SLUG_MAX_LENGTH,
  CATALOG_SLUG_PATTERN,
  STORE_NAME_MAX_LENGTH,
} from '../catalog.constants';
import { CatalogPaginationDto } from './catalog-pagination.dto';

export class CreateStoreDto {
  @IsString()
  @MinLength(2)
  @MaxLength(STORE_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  slug?: string;

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
  logo?: string;

  @IsOptional()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(2048)
  website?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateStoreDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(STORE_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  slug?: string;

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
  logo?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  @MaxLength(2048)
  website?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListStoresDto extends CatalogPaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;
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
