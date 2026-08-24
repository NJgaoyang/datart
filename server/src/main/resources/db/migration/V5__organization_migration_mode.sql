ALTER TABLE organization
    ADD COLUMN migration_mode varchar(16) NOT NULL DEFAULT 'COMPAT';
