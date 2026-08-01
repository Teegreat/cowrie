import { IsIn, IsString, Length, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['ASSET', 'LIABILITY'])
  accountType!: 'ASSET' | 'LIABILITY';

  @IsString()
  @Length(3, 3)
  currency!: string;
}
