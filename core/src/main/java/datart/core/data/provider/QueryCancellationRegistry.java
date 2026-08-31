package datart.core.data.provider;

import org.apache.commons.lang3.StringUtils;

import java.sql.SQLException;
import java.sql.Statement;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/** Tracks only currently running JDBC statements so a requester can stop their own query. */
public final class QueryCancellationRegistry {

    private static final ConcurrentMap<String, QueryHandle> ACTIVE = new ConcurrentHashMap<>();

    private QueryCancellationRegistry() {
    }

    public static void register(String queryId, String ownerId, Statement statement) {
        if (StringUtils.isNotBlank(queryId)) {
            ACTIVE.put(queryId, new QueryHandle(ownerId, statement));
        }
    }

    public static void unregister(String queryId, Statement statement) {
        if (StringUtils.isNotBlank(queryId)) {
            ACTIVE.computeIfPresent(queryId, (id, handle) -> handle.statement == statement ? null : handle);
        }
    }

    public static boolean cancel(String queryId, String ownerId) {
        QueryHandle handle = ACTIVE.get(queryId);
        if (handle == null || !Objects.equals(handle.ownerId, ownerId)) {
            return false;
        }
        try {
            handle.statement.cancel();
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    private static class QueryHandle {
        private final String ownerId;
        private final Statement statement;

        private QueryHandle(String ownerId, Statement statement) {
            this.ownerId = ownerId;
            this.statement = statement;
        }
    }
}
