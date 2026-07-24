import { Matches } from 'class-validator';

export class UpgradeTier2Dto {
  @Matches(/^\d{11}$/, { message: 'NIN must be exactly 11 digits' })
  nin!: string;
}
