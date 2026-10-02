import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { version } from '../package.json';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const defaultOrigins = [
    'http://localhost:4200',
    'https://localhost:4200',
    'https://llamativo-admin.web.app',
  ];
  const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : defaultOrigins;

  app.enableCors({ origin: origins, credentials: true });

  const config = new DocumentBuilder()
    .setTitle('Llamativo RCV Scrapper API')
    .setDescription(
      'Servicio independiente de scraping del Registro de Compras y Ventas (RCV) del SII. No tiene base de datos propia: extrae los datos con Playwright y los envía al backend de Llamativo para su persistencia.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        bearerFormat: 'JWT',
        type: 'http',
      },
      'jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
    },
  });

  const port = process.env.PORT || 3010;
  await app.listen(port);
  const url = await app.getUrl();

  Logger.log(`Version: ${version}`, 'Bootstrap');
  Logger.log(`Application is running on port: ${port}`, 'Bootstrap');
  Logger.log(`Swagger is running on: ${url}/api-docs`, 'Bootstrap');
}
bootstrap();
