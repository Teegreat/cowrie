import { IsString, Length, Matches } from 'class-validator';

export class InitiateWithdrawalDto {
  @IsString()
  @Matches(/^\d+$/, {
    message: 'amountMinorUnits must be a non-negative integer string',
  })
  amountMinorUnits!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  @Length(10, 10)
  destinationAccountNumber!: string;

  @IsString()
  destinationBankCode!: string;

  @IsString()
  idempotencyKey!: string;
}
