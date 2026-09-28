import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TransfersService } from './transfers.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { TransferQueryDto } from './dto/transfer-query.dto.js';

@ApiTags('transfers')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  create(@Body() createTransferDto: CreateTransferDto) {
    return this.transfersService.create(createTransferDto);
  }

  @Get()
  findAll(@Query() query: TransferQueryDto) {
    return this.transfersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfersService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.transfersService.remove(id);
  }
}
