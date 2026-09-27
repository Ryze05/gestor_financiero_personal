import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAccountDto } from './create-account.dto.js';

export class UpdateAccountDto extends PartialType(
  OmitType(CreateAccountDto, ['currency'] as const),
) {}