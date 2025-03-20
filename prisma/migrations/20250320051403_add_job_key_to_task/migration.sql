-- AlterEnum
ALTER TYPE "RepeatType" ADD VALUE 'minute';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "jobKey" TEXT;
