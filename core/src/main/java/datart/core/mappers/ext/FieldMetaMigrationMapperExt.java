package datart.core.mappers.ext;

import datart.core.entity.Datachart;
import datart.core.entity.View;
import datart.core.entity.Widget;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.Date;
import java.util.List;

@Mapper
public interface FieldMetaMigrationMapperExt {

    @Select({
            "<script>",
            "SELECT id, name, org_id, source_id, type, model, update_time",
            "FROM `view`",
            "WHERE (is_folder = FALSE OR is_folder IS NULL)",
            "<if test='orgId != null'> AND org_id = #{orgId}</if>",
            "ORDER BY org_id, id",
            "</script>"
    })
    List<View> listDatasetViews(@Param("orgId") String orgId);

    @Select({
            "<script>",
            "SELECT w.id, w.dashboard_id, w.config, w.update_time",
            "FROM widget w JOIN dashboard d ON d.id = w.dashboard_id",
            "WHERE w.config IS NOT NULL",
            "<if test='orgId != null'> AND d.org_id = #{orgId}</if>",
            "ORDER BY d.org_id, w.id",
            "</script>"
    })
    List<Widget> listWidgets(@Param("orgId") String orgId);

    @Select({
            "<script>",
            "SELECT id, name, view_id, org_id, config, update_time",
            "FROM datachart",
            "WHERE config IS NOT NULL",
            "<if test='orgId != null'> AND org_id = #{orgId}</if>",
            "ORDER BY org_id, id",
            "</script>"
    })
    List<Datachart> listDatacharts(@Param("orgId") String orgId);

    @Select("SELECT rel_id FROM rel_widget_element WHERE widget_id = #{widgetId} AND rel_type = 'VIEW'")
    List<String> listWidgetViewIds(@Param("widgetId") String widgetId);

    @Update({
            "<script>",
            "UPDATE `view` SET model = #{model}, update_by = #{updateBy}, update_time = NOW()",
            "WHERE id = #{id}",
            "<choose>",
            "<when test='updateTime == null'> AND update_time IS NULL</when>",
            "<otherwise> AND update_time = #{updateTime}</otherwise>",
            "</choose>",
            "</script>"
    })
    int updateViewModel(@Param("id") String id, @Param("model") String model,
                        @Param("updateBy") String updateBy, @Param("updateTime") Date updateTime);

    @Update({
            "<script>",
            "UPDATE widget SET config = #{config}, update_by = #{updateBy}, update_time = NOW()",
            "WHERE id = #{id}",
            "<choose>",
            "<when test='updateTime == null'> AND update_time IS NULL</when>",
            "<otherwise> AND update_time = #{updateTime}</otherwise>",
            "</choose>",
            "</script>"
    })
    int updateWidgetConfig(@Param("id") String id, @Param("config") String config,
                           @Param("updateBy") String updateBy, @Param("updateTime") Date updateTime);

    @Update({
            "<script>",
            "UPDATE datachart SET config = #{config}, update_by = #{updateBy}, update_time = NOW()",
            "WHERE id = #{id}",
            "<choose>",
            "<when test='updateTime == null'> AND update_time IS NULL</when>",
            "<otherwise> AND update_time = #{updateTime}</otherwise>",
            "</choose>",
            "</script>"
    })
    int updateDatachartConfig(@Param("id") String id, @Param("config") String config,
                              @Param("updateBy") String updateBy, @Param("updateTime") Date updateTime);
}
