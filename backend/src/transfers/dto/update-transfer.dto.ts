import { PartialType } from '@nestjs/swagger';
import { CreateTransferDto } from './create-transfer.dto.js';

export class UpdateTransferDto extends PartialType(CreateTransferDto) {}