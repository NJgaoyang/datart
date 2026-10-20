package datart.server.service.impl;

import datart.core.base.consts.MigrationMode;
import datart.core.base.exception.Exceptions;
import datart.core.entity.Organization;
import datart.core.mappers.ext.OrganizationMapperExt;
import datart.server.service.MigrationModeService;
import org.springframework.stereotype.Service;

@Service
public class MigrationModeServiceImpl implements MigrationModeService {

    private final OrganizationMapperExt organizationMapper;

    public MigrationModeServiceImpl(OrganizationMapperExt organizationMapper) {
        this.organizationMapper = organizationMapper;
    }

    @Override
    public MigrationMode getMode(String orgId) {
        Organization organization = organizationMapper.selectByPrimaryKey(orgId);
        if (organization == null) {
            Exceptions.notFound("organization");
        }
        // STRICT-only installations must fail closed. Never silently serve
        // old metadata by reverting a missing/legacy organization to COMPAT.
        if (organization.getMigrationMode() != MigrationMode.STRICT) {
            throw new IllegalStateException("STRICT_ONLY_ORGANIZATION_REQUIRED: " + orgId);
        }
        return MigrationMode.STRICT;
    }
}