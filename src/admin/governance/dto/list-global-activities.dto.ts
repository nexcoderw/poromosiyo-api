import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  GOVERNANCE_DEFAULT_LIMIT,
  GOVERNANCE_DEFAULT_PAGE,
  GOVERNANCE_MAX_LIMIT,
} from '../admin-governance.constants';

export class ListGlobalActivitiesDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(64)
  resourceType?: string;

  @IsOptional()
  @IsUUID('4')
  resourceId?: string;

  @IsOptional()
  @IsUUID('4')
  actorUserId?: string;

  @IsOptional()
  @IsUUID('4')
  subjectUserId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
