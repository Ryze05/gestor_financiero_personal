import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';
import { TransfersController } from './transfers.controller.js';
import { ExchangeRateModule } from '../exchange-rate/exchange-rate.module.js';

@Module({
  imports: [ExchangeRateModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
