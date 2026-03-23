import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIvaToOffers1773424894322 implements MigrationInterface {
  name = "AddIvaToOffers1773424894322";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("offers");
    const columnExists = table?.findColumnByName("iva");

    if (!columnExists) {
      await queryRunner.query(
        `ALTER TABLE "offers" ADD COLUMN "iva" numeric(10,2) NOT NULL DEFAULT '0'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN IF EXISTS "iva"`);
  }
}
