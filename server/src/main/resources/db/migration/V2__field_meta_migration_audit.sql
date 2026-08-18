CREATE TABLE IF NOT EXISTS `field_meta_migration_run` (
  `id` varchar(32) NOT NULL,
  `org_id` varchar(32) NULL,
  `status` varchar(32) NOT NULL,
  `scan_count` int NOT NULL DEFAULT 0,
  `migrated_count` int NOT NULL DEFAULT 0,
  `ambiguous_count` int NOT NULL DEFAULT 0,
  `failed_count` int NOT NULL DEFAULT 0,
  `started_by` varchar(32) NULL,
  `started_at` datetime NOT NULL,
  `completed_at` datetime NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_field_meta_migration_run_org` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `field_meta_migration_backup` (
  `id` varchar(32) NOT NULL,
  `run_id` varchar(32) NOT NULL,
  `org_id` varchar(32) NULL,
  `entity_type` varchar(32) NOT NULL,
  `entity_id` varchar(32) NOT NULL,
  `json_field` varchar(32) NOT NULL,
  `original_json` longtext NOT NULL,
  `original_update_time` datetime NULL,
  `migrated_json_hash` varchar(64) NULL,
  `migrated_update_time` datetime NULL,
  `create_time` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_field_meta_migration_backup` (`run_id`, `entity_type`, `entity_id`),
  INDEX `idx_field_meta_migration_backup_run` (`run_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;
