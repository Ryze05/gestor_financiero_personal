import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsHexColor, IsOptional, IsString, Length } from 'class-validator';
import { CategoryType } from '../../generated/prisma/enums.js';
import { normalizeName } from '../../common/transforms/normalize-name.transform.js';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Alimentación', minLength: 1, maxLength: 80 })
  @Transform(normalizeName)
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.EXPENSE })
  @IsEnum(CategoryType)
  type!: CategoryType;

  @ApiPropertyOptional({ example: '#ef4444' })
  @IsOptional()
  @IsHexColor()
  color?: string;
}