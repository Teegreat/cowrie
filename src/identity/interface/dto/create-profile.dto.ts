import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @Matches(/^\d{11}$/, { message: 'phoneNumber must be exactly 11 digits' })
  phoneNumber!: string;

  @IsDateString()
  dateOfBirth!: string;

  @Matches(/^\d{11}$/, { message: 'BVN must be exactly 11 digits' })
  bvn!: string;
}
