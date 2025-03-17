-- AlterTable
ALTER TABLE "User" ADD COLUMN     "refreshToken" TEXT,
ALTER COLUMN "id" DROP DEFAULT;
