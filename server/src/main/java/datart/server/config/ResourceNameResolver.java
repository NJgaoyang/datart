package datart.server.config;

import datart.security.base.ResourceType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
public class ResourceNameResolver {

    private final JdbcTemplate jdbcTemplate;

    public ResourceNameResolver(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Resolve the name of a resource given its type and ID.
     * Uses JdbcTemplate directly to avoid triggering AOP recursion.
     * Returns null if the resource cannot be found.
     */
    public String resolveName(ResourceType resourceType, String resourceId) {
        if (resourceType == null || resourceId == null) {
            return null;
        }
        String table = getTableName(resourceType);
        if (table == null) {
            return null;
        }
        try {
            List<String> names = jdbcTemplate.queryForList(
                    "SELECT name FROM " + table + " WHERE id = ?",
                    String.class, resourceId);
            if (names != null && !names.isEmpty()) {
                return names.get(0);
            }
        } catch (Exception e) {
            log.debug("Failed to resolve resource name for type={} id={}: {}", resourceType, resourceId, e.getMessage());
        }
        return null;
    }

    private String getTableName(ResourceType resourceType) {
        switch (resourceType) {
            case SOURCE:
                return "source";
            case VIEW:
                return "view";
            case DATACHART:
                return "datachart";
            case DASHBOARD:
                return "dashboard";
            case FOLDER:
                return "folder";
            case STORYBOARD:
                return "storyboard";
            case SCHEDULE:
                return "schedule";
            case ROLE:
                return "role";
            case USER:
                return "user";
            default:
                return null;
        }
    }

}
