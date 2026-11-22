-- CreateEnum
CREATE TYPE "AvatarGender" AS ENUM ('FEMALE', 'MALE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarGender" "AvatarGender" NOT NULL DEFAULT 'FEMALE';
