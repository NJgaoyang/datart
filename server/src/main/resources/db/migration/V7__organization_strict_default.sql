-- STRICT-only for organizations created after the one-way cutover.
-- Existing organization values remain unchanged. COMPAT/NULL rows must be
-- migrated and explicitly switched before deploying the STRICT-only runtime.
ALTER TABLE organization
    MODIFY COLUMN migration_mode varchar(16) NOT NULL DEFAULT 'STRICT';