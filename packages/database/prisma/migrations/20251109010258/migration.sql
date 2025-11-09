-- CreateTable
CREATE TABLE "InsuranceScanDecompressedFile" (
    "id" VARCHAR(50) NOT NULL,
    "insuranceScanJobId" VARCHAR(50) NOT NULL,
    "fileName" VARCHAR(500) NOT NULL,
    "fileType" "FileType" NOT NULL,
    "fileExtension" "FileExtension" NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "fileHash" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsuranceScanDecompressedFile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InsuranceScanDecompressedFile" ADD CONSTRAINT "InsuranceScanDecompressedFile_insuranceScanJobId_fkey" FOREIGN KEY ("insuranceScanJobId") REFERENCES "InsuranceScanJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
