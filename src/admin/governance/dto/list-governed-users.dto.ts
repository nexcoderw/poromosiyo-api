import {
  Transform,
  Type,
} from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  GOVERNANCE_ACCOUNT_STATUSES,
  GOVERNANCE_DEFAULT_LIMIT,
  GOVERNANCE_DEFAULT_PAGE,
  GOVERNANCE_MAX_LIMIT,
  type GovernanceAccountStatus,
} from '../admin-governance.constants';

export class ListGovernedUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number =
    GOVERNANCE_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(GOVERNANCE_MAX_LIMIT)
  limit: number =
    GOVERNANCE_DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(
    GOVERNANCE_ACCOUNT_STATUSES,
  )
  status?:
    GovernanceAccountStatus;

  @IsOptional()
  @Transform(
    ({ value }) =>
      parseOptionalBoolean(
        value,
      ),
  )
  @IsBoolean()
  emailVerified?: boolean;
}

function parseOptionalBoolean(
  value: unknown,
): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}
