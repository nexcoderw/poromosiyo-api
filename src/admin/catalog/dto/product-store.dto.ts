import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsUUID,
} from 'class-validator';

export class ProductStoreAssignmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  productIds!: string[];

  @IsUUID('4')
  storeId!: string;
}
