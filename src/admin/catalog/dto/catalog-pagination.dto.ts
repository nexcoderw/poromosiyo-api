import {
  Type,
} from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  CATALOG_DEFAULT_LIMIT,
  CATALOG_DEFAULT_PAGE,
  CATALOG_MAX_LIMIT,
} from '../catalog.constants';

export class CatalogPaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number =
    CATALOG_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CATALOG_MAX_LIMIT)
  limit: number =
    CATALOG_DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
