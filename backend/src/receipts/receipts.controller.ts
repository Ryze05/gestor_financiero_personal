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
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReceiptsService } from './receipts.service.js';
import { CreateReceiptDto } from './dto/create-receipt.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';

@ApiTags('receipts')
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un ticket y sus movimientos agrupados por categoría' })
  @ApiOkResponse({ description: 'Ticket creado (o existente si se reintenta el mismo externalId)' })
  create(@Body() dto: CreateReceiptDto) {
    return this.receiptsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tickets paginados' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.receiptsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un ticket con sus movimientos' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.receiptsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar un ticket y, en cascada, sus movimientos' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.receiptsService.remove(id);
  }
}