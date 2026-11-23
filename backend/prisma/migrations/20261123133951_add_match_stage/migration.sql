-- CreateEnum
CREATE TYPE "MatchStage" AS ENUM ('LOBBY', 'SWAMP', 'CIRCO', 'FINISHED');

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "currentStage" "MatchStage" NOT NULL DEFAULT 'LOBBY';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "swampCompleted" BOOLEAN NOT NULL DEFAULT false;
