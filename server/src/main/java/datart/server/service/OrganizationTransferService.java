package datart.server.service;

import datart.core.entity.Download;
import datart.server.base.transfer.model.organization.OrganizationTransferModel;

public interface OrganizationTransferService {

    OrganizationTransferModel buildPackage(String orgId);

    Download exportPackage(String orgId);
}
