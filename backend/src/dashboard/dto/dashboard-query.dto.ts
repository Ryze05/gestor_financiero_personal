import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { Currency } from '../../generated/prisma/enums.js';

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: Currency, default: Currency.EUR })
  @IsOptional()
  @IsEnum(Currency)
  currency: Currency = Currency.EUR;
}