import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

class PostingDto {
  @IsString()
  accountId!: string;

  @IsString()
  @Matches(/^\d+$/, {
    message: 'minorUnits must be a non-negative integer string',
  })
  minorUnits!: string;

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
