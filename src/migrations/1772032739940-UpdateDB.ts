import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDB1772032739940 implements MigrationInterface {
  name = "UpdateDB1772032739940";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Cambios en la tabla providers (RUT y Website)
    await queryRunner.query(
      `ALTER TABLE "providers" ALTER COLUMN "rut" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" DROP CONSTRAINT "UQ_aec994c0bf3f0954e4d9f86ef46"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ADD "website" character varying(255)`,
    );

    // 2. Providers: Renombrar 'brand' a 'brands' y convertir el texto existente en un Array ¡SIN BORRAR DATOS!
    await queryRunner.query(
      `ALTER TABLE "providers" RENAME COLUMN "brand" TO "brands"`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ALTER COLUMN "brands" TYPE text[] USING ARRAY["brands"]::text[]`,
    );

    // 3. Products: Renombrar 'image' a 'images' y convertir la URL existente en un Array ¡SIN BORRAR DATOS!
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "image" TO "images"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "images" TYPE text[] USING ARRAY["images"]::text[]`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Cómo revertir los cambios en caso de emergencia
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "images" TYPE character varying(500) USING "images"[1]`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" RENAME COLUMN "images" TO "image"`,
    );

    await queryRunner.query(
      `ALTER TABLE "providers" ALTER COLUMN "brands" TYPE character varying(100) USING "brands"[1]`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" RENAME COLUMN "brands" TO "brand"`,
    );

    await queryRunner.query(`ALTER TABLE "providers" DROP COLUMN "website"`);
    await queryRunner.query(
      `ALTER TABLE "providers" ADD CONSTRAINT "UQ_aec994c0bf3f0954e4d9f86ef46" UNIQUE ("rut")`,
    );
    await queryRunner.query(
      `ALTER TABLE "providers" ALTER COLUMN "rut" SET NOT NULL`,
    );
  }
}
