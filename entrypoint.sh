#!/bin/sh

echo "Running Prisma generate..."
npx prisma generate

echo "Waiting for the database to be ready..."
until npx prisma db pull > /dev/null 2>&1; do
  sleep 1
  echo "Waiting..."
done

echo "Applying migrations..."
npx prisma migrate deploy

echo "Starting the app..."
npm run start
