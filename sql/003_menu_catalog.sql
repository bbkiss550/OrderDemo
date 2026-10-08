-- Run manually after 001_admin.sql and 002_floor_plan.sql.
BEGIN;
CREATE TABLE food_categories (
 id bigserial PRIMARY KEY,
 name varchar(80) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 0
);
CREATE TABLE food_menus (
 id bigserial PRIMARY KEY,
 category_id bigint NOT NULL REFERENCES food_categories(id),
 name varchar(120) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
 description varchar(250) NOT NULL DEFAULT '',
 emoji varchar(32) NOT NULL DEFAULT '🍽️',
 sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
 active boolean NOT NULL DEFAULT true,
 image_bytes bytea,
 image_type varchar(20),
 version bigint NOT NULL DEFAULT 0,
 CHECK ((image_bytes IS NULL AND image_type IS NULL) OR
        (image_bytes IS NOT NULL AND image_type IN ('image/png','image/jpeg') AND octet_length(image_bytes) <= 2097152))
);
CREATE TABLE menu_packages (
 menu_id bigint NOT NULL REFERENCES food_menus(id),
 package_id bigint NOT NULL REFERENCES buffet_packages(id),
 PRIMARY KEY(menu_id,package_id)
);
CREATE INDEX food_menus_category_idx ON food_menus(category_id);
CREATE INDEX menu_packages_package_idx ON menu_packages(package_id);
-- Initial categories only; the administrator adds real dishes and selects packages.
INSERT INTO food_categories(name,sort_order) VALUES
 ('เนื้อ',10),('หมู',20),('ทะเล',30),('ลูกชิ้น',40),('ผัก',50),('เส้น',60),('ของหวาน',70),('เครื่องดื่ม',80);
COMMIT;
