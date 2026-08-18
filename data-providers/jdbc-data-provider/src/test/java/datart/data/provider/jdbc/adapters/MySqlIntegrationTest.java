package datart.data.provider.jdbc.adapters;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

@EnabledIfEnvironmentVariable(named = "DATART_MYSQL_JDBC_URL", matches = ".+")
class MySqlIntegrationTest {

    @Test
    void shouldCancelSlowMysqlQuery() throws Exception {
        executeAndStop("SELECT SLEEP(30)", false);
    }

    @Test
    void shouldEnforceMysqlStatementTimeout() throws Exception {
        executeAndStop("SELECT SLEEP(30)", true);
    }

    private void executeAndStop(String sql, boolean timeout) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try (Connection connection = DriverManager.getConnection(
                System.getenv("DATART_MYSQL_JDBC_URL"),
                System.getenv().getOrDefault("DATART_MYSQL_JDBC_USER", ""),
                System.getenv().getOrDefault("DATART_MYSQL_JDBC_PASSWORD", ""));
             Statement statement = connection.createStatement()) {
            if (timeout) {
                statement.setQueryTimeout(1);
            }
            Future<?> query = executor.submit(() -> {
                try {
                    statement.execute(sql);
                } catch (Exception ignored) {
                    // Cancellation and driver query-timeout are both expected.
                }
            });
            if (!timeout) {
                TimeUnit.MILLISECONDS.sleep(250);
                statement.cancel();
            }
            assertTimeoutPreemptively(Duration.ofSeconds(10), () -> query.get());
        } finally {
            executor.shutdownNow();
        }
    }
}
