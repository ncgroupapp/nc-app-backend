import { ValueTransformer } from "typeorm";

/** Postgres returns numeric columns as strings; expose them as numbers. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value === null || value === undefined ? null : Number(value)),
};
