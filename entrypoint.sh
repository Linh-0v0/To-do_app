#!/bin/sh

echo "Running Prisma generate..."
npx prisma generate

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until nc -z db 5432; do
  echo "Database is unavailable - sleeping"
  sleep 1
done

echo "Database is ready ✅"

# Run migrations
echo "Running migrations..."
npx prisma migrate deploy

# Start your app
echo "Starting NestJS app..."
npm run start
