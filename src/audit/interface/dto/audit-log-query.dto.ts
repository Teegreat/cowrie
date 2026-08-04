import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

const AUDIT_ACTIONS = [
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'USER_LOGIN_FAILED',
  'USER_LOGGED_OUT',
  'PROFILE_CREATED',
  'KYC_TIER_UPGRADED',
  'COMPLIANCE_CASE_RESOLVED',
  'BVN_REVEALED',
  'WALLET_CREATED',
] as const;

export class AuditLogQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: (typeof AUDIT_ACTIONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // caps page size — Ch. 14's lesson on not letting a client demand an unbounded scan
  limit: number = 20;
}
