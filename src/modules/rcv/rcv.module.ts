import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { RcvController } from './rcv.controller';
import { RcvService } from './rcv.service';
import { SiiScraperService } from './sii-scraper.service';
import { BackendClientService } from './backend-client.service';

@Module({
  imports: [HttpModule, AuthModule],
  controllers: [RcvController],
  providers: [RcvService, SiiScraperService, BackendClientService],
})
export class RcvModule {}
