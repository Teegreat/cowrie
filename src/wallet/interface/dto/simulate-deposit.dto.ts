import { IsString, Length, Matches } from 'class-validator';

export class SimulateDepositDto {
  @IsString()
  virtualAccountNumber!: string;

  @IsString()
  @Matches(/^\d+$/, {
    message: 'amountMinorUnits must be a non-negative integer string',
  })
  amountMinorUnits!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  externalReference!: string;
}
