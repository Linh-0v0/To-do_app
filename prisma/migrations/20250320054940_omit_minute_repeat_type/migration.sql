/*
  Warnings:

  - The values [minute] on the enum `RepeatType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RepeatType_new" AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly');
ALTER TABLE "Task" ALTER COLUMN "repeatType" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "repeatType" TYPE "RepeatType_new" USING ("repeatType"::text::"RepeatType_new");
ALTER TYPE "RepeatType" RENAME TO "RepeatType_old";
ALTER TYPE "RepeatType_new" RENAME TO "RepeatType";
DROP TYPE "RepeatType_old";
ALTER TABLE "Task" ALTER COLUMN "repeatType" SET DEFAULT 'none';
COMMIT;
