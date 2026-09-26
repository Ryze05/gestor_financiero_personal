/*
  Warnings:

  - You are about to drop the column `description` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Transfer` table. All the data in the column will be lost.
  - Added the required column `concept` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "description",
ADD COLUMN     "concept" VARCHAR(150) NOT NULL;

-- AlterTable
ALTER TABLE "Transfer" DROP COLUMN "description",
ADD COLUMN     "concept" VARCHAR(150);
