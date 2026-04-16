import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampAndClosedAtToLicitations1774631877131 implements MigrationInterface {
  name = "AddTimestampAndClosedAtToLicitations1774631877131";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("licitations");

    // Check if columns already exist (to support multiple runs)
    const startDateColumn = table?.findColumnByName("startDate");
    const deadlineDateColumn = table?.findColumnByName("deadlineDate");
    const closedAtColumn = table?.findColumnByName("closedAt");

    // Convert startDate from date to timestamp with nullable
    if (startDateColumn && startDateColumn.type === "date") {
      await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "startDate" TYPE timestamp`);
      await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "startDate" DROP NOT NULL`);
    }

    // Convert deadlineDate from date to timestamp with nullable
    if (deadlineDateColumn && deadlineDateColumn.type === "date") {
      await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "deadlineDate" TYPE timestamp`);
      await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "deadlineDate" DROP NOT NULL`);
    }

    // Add closedAt column if it doesn't exist
    if (!closedAtColumn) {
      await queryRunner.query(`ALTER TABLE "licitations" ADD COLUMN "closedAt" timestamp`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove closedAt column
    const table = await queryRunner.getTable("licitations");
    const closedAtColumn = table?.findColumnByName("closedAt");

    if (closedAtColumn) {
      await queryRunner.query(`ALTER TABLE "licitations" DROP COLUMN "closedAt"`);
    }

    // Revert startDate to date with NOT NULL
    await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "startDate" TYPE date`);
    await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "startDate" SET NOT NULL`);

    // Revert deadlineDate to date with NOT NULL
    await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "deadlineDate" TYPE date`);
    await queryRunner.query(`ALTER TABLE "licitations" ALTER COLUMN "deadlineDate" SET NOT NULL`);
  }
}
