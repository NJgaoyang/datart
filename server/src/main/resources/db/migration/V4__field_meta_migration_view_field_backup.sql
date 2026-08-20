CREATE TABLE IF NOT EXISTS `field_meta_migration_view_field_backup` (
  `id` varchar(32) NOT NULL,
  `run_id` varchar(32) NOT NULL,
  `org_id` varchar(32) NULL,
  `view_id` varchar(32) NOT NULL,
  `field_id` varchar(32) NOT NULL,
  `original_json` longtext NULL,
  `migrated_json_hash` varchar(64) NOT NULL,
  `create_time` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_field_meta_migration_view_field_backup` (`run_id`, `field_id`),
  KEY `idx_field_meta_migration_view_field_backup_run` (`run_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;
