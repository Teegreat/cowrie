import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class InitiateTransferDto {
  @IsString()
  @Length(11, 11)
  recipientPhoneNumber!: string;

  @IsString()
  @Matches(/^\d+$/, {
    message: 'amountMinorUnits must be a non-negative integer string',
  })
  amountMinorUnits!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsOptional()
  @IsString()
  narration?: string;

  @IsString()
  idempotencyKey!: string;
}
