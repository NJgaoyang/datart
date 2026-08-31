package datart.core.mappers.ext;

import datart.core.entity.RelUserOrganization;
import datart.core.mappers.RelUserOrganizationMapper;
import org.apache.ibatis.annotations.CacheNamespace;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RelUserOrganizationMapperExt extends RelUserOrganizationMapper {

    @Select({
            "SELECT " +
                    "	ruo.* " +
                    "FROM " +
                    "	rel_user_organization ruo " +
                    "WHERE " +
                    "	ruo.user_id = #{userId} AND ruo.org_id=#{orgId}"
    })
    RelUserOrganization selectByUserAndOrg(@Param("userId") String userId, @Param("orgId") String orgId);

    @Select({
            "SELECT * FROM rel_user_organization WHERE org_id = #{orgId} ORDER BY create_time ASC"
    })
    List<RelUserOrganization> listByOrgId(@Param("orgId") String orgId);

}
