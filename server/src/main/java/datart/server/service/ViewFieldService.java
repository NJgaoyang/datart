package datart.server.service;

import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.server.base.dto.ViewFieldDTO;

import java.util.List;
import java.util.Map;

public interface ViewFieldService {

    List<ViewFieldDTO> listByViewId(String viewId);

    ViewFieldDTO get(String viewId, String fieldId);

    Map<String, ViewFieldDTO> mapByViewId(String viewId);

    void reconcile(View view);

    void rebuild(View view);

    void migrateLegacyMetadata(View view);

    ViewFieldDTO updateCustomName(String viewId, String fieldId, String customName);

    String resolveDisplayName(ViewField field);
}
