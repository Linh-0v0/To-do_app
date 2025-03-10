import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

@Global()
@Module({
  providers: [
    {
      provide: 'FIREBASE_APP',
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
      useFactory: (app: FirebaseApp): Auth => getAuth(app), //initialize Firebase Auth using getAuth(app)
      inject: ['FIREBASE_APP'],
    },
    {
      provide: 'FIREBASE_FIRESTORE',
      useFactory: (app: FirebaseApp): Firestore => getFirestore(app), //initialize FireStore using getFirestore(app)
      inject: ['FIREBASE_APP'],
    },
  ],
  exports: ['FIREBASE_APP', 'FIREBASE_AUTH', 'FIREBASE_FIRESTORE'],
})
export class FirebaseModule {}

// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyCMT8LQOHAe5JFgT-Fvf5lWhskxmsVUjUE",
//   authDomain: "to-do-a3e90.firebaseapp.com",
//   projectId: "to-do-a3e90",
//   storageBucket: "to-do-a3e90.firebasestorage.app",
//   messagingSenderId: "445787119210",
//   appId: "1:445787119210:web:f4a5343964aaabcf1c3413",
//   measurementId: "G-D6PSWXNZN4"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
