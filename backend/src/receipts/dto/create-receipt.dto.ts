import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  Currency,
  TransactionSource,
} from '../../generated/prisma/enums.js';
import { normalizeName } from '../../common/transforms/normalize-name.transform.js';

export class ReceiptLineItemDto {
  @ApiProperty({ example: 7 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'Camiseta' })
  @Transform(normalizeName)
  @IsString()
  @Length(1, 150)
  concept!: string;

  @ApiProperty()
  @IsUUID()
  categoryId!: string;
}

export class CreateReceiptDto {
  @ApiProperty({ example: 'ticket-20260925-001' })
  @IsString()
  @Length(3, 160)
  externalId!: string;

  @ApiPropertyOptional({ example: 'Carrefour' })
  @IsOptional()
  @Transform(normalizeName)
  @IsString()
  @MaxLength(150)
  merchant?: string;

  @ApiProperty({ example: '2026-09-25' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 19 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  total!: number;

  @ApiProperty({ enum: Currency, example: Currency.EUR })
  @IsEnum(Currency)
  currency!: Currency;

  @ApiProperty()
  @IsUUID()
  accountId!: string;

  @ApiProperty({
    type: [ReceiptLineItemDto],
    description: 'Movimientos agrupados por categoría (cada línea es una transacción).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineItemDto)
  @ArrayMinSize(1)
  lines!: ReceiptLineItemDto[];

  @ApiPropertyOptional({
    enum: TransactionSource,
    default: TransactionSource.OPENCLAW,
  })
  @IsOptional()
  @IsEnum(TransactionSource)
  source: TransactionSource = TransactionSource.OPENCLAW;
}