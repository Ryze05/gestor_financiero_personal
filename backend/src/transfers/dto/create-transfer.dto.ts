import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { normalizeName } from '../../common/transforms/normalize-name.transform.js';

export class CreateTransferDto {
  @ApiProperty({ example: 500 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: '2026-09-25' })
  @IsDateString()
  date!: string;

  @ApiProperty()
  @IsUUID()
  sourceAccountId!: string;

  @ApiProperty()
  @IsUUID()
  destinationAccountId!: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @Transform(normalizeName)
  @IsOptional()
  @IsString()
  @Length(1, 150)
  concept?: string;
}
