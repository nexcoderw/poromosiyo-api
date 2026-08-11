import { IsEmail, MaxLength } from 'class-validator';

import { USER_EMAIL_MAX_LENGTH } from '../auth.constants';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email!: string;
}
