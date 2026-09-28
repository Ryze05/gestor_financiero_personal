import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TransactionType } from '../../generated/prisma/enums.js';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import { normalizeName } from '../../common/transforms/normalize-name.transform.js';

export class TransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ example: 'mercadona' })
  @Transform(normalizeName)
  @IsOptional()
  @IsString()
  search?: string;
}
