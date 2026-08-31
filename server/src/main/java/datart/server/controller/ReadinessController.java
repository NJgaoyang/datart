package datart.server.controller;

import datart.server.base.dto.ReadinessReport;
import datart.server.base.dto.MigrationModeStatus;
import datart.server.base.params.MigrationModeUpdateParam;
import datart.server.base.dto.ResponseData;
import datart.server.service.ReadinessService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PutMapping;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/readiness")
public class ReadinessController extends BaseController {

    private final ReadinessService readinessService;

    public ReadinessController(ReadinessService readinessService) {
        this.readinessService = readinessService;
    }

    @Operation(summary = "scan View and ViewField readiness without modifying data")
    @GetMapping("/scan")
    public ResponseData<ReadinessReport> scan(@RequestParam String orgId) {
        checkBlank(orgId, "orgId");
        return ResponseData.success(readinessService.scan(orgId));
    }

    @Operation(summary = "get organization migration mode")
    @GetMapping("/strict-status")
    public ResponseData<MigrationModeStatus> status(@RequestParam String orgId) {
        checkBlank(orgId, "orgId");
        return ResponseData.success(readinessService.getMode(orgId));
    }

    @Operation(summary = "update organization migration mode")
    @PutMapping("/mode")
    public ResponseData<MigrationModeStatus> updateMode(@Valid @RequestBody MigrationModeUpdateParam param) {
        return ResponseData.success(readinessService.updateMode(param));
    }
}
