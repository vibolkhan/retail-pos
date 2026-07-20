alter table products add column "batchUnit" text;
alter table products rename column "caseSize" to "batchSize";
alter table products rename column "casePrice" to "batchPrice";
alter table products add column "sellableRetail" boolean not null default true;
alter table products add column "sellableWholesale" boolean not null default false;

update products set "sellableWholesale" = true, "batchUnit" = 'Case'
  where "batchSize" is not null and "batchPrice" is not null;
update products set "sellableRetail" = "isActive";

alter table products drop column "isActive";
