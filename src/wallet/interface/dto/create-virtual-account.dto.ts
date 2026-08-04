import { IsString, MinLength } from 'class-validator';

export class CreateVirtualAccountDto {
  @IsString()
  @MinLength(1)
  accountName!: string;
}
