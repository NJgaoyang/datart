package datart.server.controller;

import datart.core.base.consts.Const;
import datart.core.entity.View;
import datart.server.base.dto.ResponseData;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.base.params.ViewFieldUpdateParam;
import datart.server.service.ViewFieldService;
import datart.server.service.ViewService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/views/{viewId}/fields")
public class ViewFieldController extends BaseController {

    private final ViewFieldService viewFieldService;
    private final ViewService viewService;

    public ViewFieldController(ViewFieldService viewFieldService, ViewService viewService) {
        this.viewFieldService = viewFieldService;
        this.viewService = viewService;
    }

    @Operation(summary = "update a view field custom name")
    @PatchMapping("/{fieldId}")
    public ResponseData<ViewFieldDTO> updateCustomName(@PathVariable String viewId,
                                                       @PathVariable String fieldId,
                                                       @RequestBody ViewFieldUpdateParam param) {
        checkBlank(viewId, "viewId");
        checkBlank(fieldId, "fieldId");
        View view = viewService.retrieve(viewId);
        viewService.requirePermission(view, Const.MANAGE);
        return ResponseData.success(viewFieldService.updateCustomName(viewId, fieldId,
                param == null ? null : param.getCustomName()));
    }
}
