import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDB1773424894321 implements MigrationInterface {
  name = "UpdateDB1773424894321";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Renombramos la columna para que coincida con tu entidad
    await queryRunner.query(
      `ALTER TABLE "manuals" RENAME COLUMN "fileUrl" TO "fileUrls"`,
    );

    // 2. Convertimos el string existente en un array sin perder la información de tus clientes
    await queryRunner.query(
      `ALTER TABLE "manuals" ALTER COLUMN "fileUrls" TYPE text[] USING ARRAY["fileUrls"]::text[]`,
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

    // Revertimos el array a un string simple (tomando el primer link)
    await queryRunner.query(
      `ALTER TABLE "manuals" ALTER COLUMN "fileUrls" TYPE character varying USING "fileUrls"[1]`,
    );

    // Renombramos de vuelta al nombre original
    await queryRunner.query(
      `ALTER TABLE "manuals" RENAME COLUMN "fileUrls" TO "fileUrl"`,
    );
  }
}
