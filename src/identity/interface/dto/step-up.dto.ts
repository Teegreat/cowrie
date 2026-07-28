import { IsString } from 'class-validator';

export class StepUpDto {
  @IsString()
  password!: string;
}
