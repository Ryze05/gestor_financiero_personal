-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "receiptId" TEXT;

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "merchant" VARCHAR(150),
    "date" DATE NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL,
    "accountId" TEXT NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_externalId_key" ON "Receipt"("externalId");

-- CreateIndex
CREATE INDEX "Receipt_accountId_date_idx" ON "Receipt"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_receiptId_idx" ON "Transaction"("receiptId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
