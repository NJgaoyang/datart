package datart.core.mappers;

import datart.core.entity.ViewField;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

public interface ViewFieldMapper {

    @Select({
            "SELECT id, view_id, canonical_key, origin_name, source_comment, custom_name,",
            "source_path, field_type, field_category, expression, ordinal, active,",
            "create_by, create_time, update_by, update_time",
            "FROM view_field WHERE view_id = #{viewId} ORDER BY ordinal, id"
    })
    List<ViewField> listByViewId(@Param("viewId") String viewId);

    @Select({
            "SELECT id, view_id, canonical_key, origin_name, source_comment, custom_name,",
            "source_path, field_type, field_category, expression, ordinal, active,",
            "create_by, create_time, update_by, update_time",
            "FROM view_field WHERE view_id = #{viewId} AND id = #{fieldId}"
    })
    ViewField selectByViewIdAndId(@Param("viewId") String viewId, @Param("fieldId") String fieldId);

    @Insert({
            "INSERT INTO view_field (id, view_id, canonical_key, origin_name, source_comment,",
            "custom_name, source_path, field_type, field_category, expression, ordinal, active,",
            "create_by, create_time, update_by, update_time)",
            "VALUES (#{id}, #{viewId}, #{canonicalKey}, #{originName}, #{sourceComment},",
            "#{customName}, #{sourcePath}, #{fieldType}, #{fieldCategory}, #{expression},",
            "#{ordinal}, #{active}, #{createBy}, #{createTime}, #{updateBy}, #{updateTime})"
    })
    int insert(ViewField field);

    @Update({
            "UPDATE view_field SET view_id = #{viewId}, canonical_key = #{canonicalKey},",
            "origin_name = #{originName}, source_comment = #{sourceComment},",
            "custom_name = #{customName}, source_path = #{sourcePath},",
            "field_type = #{fieldType}, field_category = #{fieldCategory},",
            "expression = #{expression}, ordinal = #{ordinal}, active = #{active},",
            "create_by = #{createBy}, create_time = #{createTime},",
            "update_by = #{updateBy}, update_time = #{updateTime}",
            "WHERE id = #{id}"
    })
    int update(ViewField field);
}
