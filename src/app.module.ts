import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core/constants';
import { HttpExceptionFilter } from './common/exceptions/http-exception.filter';
import { AuthModule } from './modules/auth/auth.module';
import { RcvModule } from './modules/rcv/rcv.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, RcvModule],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
