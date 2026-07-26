import { IsIn, IsString, MinLength } from 'class-validator';

export class ResolveComplianceCaseDto {
  @IsString()
  @MinLength(3)
  notes!: string;

  @IsIn(['CLEARED', 'CONFIRMED_BLOCK'])
  disposition!: 'CLEARED' | 'CONFIRMED_BLOCK';
}
