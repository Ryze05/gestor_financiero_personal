import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';

export function setupApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: 'http://localhost:3000',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Finanzas Personales API')
    .setDescription('API de gastos personales e integracion con OpenClaw')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
}