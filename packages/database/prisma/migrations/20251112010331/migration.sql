-- CreateTable
CREATE TABLE "procedure_code_type" (
    "id" VARCHAR(20) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_code_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_code" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "typeId" VARCHAR(20) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedure_code_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "procedure_code" ADD CONSTRAINT "procedure_code_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "procedure_code_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
