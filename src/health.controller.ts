import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('Health')
export class HealthController {
  @Get('health')
  check() {
    return {
      serverResponseCode: 200,
      serverResponseMessage: 'Servicio de scraping RCV operativo',
      data: {
        status: 'ok',
        service: 'llamativo-rcv-scrapper',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
