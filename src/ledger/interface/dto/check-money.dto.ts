import { IsString, Length, Matches } from 'class-validator';

export class CheckMoneyDto {
  @IsString()
  @Matches(/^\d+$/, {
    message: 'minorUnits must be a non-negative integer string',
  })
  minorUnits!: string;

  // Deliberately structural only (right length, is a string) — the
  // uppercase-ISO-code rule is a business rule that belongs to Money,
  // not duplicated here.
  @IsString()
  @Length(3, 3)
  currency!: string;
}
