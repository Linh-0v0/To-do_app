#!/bin/sh

echo "Running Prisma generate..."
npx prisma generate

# Wait for DB to be ready (optional but recommended)
echo "Waiting for database..."
until npx prisma db pull > /dev/null 2>&1; do
  sleep 1
  echo "Waiting..."
done

# Run Prisma migrations
echo "Running migrations..."
npx prisma migrate deploy

# Start the app
echo "Starting NestJS app..."
npm run start
