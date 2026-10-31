-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "client_request_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "transactions_client_request_id_key" ON "transactions"("client_request_id");
