package datart.server.controller;

import datart.server.base.dto.FieldMetaMigrationRequest;
import datart.server.base.dto.FieldMetaMigrationResult;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.base.dto.FieldMetaMigrationVerify;
import datart.server.base.dto.ResponseData;
import datart.server.service.FieldMetaMigrationService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/field-meta-migration")
public class FieldMetaMigrationController extends BaseController {

    private final FieldMetaMigrationService migrationService;

    public FieldMetaMigrationController(FieldMetaMigrationService migrationService) {
        this.migrationService = migrationService;
    }

    @Operation(summary = "scan field metadata migration without modifying data")
    @GetMapping("/scan")
    public ResponseData<FieldMetaMigrationScan> scan(@RequestParam String orgId) {
        checkBlank(orgId, "orgId");
        return ResponseData.success(migrationService.scan(orgId));
    }

    @Operation(summary = "migrate field metadata after scan token confirmation")
    @PostMapping("/migrate")
    public ResponseData<FieldMetaMigrationResult> migrate(@RequestBody FieldMetaMigrationRequest request) {
        checkBlank(request.getOrgId(), "orgId");
        checkBlank(request.getExpectedScanToken(), "expectedScanToken");
        return ResponseData.success(migrationService.migrate(request));
    }

    @Operation(summary = "verify field metadata after migration")
    @GetMapping("/verify")
    public ResponseData<FieldMetaMigrationVerify> verify(@RequestParam String orgId) {
        checkBlank(orgId, "orgId");
        return ResponseData.success(migrationService.verify(orgId));
    }

    @Operation(summary = "rollback a field metadata migration when migrated JSON was not edited")
    @PostMapping("/{runId}/rollback")
    public ResponseData<FieldMetaMigrationResult> rollback(@org.springframework.web.bind.annotation.PathVariable String runId) {
        checkBlank(runId, "runId");
        return ResponseData.success(migrationService.rollback(runId));
    }
}
