import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class ProductExpirationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  productIds!: string[];

  @IsDateString({
    strict: true,
  })
  expiresAt!: string;
}
