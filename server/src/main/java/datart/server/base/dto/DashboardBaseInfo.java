package datart.server.base.dto;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import datart.core.entity.Dashboard;
import lombok.Data;
import org.springframework.beans.BeanUtils;

@Data
public class DashboardBaseInfo {

    private String id;

    private String name;

    private String portalId;

    private String parentId;

    private Boolean isFolder;

    private Double index;

    private Boolean mobileTransformEnabled;

    private Boolean mobileVisible;

    public DashboardBaseInfo(Dashboard dashboard) {
        BeanUtils.copyProperties(dashboard, this);
        mobileTransformEnabled = readMobileSetting(dashboard.getConfig(), "mobileTransformEnabled", true);
        mobileVisible = readMobileSetting(dashboard.getConfig(), "mobileVisible", false);
    }

    public DashboardBaseInfo() {
    }

    private static boolean readMobileSetting(String config, String key, boolean defaultValue) {
        try {
            JSONObject jsonConfig = JSON.parseObject(config).getJSONObject("jsonConfig");
            JSONArray props = jsonConfig == null ? null : jsonConfig.getJSONArray("props");
            if (props == null) {
                return defaultValue;
            }
            for (Object propValue : props) {
                JSONObject prop = (JSONObject) propValue;
                if (!"basic".equals(prop.getString("key"))) {
                    continue;
                }
                JSONArray rows = prop.getJSONArray("rows");
                if (rows == null) {
                    return defaultValue;
                }
                for (Object rowValue : rows) {
                    JSONObject row = (JSONObject) rowValue;
                    if (key.equals(row.getString("key"))) {
                        return !Boolean.FALSE.equals(row.getBoolean("value"));
                    }
                }
            }
        } catch (RuntimeException ignored) {
            // 异常配置使用对应开关的产品默认值。
        }
        return defaultValue;
    }
}
