package datart.server.service.impl;

import datart.core.base.PageInfo;
import datart.core.base.consts.AttachmentType;
import datart.core.common.Application;
import datart.core.common.POIUtils;
import datart.core.data.provider.Dataframe;
import datart.core.entity.View;
import datart.core.entity.poi.POISettings;
import datart.server.base.params.DownloadCreateParam;
import datart.server.base.params.ViewExecuteParam;
import datart.server.common.PoiConvertUtils;
import datart.server.service.*;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.apache.poi.ss.usermodel.Workbook;
import org.springframework.stereotype.Service;

import java.io.File;

@Service("excelAttachmentService")
@Slf4j
public class AttachmentExcelServiceImpl implements AttachmentService {

    protected final AttachmentType attachmentType = AttachmentType.EXCEL;

    private final VizService vizService;

    public AttachmentExcelServiceImpl(VizService vizService) {
        this.vizService = vizService;
    }

    @Override
    public File getFile(DownloadCreateParam downloadParams, String path, String fileName) throws Exception {
        DataProviderService dataProviderService = Application.getBean(DataProviderService.class);
        OrgSettingService orgSettingService = Application.getBean(OrgSettingService.class);
        ViewService viewService = Application.getBean(ViewService.class);

        Workbook workbook = POIUtils.createEmpty();
        try {
        for (int i = 0; i < downloadParams.getDownloadParams().size(); i++) {
            ViewExecuteParam viewExecuteParam = downloadParams.getDownloadParams().get(i);
            View view = viewService.retrieve(viewExecuteParam.getViewId(), false);
            int recordLimit = Math.max(1, Math.min(1_000_000,
                    orgSettingService.getDownloadRecordLimit(view.getOrgId())));
            final int batchSize = Math.min(recordLimit, 2_000);
            String chartConfigStr = vizService.getChartConfigByVizId(viewExecuteParam.getVizType(), viewExecuteParam.getVizId());
            String sheetName = StringUtils.isNotBlank(viewExecuteParam.getVizName())
                    ? viewExecuteParam.getVizName() : "Sheet" + i;
            POISettings poiSettings = null;
            int exported = 0;
            int page = 1;
            while (exported < recordLimit) {
                // Keep the page size stable: changing it on the last page
                // also changes SQL OFFSET=(pageNo-1)*pageSize, duplicating rows.
                viewExecuteParam.setPageInfo(PageInfo.builder().pageNo(page).pageSize(batchSize).build());
                Dataframe dataframe = dataProviderService.execute(viewExecuteParam);
                int fetched = dataframe.getRows() == null ? 0 : dataframe.getRows().size();
                int remaining = recordLimit - exported;
                if (fetched > remaining) {
                    dataframe.setRows(new java.util.ArrayList<>(dataframe.getRows().subList(0, remaining)));
                }
                if (poiSettings == null) {
                    poiSettings = PoiConvertUtils.covertToPoiSetting(chartConfigStr, dataframe);
                    POIUtils.withSheet(workbook, sheetName, dataframe, poiSettings);
                } else {
                    POIUtils.appendSheetRows(workbook, sheetName, dataframe, poiSettings);
                }
                exported += Math.min(fetched, remaining);
                if (fetched < batchSize) break;
                page++;
            }
        }
        path = generateFileName(path,fileName,attachmentType);
        File file = new File(path);
        POIUtils.save(workbook, file.getPath(), true);
        log.info("create excel file complete.");
        return file;
        } finally {
            // SXSSFWorkbook creates temporary sheet XML files. close() alone
            // is not sufficient: dispose() removes those files on success
            // and on query/write failures.
            try {
                workbook.close();
            } finally {
                if (workbook instanceof org.apache.poi.xssf.streaming.SXSSFWorkbook) {
                    ((org.apache.poi.xssf.streaming.SXSSFWorkbook) workbook).dispose();
                }
            }
        }
    }
}
