package datart.server.service.impl;

import datart.core.base.consts.MigrationMode;
import datart.core.entity.Organization;
import datart.core.mappers.ext.OrganizationMapperExt;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** STRICT-only runtime must never silently enable legacy compatibility. */
class MigrationModeServiceImplTest {
    private final OrganizationMapperExt mapper = mock(OrganizationMapperExt.class);
    private final MigrationModeServiceImpl service = new MigrationModeServiceImpl(mapper);

    @Test
    void newOrganizationsDefaultToStrict() {
        assertEquals(MigrationMode.STRICT, new Organization().getMigrationMode());
    }

    @Test
    void strictOrganizationRemainsStrict() {
        Organization org = new Organization();
        org.setId("org-1");
        org.setMigrationMode(MigrationMode.STRICT);
        when(mapper.selectByPrimaryKey("org-1")).thenReturn(org);
        assertEquals(MigrationMode.STRICT, service.getMode("org-1"));
    }

    @Test
    void compatOrganizationCannotUseLegacyRuntime() {
        Organization org = new Organization();
        org.setId("org-1");
        org.setMigrationMode(MigrationMode.COMPAT);
        when(mapper.selectByPrimaryKey("org-1")).thenReturn(org);
        assertThrows(IllegalStateException.class, () -> service.getMode("org-1"));
    }

    @Test
    void missingMigrationModeCannotFallBackToCompat() {
        Organization org = new Organization();
        org.setId("org-1");
        org.setMigrationMode(null);
        when(mapper.selectByPrimaryKey("org-1")).thenReturn(org);
        assertThrows(IllegalStateException.class, () -> service.getMode("org-1"));
    }
}