CREATE TABLE IF NOT EXISTS `view_field` (
  `id` varchar(32) NOT NULL,
  `view_id` varchar(32) NOT NULL,
  `canonical_key` varchar(512) NOT NULL,
  `origin_name` varchar(255) NOT NULL,
  `source_comment` varchar(1024) NULL,
  `custom_name` varchar(255) NULL,
  `source_path` varchar(1024) NULL,
  `field_type` varchar(32) NOT NULL,
  `field_category` varchar(32) NOT NULL,
  `expression` longtext NULL,
  `ordinal` int NOT NULL DEFAULT 0,
  `active` tinyint NOT NULL DEFAULT 1,
  `create_by` varchar(32) NULL,
  `create_time` datetime NULL,
  `update_by` varchar(32) NULL,
  `update_time` datetime NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_view_field_key` (`view_id`, `canonical_key`),
  KEY `idx_view_field_view` (`view_id`),
  KEY `idx_view_field_origin` (`view_id`, `origin_name`)
) ENGINE = InnoDB
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_general_ci;
