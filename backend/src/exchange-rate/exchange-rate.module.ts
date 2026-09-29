import { Module } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service.js';
import { ExchangeRateController } from './exchange-rate.controller.js';

@Module({
  controllers: [ExchangeRateController],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class ExchangeRateModule {}