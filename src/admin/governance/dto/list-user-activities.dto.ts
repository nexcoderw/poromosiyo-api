import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  GOVERNANCE_DEFAULT_LIMIT,
  GOVERNANCE_DEFAULT_PAGE,
  GOVERNANCE_MAX_LIMIT,
} from '../admin-governance.constants';

export class ListUserActivitiesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = GOVERNANCE_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(GOVERNANCE_MAX_LIMIT)
  limit: number = GOVERNANCE_DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;
}
