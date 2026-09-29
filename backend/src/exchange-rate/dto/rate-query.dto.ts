import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Currency } from '../../generated/prisma/enums.js';

export class RateQueryDto {
  @ApiProperty({ enum: Currency, example: Currency.EUR })
  @IsEnum(Currency)
  from!: Currency;

  @ApiProperty({ enum: Currency, example: Currency.USD })
  @IsEnum(Currency)
  to!: Currency;
}