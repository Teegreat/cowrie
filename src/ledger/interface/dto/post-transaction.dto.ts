import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

class PostingDto {
  @IsString()
  accountId!: string;

  @IsInt()
  minorUnits!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsIn(['DEBIT', 'CREDIT'])
  direction!: 'DEBIT' | 'CREDIT';
}

export class PostTransactionDto {
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingDto)
  postings!: PostingDto[];
}
