-- CreateTable
CREATE TABLE "seme" (
    "id" SERIAL NOT NULL,
    "projektaId" INTEGER NOT NULL,
    "naziv" TEXT NOT NULL,
    "tip" TEXT NOT NULL DEFAULT '1L',
    "model" JSONB NOT NULL,
    "verzija" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seme_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seme_projektaId_idx" ON "seme"("projektaId");

-- AddForeignKey
ALTER TABLE "seme" ADD CONSTRAINT "seme_projektaId_fkey" FOREIGN KEY ("projektaId") REFERENCES "projekti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
