import { IsInt, IsString, Length } from 'class-validator';

export class CheckMoneyDto {
  @IsInt()
  minorUnits!: number;

  // Deliberately structural only (right length, is a string) — the
  // uppercase-ISO-code rule is a business rule that belongs to Money,
  // not duplicated here.
  @IsString()
  @Length(3, 3)
  currency!: string;
}
