-- Run this script manually after 001_admin.sql. Never run on application startup.
BEGIN;
CREATE TABLE restaurant_floors (
 id bigserial PRIMARY KEY,
 name varchar(80) NOT NULL UNIQUE,
 grid_rows integer NOT NULL CHECK (grid_rows BETWEEN 1 AND 100),
 grid_columns integer NOT NULL CHECK (grid_columns BETWEEN 1 AND 100),
 version bigint NOT NULL DEFAULT 0 CHECK (version >= 0)
);
CREATE TABLE table_layouts (
 table_id bigint PRIMARY KEY REFERENCES dining_tables(id),
 floor_id bigint NOT NULL REFERENCES restaurant_floors(id),
 UNIQUE(table_id,floor_id)
);
CREATE TABLE table_cells (
 floor_id bigint NOT NULL,
 row_index integer NOT NULL CHECK (row_index >= 0),
 column_index integer NOT NULL CHECK (column_index >= 0),
 table_id bigint NOT NULL,
 PRIMARY KEY(floor_id,row_index,column_index),
 FOREIGN KEY(table_id,floor_id) REFERENCES table_layouts(table_id,floor_id) ON DELETE CASCADE
);
ALTER TABLE dining_tables ADD COLUMN closure_reason varchar(250);
ALTER TABLE dining_tables ADD COLUMN metadata_version bigint NOT NULL DEFAULT 0;
ALTER TABLE dining_tables DROP CONSTRAINT dining_tables_capacity_check;
ALTER TABLE dining_tables ADD CONSTRAINT dining_tables_capacity_positive CHECK (capacity > 0);
ALTER TABLE bills ADD COLUMN opening_table_id bigint REFERENCES dining_tables(id);
UPDATE bills SET opening_table_id=table_id;
ALTER TABLE bills ALTER COLUMN opening_table_id SET NOT NULL;
CREATE TABLE bill_table_moves (
 id bigserial PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES bills(id),
 from_table_id bigint NOT NULL REFERENCES dining_tables(id),
 to_table_id bigint NOT NULL REFERENCES dining_tables(id),
 from_table_name varchar(30) NOT NULL,
 to_table_name varchar(30) NOT NULL,
 moved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 moved_by varchar(100) NOT NULL,
 request_key uuid NOT NULL UNIQUE,
 CHECK(from_table_id <> to_table_id)
);
CREATE INDEX bill_table_moves_bill_idx ON bill_table_moves(bill_id,id);
-- Give existing tables a usable initial layout; preserve table IDs, seats, status and bills.
INSERT INTO restaurant_floors(name,grid_rows,grid_columns)
 SELECT 'ชั้น 1', greatest(6,ceil(count(*)/4.0)::integer*2+2),12 FROM dining_tables;
INSERT INTO table_layouts(table_id,floor_id)
 SELECT t.id,f.id FROM dining_tables t CROSS JOIN restaurant_floors f WHERE f.name='ชั้น 1';
WITH positions AS (
 SELECT id,row_number() OVER (ORDER BY name)-1 AS n FROM dining_tables
)
INSERT INTO table_cells(floor_id,row_index,column_index,table_id)
 SELECT f.id,(p.n/4*2+1+r)::integer,(p.n%4*3+c)::integer,p.id
 FROM positions p CROSS JOIN restaurant_floors f CROSS JOIN generate_series(0,1) r CROSS JOIN generate_series(0,1) c
 WHERE f.name='ชั้น 1';
COMMIT;
