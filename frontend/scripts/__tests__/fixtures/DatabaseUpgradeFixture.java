import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.*;

class DatabaseUpgradeFixture {
    public static void main(String[] args) throws Exception {
        ObjectMapper json = new ObjectMapper(); JsonNode request = json.readTree(System.in);
        JsonNode config = request.required("connection"); String database = config.required("database").asText();
        if (!database.matches("datart_upgrade_test_[a-z0-9]+")) throw new IllegalArgumentException("Only isolated test databases are allowed");
        String base = "jdbc:mysql://" + config.required("host").asText() + ":" + config.path("port").asInt(3306) + "/";
        String suffix = "?characterEncoding=UTF-8&sslMode=" + (config.path("tls").asBoolean(false) ? "REQUIRED" : "DISABLED");
        try (Connection connection = DriverManager.getConnection(base + suffix, config.required("username").asText(), config.required("password").asText()); Statement sql = connection.createStatement()) {
            String action = request.required("action").asText();
            if (action.equals("drop")) { sql.execute("DROP DATABASE IF EXISTS `" + database + "`"); return; }
            if (action.equals("setup")) sql.execute("CREATE DATABASE `" + database + "` CHARACTER SET utf8mb4");
            sql.execute("USE `" + database + "`");
            if (action.equals("setup")) {
                sql.execute("CREATE TABLE organization(id varchar(64) PRIMARY KEY, name varchar(100)) ENGINE=InnoDB");
                sql.execute("CREATE TABLE dashboard(id varchar(64) PRIMARY KEY, org_id varchar(64), name varchar(100), config text, create_time timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, update_time timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX(org_id)) ENGINE=InnoDB");
                sql.execute("CREATE TABLE widget(id varchar(64) PRIMARY KEY, dashboard_id varchar(64), config text, create_time timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, update_time timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX(dashboard_id)) ENGINE=InnoDB");
                sql.execute("CREATE TABLE datachart(id varchar(64) PRIMARY KEY, org_id varchar(64), name varchar(100), config text, create_time timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, update_time timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX(org_id)) ENGINE=InnoDB");
                sql.execute("CREATE TABLE untouched_permissions_and_business(marker varchar(100)) ENGINE=InnoDB");
                sql.execute("INSERT INTO organization VALUES('org-a','测试组织甲'),('org-b','测试组织乙')");
                sql.execute("INSERT INTO untouched_permissions_and_business VALUES('permissions-and-business-unchanged')");
                insert(connection, "INSERT INTO dashboard(id,org_id,name,config) VALUES('board-a','org-a','旧月报',?)", "{\"type\":\"auto\",\"version\":\"1.0.0-RC.3\",\"jsonConfig\":{\"props\":[]},\"layoutVersion\":3,\"mobileLayoutVersion\":3,\"pcRowLayoutVersion\":3}");
                insert(connection, "INSERT INTO widget(id,dashboard_id,config) VALUES('widget-a','board-a',?)", "{\"version\":\"1.0.0-RC.3\",\"type\":\"chart\",\"originalType\":\"ownedChart\",\"customConfig\":{\"props\":[]},\"pRect\":{\"x\":1,\"y\":2,\"width\":12,\"height\":8}}");
                insert(connection, "INSERT INTO datachart(id,org_id,name,config) VALUES('chart-a','org-a','旧图表',?)", "{\"version\":\"1.0.0-alpha.3\",\"chartConfig\":{\"datas\":[{\"key\":\"metrics\",\"rows\":[]},{\"key\":\"deminsion\",\"rows\":[]}]},\"computedFields\":[]}");
                insert(connection, "INSERT INTO dashboard(id,org_id,name,config) VALUES('board-b','org-b','别的组织',?)", "{\"keep\":\"other-organization\"}");
            } else if (action.equals("edit-board")) insert(connection, "UPDATE dashboard SET config=?, create_time=create_time, update_time=update_time WHERE id='board-a'", request.required("config").asText());
            else if (action.equals("edit-widget")) insert(connection, "UPDATE widget SET config=?, create_time=create_time, update_time=update_time WHERE id='widget-a'", request.required("config").asText());
            else if (action.equals("fail-updates")) sql.execute("CREATE TRIGGER reject_widget_update BEFORE UPDATE ON widget FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='simulated-update-failure'");
            else if (action.equals("allow-updates")) sql.execute("DROP TRIGGER reject_widget_update");
            else if (action.equals("nontransactional")) sql.execute("ALTER TABLE widget ENGINE=MyISAM");
            else if (action.equals("sentinel")) {
                try (ResultSet result = sql.executeQuery("SELECT marker FROM untouched_permissions_and_business UNION ALL SELECT config FROM dashboard WHERE id='board-b' UNION ALL SELECT CONCAT(id,':',create_time,':',update_time) FROM dashboard UNION ALL SELECT CONCAT(id,':',create_time,':',update_time) FROM widget UNION ALL SELECT CONCAT(id,':',create_time,':',update_time) FROM datachart")) {
                    var values = json.createArrayNode(); while (result.next()) values.add(result.getString(1)); System.out.print(values);
                }
            } else throw new IllegalArgumentException("Unknown fixture action");
        }
    }
    static void insert(Connection connection, String sql, String value) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(sql)) { statement.setString(1, value); statement.executeUpdate(); }
    }
}
