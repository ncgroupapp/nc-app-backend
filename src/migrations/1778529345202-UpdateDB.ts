import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDB1778529345202 implements MigrationInterface {
  name = "UpdateDB1778529345202";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Creación del ENUM y la nueva columna de moneda (Seguro)
    await queryRunner.query(
      `CREATE TYPE "public"."offers_currency_enum" AS ENUM('USD', 'EUR', 'CLP', 'ARS', 'BRL', 'UYU')`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD "currency" "public"."offers_currency_enum" NOT NULL DEFAULT 'CLP'`,
    );

    // 2. CORRECCIÓN: Convertir fechas de Date a Timestamp sin borrar datos
    await queryRunner.query(
      `ALTER TABLE "quotations" ALTER COLUMN "quotationDate" TYPE TIMESTAMP USING "quotationDate"::timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ALTER COLUMN "validUntil" TYPE TIMESTAMP USING "validUntil"::timestamp`,
    );

    // 3. CORRECCIÓN: Convertir cantidades de Integer a Numeric(10,2) sin borrar datos
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "quantity" TYPE numeric(10,2) USING "quantity"::numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "awardedQuantity" TYPE numeric(10,2) USING "awardedQuantity"::numeric(10,2)`,
    );

    // 4. Ajuste de precisión en los precios (Añadido el USING por seguridad extra)
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "priceWithoutIVA" TYPE numeric(10,2) USING "priceWithoutIVA"::numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "priceWithIVA" TYPE numeric(10,2) USING "priceWithIVA"::numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir cantidades a Integer sin borrar
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "awardedQuantity" TYPE integer USING "awardedQuantity"::integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "quantity" TYPE integer USING "quantity"::integer`,
    );

    // Revertir precisión de precios
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "priceWithIVA" TYPE numeric(12,2) USING "priceWithIVA"::numeric(12,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotation_items" ALTER COLUMN "priceWithoutIVA" TYPE numeric(12,2) USING "priceWithoutIVA"::numeric(12,2)`,
    );

    // Revertir fechas a Date sin borrar
    await queryRunner.query(
      `ALTER TABLE "quotations" ALTER COLUMN "validUntil" TYPE date USING "validUntil"::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "quotations" ALTER COLUMN "quotationDate" TYPE date USING "quotationDate"::date`,
    );

    // Eliminar columna y ENUM de moneda
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "currency"`);
    await queryRunner.query(`DROP TYPE "public"."offers_currency_enum"`);
  }
}
