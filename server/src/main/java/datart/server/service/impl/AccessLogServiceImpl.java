package datart.server.service.impl;

import datart.core.common.UUIDGenerator;
import datart.core.entity.AccessLog;
import datart.core.log.AccessType;
import datart.core.mappers.ext.AccessLogMapperExt;
import datart.security.base.ResourceType;
import datart.server.service.AsyncAccessLogService;
import datart.server.service.BaseService;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.jdbc.SQL;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import jakarta.annotation.PreDestroy;

@Service
@Slf4j
public class AccessLogServiceImpl extends BaseService implements AsyncAccessLogService {

    private static final int LOG_QUEUE_CAPACITY = 10_000;

    private final ArrayBlockingQueue<AccessLog> logQueue = new ArrayBlockingQueue<>(LOG_QUEUE_CAPACITY);

    private final Thread logThread;

    private final AccessLogMapperExt logMapper;

    private volatile boolean stop = false;

    public AccessLogServiceImpl(AccessLogMapperExt logMapper) {
        this.logMapper = logMapper;
        logThread = new Thread(() -> {
            while (!stop || !logQueue.isEmpty()) {
                try {
                    AccessLog accessLog = logQueue.poll(1, TimeUnit.SECONDS);
                    if (accessLog == null) {
                        continue;
                    }
                    // Skip log entries with null required fields to avoid DB constraint violations
                    if (accessLog.getResourceId() == null) {
                        log.debug("Skipping access log entry: resourceId is null, user={}, resourceType={}",
                                accessLog.getUser(), accessLog.getResourceType());
                        continue;
                    }
                    logMapper.insert(accessLog);
                } catch (InterruptedException e) {
                    if (stop) {
                        break;
                    }
                    log.warn("Access log writer interrupted unexpectedly");
                } catch (Exception e) {
                    log.error("access log insert error", e);
                }
            }
        }, "datart-access-log-writer");
        logThread.setDaemon(true);
        logThread.start();
    }

    @Override
    public AccessLog log(AccessLog accessLog) {
        accessLog.setId(UUIDGenerator.generate());
        if (!logQueue.offer(accessLog)) {
            log.warn("Access log queue is full; dropping log entry for resource {}", accessLog.getResourceId());
        }
        return accessLog;
    }

    @Override
    public AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId) {
        return log(accessType, resourceType, resourceId, (String) null);
    }

    @Override
    public AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, String resourceName) {
        return log(accessType, resourceType, resourceId, resourceName, new Date());
    }

    @Override
    public AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, Date accessTime) {
        return log(accessType, resourceType, resourceId, null, accessTime);
    }


    @Override
    public AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, Date accessTime, Integer duration) {
        return log(accessType, resourceType, resourceId, null, accessTime, duration);
    }

    private AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, String resourceName, Date accessTime) {
        return log(accessType, resourceType, resourceId, resourceName, accessTime, null);
    }

    private AccessLog log(AccessType accessType, ResourceType resourceType, String resourceId, String resourceName, Date accessTime, Integer duration) {
        // Skip logging if resourceId is null — access_log.resource_id is NOT NULL
        if (resourceId == null) {
            return null;
        }
        AccessLog log = new AccessLog();
        log.setUser(getCurrentUser().getUsername());
        log.setAccessType(accessType.name());
        log.setResourceType(resourceType != null ? resourceType.name() : null);
        log.setResourceId(resourceId);
        log.setResourceName(resourceName);
        log.setAccessTime(accessTime);
        log.setDuration(duration);
        return log(log);
    }

    @Override
    @PreDestroy
    public void stop() {
        stop = true;
        try {
            logThread.join(5_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    @Override
    public List<AccessLog> queryLogs(Date startTime, Date endTime, String user, String resourceType, int pageSize, int pageNo) {
        int offset = (pageNo - 1) * pageSize;
        return logMapper.queryLogs(startTime, endTime, user, resourceType, pageSize, offset);
    }

    @Override
    public long countLogs(Date startTime, Date endTime, String user, String resourceType) {
        return logMapper.countLogs(startTime, endTime, user, resourceType);
    }


}
