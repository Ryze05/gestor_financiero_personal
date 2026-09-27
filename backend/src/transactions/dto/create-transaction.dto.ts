import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  Currency,
  TransactionSource,
  TransactionType,
} from '../../generated/prisma/enums.js';
import { normalizeName } from '../../common/transforms/normalize-name.transform.js';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, example: TransactionType.EXPENSE })
  @IsEnum(TransactionType)
  type!: TransactionType;

  @ApiProperty({ example: 23.4 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({ enum: Currency, example: Currency.EUR })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty({ example: 'Compra en supermercado', maxLength: 150 })
  @Transform(normalizeName)
  @IsString()
  @Length(1, 150)
  concept!: string;

  @ApiProperty({ example: '2026-09-25' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;

  @ApiProperty()
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({ enum: TransactionSource, default: TransactionSource.WEB })
  @IsOptional()
  @IsEnum(TransactionSource)
  source: TransactionSource = TransactionSource.WEB;

  @ApiPropertyOptional({ example: 'ticket-20260925-001' })
  @ValidateIf((o) => o.source === TransactionSource.OPENCLAW)
  @IsString()
  @Length(3, 160)
  externalId?: string;
}