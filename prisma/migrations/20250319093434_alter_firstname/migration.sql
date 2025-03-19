/*
  Warnings:

  - You are about to drop the column `fistname` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "fistname",
ADD COLUMN     "firstname" TEXT;
