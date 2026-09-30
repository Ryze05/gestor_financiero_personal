import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateReceiptDto } from './create-receipt.dto.js';

export class UpdateReceiptDto extends PartialType(
  OmitType(CreateReceiptDto, ['source', 'externalId'] as const),
) {}