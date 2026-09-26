import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsHexColor, IsOptional, IsString, Length } from 'class-validator';
import { CategoryType } from '../../generated/prisma/enums.js';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Alimentación', minLength: 1, maxLength: 80 })
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