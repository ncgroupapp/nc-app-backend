import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDB1773424894321 implements MigrationInterface {
  name = "UpdateDB1773424894321";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "code" SET NOT NULL`,
    );

    // 3. Aplicamos los cambios seguros en offers y products
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "delivery" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "UQ_7cfc24d6c24f0ec91294003d6b8" UNIQUE ("code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertimos los cambios en caso de querer dar marcha atrás
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "UQ_7cfc24d6c24f0ec91294003d6b8"`,
    );
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "delivery"`);
  }
}
