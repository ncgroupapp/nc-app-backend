import { MigrationInterface, QueryRunner } from "typeorm";
import { CREATE_CERTIFICATES_TABLE_SQL } from "../contexts/certificates/certificates.table";

export class AddCertificates1793200000001 implements MigrationInterface {
  name = "AddCertificates1793200000001";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_CERTIFICATES_TABLE_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "certificates"`);
  }
}
