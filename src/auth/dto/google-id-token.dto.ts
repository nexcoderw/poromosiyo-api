import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GoogleIdTokenDto {
  @IsString()
  @MinLength(100)
  @MaxLength(8192)
  idToken!: string;
}
