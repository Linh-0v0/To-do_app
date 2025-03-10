import * as admin from 'firebase-admin';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  // Initialize NestJS
  
const app = await NestFactory.create(AppModule, {
  logger: ['log', 'warn', 'error', 'debug', 'verbose'],
  // logger: false,
});


  // Load environment variables using ConfigService
  const configService = app.get(ConfigService);

  // Initialize Firebase Admin SDK using environment variables
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
      privateKey: configService
        .get<string>('FIREBASE_PRIVATE_KEY')
        ?.replace(/\\n/g, '\n'),
      clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
    }),
  });

  // Enable CORS (optional)
  app.enableCors();

  // Start the server
  const port = process.env.PORT ?? 3000;

  Logger.log(`🚀 Server is running at http://localhost:${port}`, 'Bootstrap');
  // await app.listen(port, () => {
  //   Logger.log(`🚀 Server is running at http://localhost:${port}`, 'Bootstrap');
  // })
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
