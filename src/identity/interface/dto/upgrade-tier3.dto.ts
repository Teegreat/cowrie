import { IsString, MinLength } from 'class-validator';

export class UpgradeTier3Dto {
  @IsString()
  @MinLength(5)
  address!: string;
}
