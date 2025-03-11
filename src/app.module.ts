import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseClientModule } from './modules/firebase/firebase-client.module';
import { AuthModule } from './modules/auth/auth.module';
import { FirebaseAdminModule } from './modules/firebase/firebase-admin.module';
// import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Loads .env globally
    FirebaseClientModule, // ✅ Use Firebase Client SDK
    FirebaseAdminModule, // ✅ Use Firebase Admin SDK
    AuthModule,
    // PrismaModule,
  ],
})
export class AppModule {}
