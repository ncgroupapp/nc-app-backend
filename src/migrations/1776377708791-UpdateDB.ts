import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateDB1776377708791 implements MigrationInterface {
  name = "UpdateDB1776377708791";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agregamos las nuevas columnas de forma segura
    await queryRunner.query(
      `ALTER TABLE "licitations" ADD "closedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_items" ADD "adjudicationId" integer`,
    );

    // 2. CORRECCIÓN CRÍTICA: Convertimos de Date a Timestamp SIN borrar la columna
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "startDate" TYPE TIMESTAMP USING "startDate"::timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "deadlineDate" TYPE TIMESTAMP USING "deadlineDate"::timestamp`,
    );

    // 3. Actualización del ENUM (El método de TypeORM es largo, pero es el más seguro para transacciones)
    await queryRunner.query(
      `ALTER TYPE "public"."licitations_status_enum" RENAME TO "licitations_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."licitations_status_enum" AS ENUM('Pending', 'Quoted', 'Partial Adjudication', 'Not Adjudicated', 'Total Adjudication', 'Closed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "status" TYPE "public"."licitations_status_enum" USING "status"::"text"::"public"."licitations_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "status" SET DEFAULT 'Pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."licitations_status_enum_old"`);

    // 4. Flexibilizamos el código del producto
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "code" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertimos la restricción del código
    await queryRunner.query(
      `ALTER TABLE "products" ALTER COLUMN "code" SET NOT NULL`,
    );

    // Revertimos el ENUM a su estado anterior
    await queryRunner.query(
      `CREATE TYPE "public"."licitations_status_enum_old" AS ENUM('Pending', 'Quoted', 'Partial Adjudication', 'Not Adjudicated', 'Total Adjudication')`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "status" TYPE "public"."licitations_status_enum_old" USING "status"::"text"::"public"."licitations_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "status" SET DEFAULT 'Pending'`,
    );
    await queryRunner.query(`DROP TYPE "public"."licitations_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."licitations_status_enum_old" RENAME TO "licitations_status_enum"`,
    );

    // CORRECCIÓN CRÍTICA DOWN: Revertimos a Date sin borrar las columnas
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "deadlineDate" TYPE date USING "deadlineDate"::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "licitations" ALTER COLUMN "startDate" TYPE date USING "startDate"::date`,
    );

    // Eliminamos las columnas nuevas
    await queryRunner.query(
      `ALTER TABLE "delivery_items" DROP COLUMN "adjudicationId"`,
    );
    await queryRunner.query(`ALTER TABLE "licitations" DROP COLUMN "closedAt"`);
  }
}
