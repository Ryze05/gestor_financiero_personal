import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateTransactionDto } from './create-transaction.dto.js';

export class UpdateTransactionDto extends PartialType(
  OmitType(CreateTransactionDto, ['source', 'externalId'] as const),
) {}