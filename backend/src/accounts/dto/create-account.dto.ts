import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Length } from 'class-validator';
import { Currency } from '../../generated/prisma/enums.js';
import { normalizeName } from '../../common/transforms/normalize-name.transform.js';

export class CreateAccountDto {
  @ApiProperty({ example: 'Cuenta principal', minLength: 1, maxLength: 80 })
  @Transform(normalizeName)
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  initialBalance: number = 0;

  @ApiProperty({ enum: Currency, example: Currency.EUR })
  @IsEnum(Currency)
  currency!: Currency;
}