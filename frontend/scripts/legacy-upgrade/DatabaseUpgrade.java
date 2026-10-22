import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.*;
import java.util.*;

class DatabaseUpgrade {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> TABLES = Set.of("dashboard", "widget", "datachart");

    public static void main(String[] args) throws Exception {
        try {
            JsonNode request = JSON.readTree(System.in);
            JsonNode settings = request.required("connection");
            String host = settings.required("host").asText();
            String database = settings.required("database").asText();
            int port = settings.path("port").asInt(3306);
            if (!host.matches("[A-Za-z0-9._-]+") || !database.matches("[A-Za-z0-9_-]+") || port < 1 || port > 65535) {
                throw new IllegalArgumentException("数据库地址、名称或端口无效");
            }
            String url = "jdbc:mysql://" + host + ":" + port + "/" + database
                    + "?characterEncoding=UTF-8&connectTimeout=10000&socketTimeout=120000&sslMode="
                    + (settings.path("tls").asBoolean(true) ? "REQUIRED" : "DISABLED");
            try (Connection connection = DriverManager.getConnection(url,
                    settings.required("username").asText(), settings.required("password").asText())) {
                String action = request.required("action").asText();
                if (action.equals("organizations")) {
                    connection.setReadOnly(true);
                    ArrayNode organizations = JSON.createArrayNode();
                    try (Statement query = connection.createStatement(); ResultSet rows = query.executeQuery("SELECT id, name FROM organization ORDER BY id")) {
                        while (rows.next()) organizations.addObject().put("id", rows.getString(1)).put("name", rows.getString(2));
                    }
                    System.out.print(JSON.createObjectNode().set("organizations", organizations));
                    return;
                }
                String orgId = request.required("orgId").asText();
                if (orgId.isBlank()) throw new IllegalArgumentException("请选择组织");
                boolean writing = action.equals("apply") || action.equals("rollback");
                if (!writing && !action.equals("snapshot")) throw new IllegalArgumentException("不支持的操作");
                connection.setTransactionIsolation(Connection.TRANSACTION_REPEATABLE_READ);
                connection.setReadOnly(!writing);
                connection.setAutoCommit(false);
                try {
                    if (writing) checkTransactionalTables(connection);
                    ObjectNode current = snapshot(connection, orgId, writing);
                    if (!writing) {
                        connection.rollback();
                        System.out.print(current);
                        return;
                    }
                    boolean rollback = action.equals("rollback");
                    JsonNode baseline = request.required("baseline");
                    if (!rollback && !current.equals(baseline)) throw new IllegalStateException("数据在预览后发生了变化，请重新检查，未执行升级");
                    JsonNode changes = request.required("changes");
                    if (!changes.isArray() || changes.isEmpty()) throw new IllegalArgumentException("没有需要处理的配置");
                    Map<String, JsonNode> resources = new HashMap<>();
                    for (String table : TABLES) {
                        for (JsonNode row : current.required(collection(table))) resources.put(table + ":" + row.required("id").asText(), row);
                    }
                    Set<String> visited = new HashSet<>();
                    for (JsonNode change : changes) {
                        String table = change.required("table").asText();
                        String id = change.required("id").asText();
                        String key = table + ":" + id;
                        if (!TABLES.contains(table) || !visited.add(key)) throw new IllegalArgumentException("升级计划含无效资源");
                        JsonNode row = resources.get(key);
                        String expected = change.required(rollback ? "after" : "before").asText();
                        String replacement = change.required(rollback ? "before" : "after").asText();
                        if (row == null || !row.path("config").asText().equals(expected)) throw new IllegalStateException("目标配置已变化或不属于当前组织，请重新检查，未写入任何配置");
                        if (!JSON.readTree(replacement).isObject()) throw new IllegalArgumentException("升级计划中含无效配置");
                    }
                    // Datart timestamps use ON UPDATE; preserve them while changing only configuration.
                    for (JsonNode change : changes) {
                        String table = change.required("table").asText();
                        try (PreparedStatement update = connection.prepareStatement("UPDATE `" + table + "` SET config = ?, create_time = create_time, update_time = update_time WHERE id = ?")) {
                            update.setString(1, change.required(rollback ? "before" : "after").asText());
                            update.setString(2, change.required("id").asText());
                            if (update.executeUpdate() != 1) throw new IllegalStateException("更新数量异常，事务已取消");
                        }
                    }
                    connection.commit();
                    System.out.print(JSON.createObjectNode().put("success", true).put("changed", changes.size()));
                } catch (Exception error) {
                    connection.rollback();
                    throw error;
                }
            }
        } catch (Exception error) {
            System.out.print(JSON.createObjectNode().put("error", error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage()));
            System.exit(1);
        }
    }

    private static String collection(String table) {
        return table.equals("dashboard") ? "dashboards" : table.equals("widget") ? "widgets" : "datacharts";
    }

    private static void checkTransactionalTables(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet rows = statement.executeQuery(
                "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('dashboard','widget','datachart')")) {
            int count = 0;
            while (rows.next()) {
                count++;
                if (!"InnoDB".equalsIgnoreCase(rows.getString(2))) throw new IllegalStateException("配置表必须使用 InnoDB 才能保证整批回滚");
            }
            if (count != 3) throw new IllegalStateException("数据库缺少 Datart 报表配置表");
        }
    }

    private static ObjectNode snapshot(Connection connection, String orgId, boolean lock) throws SQLException {
        try (PreparedStatement query = connection.prepareStatement("SELECT id FROM organization WHERE id = ?" + (lock ? " FOR UPDATE" : ""))) {
            query.setString(1, orgId);
            try (ResultSet rows = query.executeQuery()) {
                if (!rows.next()) throw new IllegalArgumentException("组织不存在");
            }
        }
        ObjectNode result = JSON.createObjectNode().put("orgId", orgId);
        for (String table : List.of("dashboard", "widget", "datachart")) {
            String sql = table.equals("widget")
                    ? "SELECT w.id, w.config, w.dashboard_id FROM widget w JOIN dashboard d ON d.id = w.dashboard_id WHERE d.org_id = ? ORDER BY w.id"
                    : "SELECT id, name, config FROM `" + table + "` WHERE org_id = ? ORDER BY id";
            ArrayNode items = result.putArray(collection(table));
            try (PreparedStatement query = connection.prepareStatement(sql + (lock ? " FOR UPDATE" : ""))) {
                query.setString(1, orgId);
                try (ResultSet rows = query.executeQuery()) {
                    while (rows.next()) {
                        ObjectNode item = items.addObject().put("id", rows.getString("id")).put("config", rows.getString("config"));
                        if (table.equals("widget")) item.put("dashboardId", rows.getString("dashboard_id"));
                        else item.put("name", rows.getString("name"));
                    }
                }
            }
        }
        return result;
    }
}
