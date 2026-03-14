-- CreateTable
CREATE TABLE "kupci" (
    "id" SERIAL NOT NULL,
    "tip" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "adresa" TEXT NOT NULL,
    "mjesto" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "pib" TEXT,
    "mbKompanije" TEXT,
    "direktor" TEXT,
    "ime" TEXT,
    "prezime" TEXT,
    "jmbg" TEXT,
    "licniId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kupci_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projekti" (
    "id" SERIAL NOT NULL,
    "kupacId" INTEGER NOT NULL,
    "naziv" TEXT NOT NULL,
    "snaga" DOUBLE PRECISION NOT NULL,
    "lokacija" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projekti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faze" (
    "id" SERIAL NOT NULL,
    "projektaId" INTEGER NOT NULL,
    "fazaBroj" INTEGER NOT NULL,
    "naziv" TEXT NOT NULL,
    "opis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faze_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dokumenti" (
    "id" SERIAL NOT NULL,
    "projektaId" INTEGER NOT NULL,
    "fazaId" INTEGER NOT NULL,
    "broj" TEXT NOT NULL,
    "naziv" TEXT NOT NULL,
    "tipDokumenta" TEXT NOT NULL,
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "fileType" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dokumenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" SERIAL NOT NULL,
    "projektaId" INTEGER NOT NULL,
    "docNum" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kupci_email_key" ON "kupci"("email");

-- CreateIndex
CREATE UNIQUE INDEX "kupci_pib_key" ON "kupci"("pib");

-- CreateIndex
CREATE UNIQUE INDEX "kupci_mbKompanije_key" ON "kupci"("mbKompanije");

-- CreateIndex
CREATE UNIQUE INDEX "kupci_jmbg_key" ON "kupci"("jmbg");

-- CreateIndex
CREATE UNIQUE INDEX "kupci_licniId_key" ON "kupci"("licniId");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_projektaId_docNum_key" ON "template_versions"("projektaId", "docNum");

-- AddForeignKey
ALTER TABLE "projekti" ADD CONSTRAINT "projekti_kupacId_fkey" FOREIGN KEY ("kupacId") REFERENCES "kupci"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faze" ADD CONSTRAINT "faze_projektaId_fkey" FOREIGN KEY ("projektaId") REFERENCES "projekti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumenti" ADD CONSTRAINT "dokumenti_projektaId_fkey" FOREIGN KEY ("projektaId") REFERENCES "projekti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dokumenti" ADD CONSTRAINT "dokumenti_fazaId_fkey" FOREIGN KEY ("fazaId") REFERENCES "faze"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_projektaId_fkey" FOREIGN KEY ("projektaId") REFERENCES "projekti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
