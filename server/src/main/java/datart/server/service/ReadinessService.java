package datart.server.service;

import datart.server.base.dto.ReadinessReport;

public interface ReadinessService {

    ReadinessReport scan(String orgId);
}