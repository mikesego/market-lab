ALTER TABLE "games" ALTER COLUMN "data_mode" SET DEFAULT 'alpaca_iex';
UPDATE "games" SET "data_mode" = 'alpaca_iex' WHERE "data_mode" = 'replay';
