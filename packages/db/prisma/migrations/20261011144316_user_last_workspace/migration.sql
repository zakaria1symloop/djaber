-- DropIndex
DROP INDEX "Client_name_trgm";

-- DropIndex
DROP INDEX "Product_name_trgm";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastWorkspaceId" UUID;
