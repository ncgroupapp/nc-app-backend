import { MigrationInterface, QueryRunner } from "typeorm";
import { CREATE_BILLING_DOCUMENTS_TABLE_SQL } from "../contexts/billing/billing-documents.table";

export class AddBillingDocuments1793200000000 implements MigrationInterface {
  name = "AddBillingDocuments1793200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_BILLING_DOCUMENTS_TABLE_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "billing_documents"`);
  }
}
