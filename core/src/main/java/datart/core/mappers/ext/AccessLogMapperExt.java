package datart.core.mappers.ext;

import datart.core.entity.AccessLog;
import datart.core.mappers.AccessLogMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.SelectProvider;

import java.util.Date;
import java.util.List;

@Mapper
public interface AccessLogMapperExt extends AccessLogMapper {

    @SelectProvider(type = AccessLogSqlProvider.class, method = "queryLogs")
    List<AccessLog> queryLogs(@Param("startTime") Date startTime,
                              @Param("endTime") Date endTime,
                              @Param("user") String user,
                              @Param("resourceType") String resourceType,
                              @Param("pageSize") int pageSize,
                              @Param("offset") int offset);

    @SelectProvider(type = AccessLogSqlProvider.class, method = "countLogs")
    long countLogs(@Param("startTime") Date startTime,
                   @Param("endTime") Date endTime,
                   @Param("user") String user,
                   @Param("resourceType") String resourceType);

    class AccessLogSqlProvider {
        public String queryLogs(@Param("startTime") Date startTime,
                                @Param("endTime") Date endTime,
                                @Param("user") String user,
                                @Param("resourceType") String resourceType,
                                @Param("pageSize") int pageSize,
                                @Param("offset") int offset) {
            String sql = "select id, user, resource_type, resource_id, resource_name, access_type, access_time, duration " +
                    "from access_log where 1=1";
            if (startTime != null) {
                sql += " and access_time >= #{startTime}";
            }
            if (endTime != null) {
                sql += " and access_time <= #{endTime}";
            }
            if (user != null && !user.isEmpty()) {
                sql += " and user = #{user}";
            }
            if (resourceType != null && !resourceType.isEmpty()) {
                sql += " and resource_type = #{resourceType}";
            }
            sql += " order by access_time desc limit #{pageSize} offset #{offset}";
            return sql;
        }

        public String countLogs(@Param("startTime") Date startTime,
                                @Param("endTime") Date endTime,
                                @Param("user") String user,
                                @Param("resourceType") String resourceType) {
            String sql = "select count(1) from access_log where 1=1";
            if (startTime != null) {
                sql += " and access_time >= #{startTime}";
            }
            if (endTime != null) {
                sql += " and access_time <= #{endTime}";
            }
            if (user != null && !user.isEmpty()) {
                sql += " and user = #{user}";
            }
            if (resourceType != null && !resourceType.isEmpty()) {
                sql += " and resource_type = #{resourceType}";
            }
            return sql;
        }
    }
}
