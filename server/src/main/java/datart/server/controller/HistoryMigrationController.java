package datart.server.controller;

import datart.server.base.dto.HistoryMigrationPreview;
import datart.server.base.dto.ResponseData;
import datart.server.service.HistoryMigrationService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/history-migration")
public class HistoryMigrationController extends BaseController {

    private final HistoryMigrationService historyMigrationService;

    public HistoryMigrationController(HistoryMigrationService historyMigrationService) {
        this.historyMigrationService = historyMigrationService;
    }

    @Operation(summary = "preview historical report and SQL migration impact without modifying data")
    @GetMapping("/preview")
    public ResponseData<HistoryMigrationPreview> preview(@RequestParam String orgId) {
        checkBlank(orgId, "orgId");
        return ResponseData.success(historyMigrationService.preview(orgId));
    }
}
