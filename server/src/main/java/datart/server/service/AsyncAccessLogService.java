package datart.server.service;

import datart.core.entity.AccessLog;
import datart.core.log.AccessType;
import datart.security.base.ResourceType;

import java.util.Date;
import java.util.List;

public interface AsyncAccessLogService {

    AccessLog log(AccessLog log);

    AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId);

    AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, String resourceName);

    AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, Date accessTime);

    AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, Date accessTime, Integer duration);

    void stop();

    List<AccessLog> queryLogs(Date startTime, Date endTime, String user, String resourceType, int pageSize, int pageNo);

    long countLogs(Date startTime, Date endTime, String user, String resourceType);

}
