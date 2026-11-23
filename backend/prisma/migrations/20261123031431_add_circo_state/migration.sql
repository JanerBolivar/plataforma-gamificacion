-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "circoArrowRotationY" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "circoCurrentTurnSeat" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "circoOpportunities" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "circoRepresentativeId" TEXT,
ADD COLUMN     "circoSeat" INTEGER,
ADD COLUMN     "circoTokenPosition" INTEGER NOT NULL DEFAULT 0;
