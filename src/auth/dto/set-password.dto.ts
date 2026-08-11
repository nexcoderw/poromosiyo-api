import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
} from '../auth.constants';

export class SetPasswordDto {
  @IsString()
  @MinLength(AUTH_PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_PASSWORD_MAX_LENGTH)
  newPassword!: string;

  @IsString()
  @MinLength(AUTH_PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_PASSWORD_MAX_LENGTH)
  confirmPassword!: string;
}
