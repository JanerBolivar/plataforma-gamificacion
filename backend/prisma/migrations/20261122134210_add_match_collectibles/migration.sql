-- CreateEnum
CREATE TYPE "CollectibleType" AS ENUM ('ADIVINALO', 'CARTA_PREGUNTA', 'TIBURON_AZUL', 'TIBURON_ROJO');

-- CreateTable
CREATE TABLE "MatchCollectible" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "type" "CollectibleType" NOT NULL,
    "posX" DOUBLE PRECISION NOT NULL,
    "posZ" DOUBLE PRECISION NOT NULL,
    "collectedByTeamId" TEXT,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchCollectible_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MatchCollectible" ADD CONSTRAINT "MatchCollectible_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
