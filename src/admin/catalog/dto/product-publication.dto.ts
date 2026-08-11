import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsUUID,
} from 'class-validator';

export class ProductPublicationDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  productIds!: string[];

  @IsBoolean()
  published!: boolean;
}
