package datart.core.mappers.ext;

import datart.core.entity.Dashboard;
import datart.core.mappers.DashboardMapper;
import org.apache.ibatis.annotations.*;

import java.util.List;

@Mapper
@CacheNamespaceRef(value = FolderMapperExt.class)
public interface DashboardMapperExt extends DashboardMapper {

    @Select({
            "SELECT " +
                    "	d.id, " +
                    "	d.`index`, " +
                    "	d.is_folder, " +
                    "	d.`name`, " +
                    "	d.parent_id, " +
                    "	d.portal_id " +
                    "FROM " +
                    "	dashboard d " +
                    "WHERE " +
                    "	d.`status` != 0 " +
                    "AND d.org_id = #{orgId}"
    })
    List<Dashboard> listByOrgId(@Param("orgId") String portalId);

    @Select({
            "SELECT id,`name`,org_id,`status` FROM dashboard WHERE org_id=#{orgId} AND `status`=0"
    })
    List<Dashboard> listArchived(String orgId);

    @Delete({
            "DELETE FROM dashboard WHERE id = #{dashboardId};",
            "DELETE FROM rel_widget_widget WHERE source_id in (SELECT DISTINCT id FROM widget WHERE dashboard_id=#{dashboardId});",
            "DELETE FROM rel_widget_widget WHERE target_id in (SELECT DISTINCT id FROM widget WHERE dashboard_id=#{dashboardId});",
            "DELETE FROM rel_widget_element WHERE widget_id in (SELECT DISTINCT id FROM widget WHERE dashboard_id=#{dashboardId});",
            "DELETE FROM widget WHERE dashboard_id=#{dashboardId};",
    })
    int deleteDashboard(String dashboardId);

    @Select({
            "SELECT COUNT(*)",
            "FROM storypage sp",
            "JOIN storyboard sb ON sb.id COLLATE utf8mb3_unicode_ci = sp.storyboard_id COLLATE utf8mb3_unicode_ci",
            "WHERE sp.rel_type = 'DASHBOARD'",
            "AND sp.rel_id = #{dashboardId}",
            "AND sb.status != 0"
    })
    int countActiveStorypageReferences(String dashboardId);

    @Select({
            "SELECT DISTINCT sb.name",
            "FROM storypage sp",
            "JOIN storyboard sb ON sb.id COLLATE utf8mb3_unicode_ci = sp.storyboard_id COLLATE utf8mb3_unicode_ci",
            "WHERE sp.rel_type = 'DASHBOARD'",
            "AND sp.rel_id = #{dashboardId}",
            "AND sb.status != 0"
    })
    List<String> getActiveStoryboardNamesByDashboard(String dashboardId);

    @Select({
            "SELECT DISTINCT d.id, d.`name`, d.org_id, d.`status`, d.create_time",
            "FROM dashboard d",
            "JOIN widget w ON w.dashboard_id = d.id",
            "JOIN rel_widget_element rwe ON rwe.widget_id = w.id",
            "LEFT JOIN datachart dc ON rwe.rel_type = 'DATACHART' AND dc.id = rwe.rel_id",
            "WHERE d.`status` != 0",
            "AND ((rwe.rel_type = 'VIEW' AND rwe.rel_id = #{viewId})",
            " OR (rwe.rel_type = 'DATACHART' AND dc.view_id = #{viewId}))",
            "ORDER BY d.create_time ASC"
    })
    List<Dashboard> listByViewId(String viewId);

}
