import { IsIn, IsString, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn(['ASSET', 'LIABILITY'])
  accountType!: 'ASSET' | 'LIABILITY';
}
