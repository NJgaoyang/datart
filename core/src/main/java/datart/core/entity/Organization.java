package datart.core.entity;

import datart.core.base.consts.MigrationMode;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class Organization extends BaseEntity {
    private String name;

    private String avatar;

    private String description;

    private MigrationMode migrationMode = MigrationMode.COMPAT;
}
