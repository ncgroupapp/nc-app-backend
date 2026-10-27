import { MigrationInterface, QueryRunner } from "typeorm";
import { CREATE_STOCK_PURCHASES_TABLE_SQL } from "../contexts/stock/stock-purchases.table";

export class AddStockPurchases1793100000000 implements MigrationInterface {
  name = "AddStockPurchases1793100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(CREATE_STOCK_PURCHASES_TABLE_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_purchases"`);
  }
}
