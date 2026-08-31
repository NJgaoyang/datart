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
        return organization.getMigrationMode() == null
                ? MigrationMode.COMPAT : organization.getMigrationMode();
    }
}
