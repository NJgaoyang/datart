-- ============================================================
-- Datart 数据库初始化脚本（最终版本）
-- 包含所有业务表和 Quartz 调度表
-- 首次启动自动创建，后续启动跳过
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Quartz 调度表
-- ============================================================

CREATE TABLE IF NOT EXISTS `QRTZ_BLOB_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(200) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  `BLOB_DATA` blob NULL,
  PRIMARY KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_CALENDARS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `CALENDAR_NAME` varchar(200) NOT NULL,
  `CALENDAR` blob NOT NULL,
  PRIMARY KEY (`SCHED_NAME`, `CALENDAR_NAME`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_CRON_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(200) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  `CRON_EXPRESSION` varchar(200) NOT NULL,
  `TIME_ZONE_ID` varchar(80) NULL DEFAULT NULL,
  PRIMARY KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_FIRED_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `ENTRY_ID` varchar(95) NOT NULL,
  `TRIGGER_NAME` varchar(200) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  `INSTANCE_NAME` varchar(200) NOT NULL,
  `FIRED_TIME` bigint(13) NOT NULL,
  `SCHED_TIME` bigint(13) NOT NULL,
  `PRIORITY` int(11) NOT NULL,
  `STATE` varchar(16) NOT NULL,
  `JOB_NAME` varchar(200) NULL DEFAULT NULL,
  `JOB_GROUP` varchar(200) NULL DEFAULT NULL,
  `IS_NONCONCURRENT` varchar(1) NULL DEFAULT NULL,
  `REQUESTS_RECOVERY` varchar(1) NULL DEFAULT NULL,
  PRIMARY KEY (`SCHED_NAME`, `ENTRY_ID`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_JOB_DETAILS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `JOB_NAME` varchar(200) NOT NULL,
  `JOB_GROUP` varchar(200) NOT NULL,
  `DESCRIPTION` varchar(250) NULL DEFAULT NULL,
  `JOB_CLASS_NAME` varchar(250) NOT NULL,
  `IS_DURABLE` varchar(1) NOT NULL,
  `IS_NONCONCURRENT` varchar(1) NOT NULL,
  `IS_UPDATE_DATA` varchar(1) NOT NULL,
  `REQUESTS_RECOVERY` varchar(1) NOT NULL,
  `JOB_DATA` blob NULL,
  PRIMARY KEY (`SCHED_NAME`, `JOB_NAME`, `JOB_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_LOCKS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `LOCK_NAME` varchar(40) NOT NULL,
  PRIMARY KEY (`SCHED_NAME`, `LOCK_NAME`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_PAUSED_TRIGGER_GRPS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  PRIMARY KEY (`SCHED_NAME`, `TRIGGER_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_SCHEDULER_STATE` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `INSTANCE_NAME` varchar(200) NOT NULL,
  `LAST_CHECKIN_TIME` bigint(13) NOT NULL,
  `CHECKIN_INTERVAL` bigint(13) NOT NULL,
  PRIMARY KEY (`SCHED_NAME`, `INSTANCE_NAME`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_SIMPLE_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(200) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  `REPEAT_COUNT` bigint(7) NOT NULL,
  `REPEAT_INTERVAL` bigint(12) NOT NULL,
  `TIMES_TRIGGERED` bigint(10) NOT NULL,
  PRIMARY KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_SIMPROP_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(200) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  `STR_PROP_1` varchar(512) NULL DEFAULT NULL,
  `STR_PROP_2` varchar(512) NULL DEFAULT NULL,
  `STR_PROP_3` varchar(512) NULL DEFAULT NULL,
  `INT_PROP_1` int(11) NULL DEFAULT NULL,
  `INT_PROP_2` int(11) NULL DEFAULT NULL,
  `LONG_PROP_1` bigint(20) NULL DEFAULT NULL,
  `LONG_PROP_2` bigint(20) NULL DEFAULT NULL,
  `DEC_PROP_1` decimal(13, 4) NULL DEFAULT NULL,
  `DEC_PROP_2` decimal(13, 4) NULL DEFAULT NULL,
  `BOOL_PROP_1` varchar(1) NULL DEFAULT NULL,
  `BOOL_PROP_2` varchar(1) NULL DEFAULT NULL,
  PRIMARY KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `QRTZ_TRIGGERS` (
  `SCHED_NAME` varchar(120) NOT NULL,
  `TRIGGER_NAME` varchar(200) NOT NULL,
  `TRIGGER_GROUP` varchar(200) NOT NULL,
  `JOB_NAME` varchar(200) NOT NULL,
  `JOB_GROUP` varchar(200) NOT NULL,
  `DESCRIPTION` varchar(250) NULL DEFAULT NULL,
  `NEXT_FIRE_TIME` bigint(13) NULL DEFAULT NULL,
  `PREV_FIRE_TIME` bigint(13) NULL DEFAULT NULL,
  `PRIORITY` int(11) NULL DEFAULT NULL,
  `TRIGGER_STATE` varchar(16) NOT NULL,
  `TRIGGER_TYPE` varchar(8) NOT NULL,
  `START_TIME` bigint(13) NOT NULL,
  `END_TIME` bigint(13) NULL DEFAULT NULL,
  `CALENDAR_NAME` varchar(200) NULL DEFAULT NULL,
  `MISFIRE_INSTR` smallint(2) NULL DEFAULT NULL,
  `JOB_DATA` blob NULL,
  PRIMARY KEY (`SCHED_NAME`, `TRIGGER_NAME`, `TRIGGER_GROUP`),
  INDEX `IDX_QRTZ_T_J` (`SCHED_NAME`, `JOB_NAME`, `JOB_GROUP`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ============================================================
-- 业务表
-- ============================================================

-- 访问日志
CREATE TABLE IF NOT EXISTS `access_log` (
  `id` varchar(32) NOT NULL,
  `user` varchar(32) NOT NULL,
  `resource_type` varchar(32) NULL DEFAULT NULL,
  `resource_id` varchar(32) NOT NULL,
  `access_type` varchar(32) NOT NULL,
  `access_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `duration` int(11) NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 仪表盘
CREATE TABLE IF NOT EXISTS `dashboard` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `config` text NULL,
  `thumbnail` varchar(255) NULL DEFAULT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `status` tinyint(6) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 数据图表
CREATE TABLE IF NOT EXISTS `datachart` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) NULL DEFAULT NULL,
  `view_id` varchar(32) NULL DEFAULT NULL,
  `org_id` varchar(32) NOT NULL,
  `config` text NULL,
  `thumbnail` varchar(255) NULL DEFAULT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `status` tinyint(6) NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_view_id` (`view_id`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 下载记录
CREATE TABLE IF NOT EXISTS `download` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `path` varchar(512) NULL DEFAULT NULL,
  `last_download_time` timestamp NULL DEFAULT NULL,
  `create_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `create_by` varchar(128) NOT NULL,
  `status` tinyint(6) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_create_by` (`create_by`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 文件夹
CREATE TABLE IF NOT EXISTS `folder` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `rel_type` varchar(255) NOT NULL,
  `rel_id` varchar(32) NULL DEFAULT NULL,
  `sub_type` varchar(255) NULL DEFAULT NULL,
  `avatar` varchar(255) NULL DEFAULT NULL,
  `parent_id` varchar(32) NULL DEFAULT NULL,
  `index` double(16, 8) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_name_org_parent` (`name`, `org_id`, `parent_id`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_rel_id` (`rel_id`),
  INDEX `idx_parent_id` (`parent_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 链接
CREATE TABLE IF NOT EXISTS `link` (
  `id` varchar(32) NOT NULL,
  `rel_type` varchar(128) NOT NULL,
  `rel_id` varchar(32) NOT NULL,
  `url` varchar(255) NOT NULL,
  `expiration` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 组织设置
CREATE TABLE IF NOT EXISTS `org_settings` (
  `id` varchar(32) NOT NULL,
  `org_id` varchar(32) NULL DEFAULT NULL,
  `type` varchar(128) NULL DEFAULT NULL,
  `config` text NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 组织
CREATE TABLE IF NOT EXISTS `organization` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `avatar` varchar(255) NULL DEFAULT NULL,
  `description` text NULL,
  `create_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `create_by` varchar(32) NOT NULL,
  `update_time` datetime NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_name` (`name`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 角色-资源关联
CREATE TABLE IF NOT EXISTS `rel_role_resource` (
  `id` varchar(32) NOT NULL,
  `role_id` varchar(32) NOT NULL,
  `resource_id` varchar(32) NULL DEFAULT NULL,
  `resource_type` varchar(100) NOT NULL,
  `org_id` varchar(32) NULL DEFAULT NULL,
  `permission` int(11) NOT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_role_resource` (`role_id`, `resource_id`, `resource_type`),
  INDEX `idx_role_id` (`role_id`),
  INDEX `idx_resource_id` (`resource_id`),
  INDEX `idx_resource_type` (`resource_type`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 角色-用户关联
CREATE TABLE IF NOT EXISTS `rel_role_user` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `role_id` varchar(32) NOT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_user_role` (`user_id`, `role_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_role_id` (`role_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 主题-列关联
CREATE TABLE IF NOT EXISTS `rel_subject_columns` (
  `id` varchar(32) NOT NULL,
  `view_id` varchar(32) NOT NULL,
  `subject_id` varchar(32) NOT NULL,
  `subject_type` varchar(32) NOT NULL,
  `column_permission` text NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_view_id` (`view_id`),
  INDEX `idx_subject_id` (`subject_id`),
  INDEX `idx_subject_type` (`subject_type`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 用户-组织关联
CREATE TABLE IF NOT EXISTS `rel_user_organization` (
  `id` varchar(32) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_org_user` (`org_id`, `user_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 变量-主题关联
CREATE TABLE IF NOT EXISTS `rel_variable_subject` (
  `id` varchar(32) NOT NULL,
  `variable_id` varchar(32) NOT NULL,
  `subject_id` varchar(32) NOT NULL,
  `subject_type` varchar(32) NOT NULL,
  `value` varchar(255) NULL DEFAULT NULL,
  `create_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `use_default_value` tinyint(4) NOT NULL,
  `create_by` varchar(32) NOT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_by` varchar(32) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_variable_subject` (`variable_id`, `subject_type`, `subject_id`),
  INDEX `idx_variable_id` (`variable_id`),
  INDEX `idx_subject_id` (`subject_id`),
  INDEX `idx_subject_type` (`subject_type`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 组件-元素关联
CREATE TABLE IF NOT EXISTS `rel_widget_element` (
  `id` varchar(32) NOT NULL,
  `widget_id` varchar(32) NOT NULL,
  `rel_type` varchar(32) NOT NULL,
  `rel_id` varchar(32) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_rel_id` (`rel_id`),
  INDEX `idx_rel_type` (`rel_type`),
  INDEX `idx_widget_id` (`widget_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 组件-组件关联
CREATE TABLE IF NOT EXISTS `rel_widget_widget` (
  `id` varchar(32) NOT NULL,
  `source_id` varchar(32) NOT NULL,
  `target_id` varchar(32) NOT NULL,
  `config` longtext NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_source_id` (`source_id`),
  INDEX `idx_target_id` (`target_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 角色
CREATE TABLE IF NOT EXISTS `role` (
  `id` varchar(32) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(16) NULL DEFAULT NULL,
  `description` varchar(255) NULL DEFAULT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `avatar` varchar(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_org_name` (`org_id`, `name`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_type` (`type`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 定时任务
CREATE TABLE IF NOT EXISTS `schedule` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `type` varchar(100) NOT NULL,
  `active` tinyint(4) NOT NULL,
  `cron_expression` varchar(100) NULL DEFAULT NULL,
  `start_date` timestamp NULL DEFAULT NULL,
  `end_date` timestamp NULL DEFAULT NULL,
  `config` text NULL,
  `create_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `create_by` varchar(32) NOT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `parent_id` varchar(32) NULL DEFAULT NULL,
  `is_folder` tinyint(1) NULL DEFAULT NULL,
  `index` double(16, 8) NULL DEFAULT NULL,
  `status` tinyint(6) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_create_by` (`create_by`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 定时任务日志
CREATE TABLE IF NOT EXISTS `schedule_log` (
  `id` varchar(32) NOT NULL,
  `schedule_id` varchar(32) NOT NULL,
  `start` timestamp NULL DEFAULT NULL,
  `end` timestamp NULL DEFAULT NULL,
  `status` int(11) NOT NULL,
  `message` text NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_schedule_id` (`schedule_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 分享
CREATE TABLE IF NOT EXISTS `share` (
  `id` varchar(32) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `viz_type` varchar(128) NOT NULL,
  `viz_id` varchar(32) NOT NULL,
  `authentication_mode` varchar(128) NOT NULL,
  `roles` text NULL,
  `row_permission_by` varchar(128) NOT NULL,
  `authentication_code` varchar(255) NULL DEFAULT NULL,
  `expiry_date` timestamp NULL DEFAULT NULL,
  `create_by` varchar(128) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_viz_id` (`viz_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 数据源
CREATE TABLE IF NOT EXISTS `source` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `config` text NULL,
  `type` varchar(10) NOT NULL,
  `org_id` varchar(32) NULL DEFAULT NULL,
  `parent_id` varchar(32) NULL DEFAULT NULL,
  `is_folder` tinyint(1) NULL DEFAULT NULL,
  `index` double(16, 8) NULL DEFAULT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `status` tinyint(6) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_org_name` (`name`, `org_id`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 数据源 Schema
CREATE TABLE IF NOT EXISTS `source_schemas` (
  `id` varchar(32) NOT NULL,
  `source_id` varchar(32) NOT NULL,
  `schemas` longtext NULL,
  `update_time` datetime NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_source_id` (`source_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 故事板
CREATE TABLE IF NOT EXISTS `storyboard` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `config` text NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `parent_id` varchar(32) NULL DEFAULT NULL,
  `is_folder` tinyint(1) NULL DEFAULT NULL,
  `index` double(16, 8) NULL DEFAULT NULL,
  `status` tinyint(6) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `idx_org_id` (`org_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 故事页
CREATE TABLE IF NOT EXISTS `storypage` (
  `id` varchar(32) NOT NULL,
  `storyboard_id` varchar(32) NOT NULL,
  `rel_type` varchar(128) NOT NULL,
  `rel_id` varchar(32) NOT NULL,
  `config` text NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_storyboard_id` (`storyboard_id`),
  INDEX `idx_rel_type` (`rel_type`),
  INDEX `idx_rel_id` (`rel_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 用户
CREATE TABLE IF NOT EXISTS `user` (
  `id` varchar(32) NOT NULL,
  `email` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `active` tinyint(1) NULL DEFAULT NULL,
  `name` varchar(255) NULL DEFAULT NULL,
  `description` varchar(255) NULL DEFAULT NULL,
  `avatar` varchar(255) NULL DEFAULT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `create_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_by` varchar(32) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_username` (`username`),
  UNIQUE INDEX `uk_email` (`email`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 用户设置
CREATE TABLE IF NOT EXISTS `user_settings` (
  `id` varchar(32) NOT NULL,
  `user_id` varchar(32) NOT NULL,
  `rel_type` varchar(128) NOT NULL,
  `rel_id` varchar(32) NULL DEFAULT NULL,
  `config` text NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- 变量
CREATE TABLE IF NOT EXISTS `variable` (
  `id` varchar(32) NOT NULL,
  `org_id` varchar(32) NOT NULL,
  `view_id` varchar(32) NULL DEFAULT NULL,
  `source_id` varchar(32) NULL DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(32) NOT NULL,
  `value_type` varchar(32) NOT NULL,
  `format` varchar(255) NULL DEFAULT NULL,
  `permission` int(11) NULL DEFAULT NULL,
  `encrypt` tinyint(4) NULL DEFAULT NULL,
  `label` varchar(255) NULL DEFAULT NULL,
  `default_value` varchar(255) NULL DEFAULT NULL,
  `expression` tinyint(4) NULL DEFAULT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `create_by` varchar(32) NOT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_by` varchar(32) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_org_view_name` (`org_id`, `view_id`, `name`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_view_id` (`view_id`),
  INDEX `idx_source_id` (`source_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 视图
CREATE TABLE IF NOT EXISTS `view` (
  `id` varchar(32) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(255) NULL DEFAULT NULL,
  `org_id` varchar(32) NOT NULL,
  `source_id` varchar(32) NULL DEFAULT NULL,
  `script` text NULL,
  `model` text NULL,
  `config` text NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `parent_id` varchar(32) NULL DEFAULT NULL,
  `is_folder` tinyint(1) NULL DEFAULT NULL,
  `index` double(16, 8) NULL DEFAULT NULL,
  `type` varchar(32) NULL DEFAULT NULL,
  `status` tinyint(6) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uk_name_org_parent` (`name`, `org_id`, `parent_id`),
  INDEX `idx_org_id` (`org_id`),
  INDEX `idx_source_id` (`source_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

-- 组件
CREATE TABLE IF NOT EXISTS `widget` (
  `id` varchar(32) NOT NULL,
  `dashboard_id` varchar(32) NOT NULL,
  `config` longtext NULL,
  `parent_id` varchar(32) NULL DEFAULT NULL,
  `create_by` varchar(32) NOT NULL,
  `create_time` timestamp NULL DEFAULT NULL,
  `update_by` varchar(32) NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_dashboard_id` (`dashboard_id`)
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
