// import * as admin from 'firebase-admin';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // Initialize NestJS
  
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'warn', 'error', 'debug', 'verbose'],
});

  // Load environment variables using ConfigService
  const configService = app.get(ConfigService);

  // Enable CORS (optional)
  app.enableCors();

  // Start the server
  const port = process.env.PORT ?? 3000;

  Logger.log(`🚀 Server is running at http://localhost:${port}`, 'Bootstrap');

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
