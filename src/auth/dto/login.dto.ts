import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

import {
  AUTH_PASSWORD_MAX_LENGTH,
  AUTH_PASSWORD_MIN_LENGTH,
  USER_EMAIL_MAX_LENGTH,
} from '../auth.constants';

export class LoginDto {
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email!: string;

  @IsString()
  @MinLength(AUTH_PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_PASSWORD_MAX_LENGTH)
  password!: string;
}
