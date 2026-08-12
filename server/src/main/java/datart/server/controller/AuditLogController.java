/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package datart.server.controller;

import datart.core.entity.AccessLog;
import datart.server.base.dto.ResponseData;
import datart.server.service.AsyncAccessLogService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.util.Date;

@RestController
@RequestMapping(value = "/audit-logs")
public class AuditLogController extends BaseController {

    private final AsyncAccessLogService accessLogService;

    public AuditLogController(AsyncAccessLogService accessLogService) {
        this.accessLogService = accessLogService;
    }

    @Operation(summary = "query audit logs")
    @GetMapping
    public ResponseData<AuditLogResult> queryLogs(
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") Date startTime,
            @RequestParam(required = false) @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss") Date endTime,
            @RequestParam(required = false) String user,
            @RequestParam(required = false) String resourceType,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(defaultValue = "1") int pageNo) {
        long total = accessLogService.countLogs(startTime, endTime, user, resourceType);
        AuditLogResult result = new AuditLogResult();
        result.setTotal(total);
        result.setPageNo(pageNo);
        result.setPageSize(pageSize);
        result.setData(accessLogService.queryLogs(startTime, endTime, user, resourceType, pageSize, pageNo));
        return ResponseData.success(result);
    }

    public static class AuditLogResult {
        private java.util.List<AccessLog> data;
        private long total;
        private int pageNo;
        private int pageSize;

        public java.util.List<AccessLog> getData() { return data; }
        public void setData(java.util.List<AccessLog> data) { this.data = data; }
        public long getTotal() { return total; }
        public void setTotal(long total) { this.total = total; }
        public int getPageNo() { return pageNo; }
        public void setPageNo(int pageNo) { this.pageNo = pageNo; }
        public int getPageSize() { return pageSize; }
        public void setPageSize(int pageSize) { this.pageSize = pageSize; }
    }

}
