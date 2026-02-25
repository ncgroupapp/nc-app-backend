import { DataSource } from "typeorm";
import { config } from "dotenv";

config(); // Carga variables de entorno (.env)

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ["src/**/*.entity.ts"], // Importante: apunta a tus entidades
  migrations: ["src/migrations/*.ts"], // Donde se guardarán las migraciones
  synchronize: false, // ¡DEBE SER FALSE!
});
