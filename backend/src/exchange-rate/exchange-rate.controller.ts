import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExchangeRateService } from './exchange-rate.service.js';
import { RateQueryDto } from './dto/rate-query.dto.js';

@ApiTags('exchange-rate')
@Controller('exchange/rate')
export class ExchangeRateController {
  constructor(private readonly exchangeRate: ExchangeRateService) {}

  @Get()
  async get(@Query() query: RateQueryDto) {
    const rate = await this.exchangeRate.getRate(query.from, query.to);
    return { from: query.from, to: query.to, rate: rate.toString() };
  }
}