import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_CLIENT_APP',
      inject: [ConfigService],
      useFactory: (configService: ConfigService): FirebaseApp => {
        return initializeApp({
          apiKey: configService.get<string>('FIREBASE_API_KEY'),
          authDomain: configService.get<string>('FIREBASE_AUTH_DOMAIN'),
          projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
          storageBucket: configService.get<string>('FIREBASE_STORAGE_BUCKET'),
          messagingSenderId: configService.get<string>(
            'FIREBASE_MESSAGING_SENDER_ID',
          ),
          appId: configService.get<string>('FIREBASE_APP_ID'),
          measurementId: configService.get<string>('FIREBASE_MEASUREMENT_ID'),
        });
      },
    },
    {
      provide: 'FIREBASE_AUTH',
      useFactory: (app: FirebaseApp): Auth => getAuth(app),
      inject: ['FIREBASE_CLIENT_APP'],
    },
  ],
  exports: ['FIREBASE_CLIENT_APP', 'FIREBASE_AUTH'],
})
export class FirebaseClientModule {}

