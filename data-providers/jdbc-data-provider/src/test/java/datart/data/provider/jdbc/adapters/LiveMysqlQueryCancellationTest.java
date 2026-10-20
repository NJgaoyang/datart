package datart.data.provider.jdbc.adapters;

import datart.core.data.provider.QueryCancellationRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real JDBC cancellation using a disposable MySQL instance in CI.
 * Executes ONE read-only SELECT SLEEP(8), no business data/DDL, no mass load.
 * Skipped unless the isolated test MySQL URL is explicitly configured.
 */
class LiveMysqlQueryCancellationTest {
    @Test
    @EnabledIfEnvironmentVariable(named = "DATART_TEST_MYSQL_CANCEL_URL", matches = ".+")
    void interruptsSleepAndEnforcesQueryOwner() throws Exception {
        String url = System.getenv("DATART_TEST_MYSQL_CANCEL_URL");
        String user = System.getenv("DATART_TEST_MYSQL_CANCEL_USER");
        String password = System.getenv("DATART_TEST_MYSQL_CANCEL_PASSWORD");
        assertNotNull(user, "A dedicated test MySQL user is required");
        assertNotNull(password, "A dedicated test MySQL password is required");
        assertTrue(url.startsWith("jdbc:mysql:"), "Only the test MySQL JDBC URL is allowed");

        String queryId = "ci-sleep-" + UUID.randomUUID();
        String owner = "ci-query-owner-" + UUID.randomUUID();
        ExecutorService worker = Executors.newSingleThreadExecutor();
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(12);
            QueryCancellationRegistry.register(queryId, owner, statement);
            try {
                CountDownLatch started = new CountDownLatch(1);
                Future<Boolean> query = worker.submit(() -> {
                    started.countDown();
                    try (ResultSet rows = statement.executeQuery("SELECT SLEEP(8)")) {
                        rows.next();
                        return false; // A full 8-second SQL execution is not a cancellation.
                    } catch (SQLException cancelled) {
                        return true;
                    }
                });
                assertTrue(started.await(3, TimeUnit.SECONDS), "JDBC query thread never started");
                // Permit the driver and server to begin executing SELECT SLEEP.
                Thread.sleep(600);
                assertFalse(QueryCancellationRegistry.cancel(queryId, owner + "-other"),
                        "Another owner must never cancel this JDBC statement");
                long cancelStarted = System.nanoTime();
                assertTrue(QueryCancellationRegistry.cancel(queryId, owner),
                        "The correct owner should be able to cancel the statement");
                assertTrue(query.get(5, TimeUnit.SECONDS),
                        "SELECT SLEEP(8) completed rather than being interrupted");
                long cancelLatencyMs = TimeUnit.NANOSECONDS.toMillis(
                        System.nanoTime() - cancelStarted);
                assertTrue(cancelLatencyMs < 5000,
                        "JDBC statement cancellation took " + cancelLatencyMs + " ms");
                System.out.println("MYSQL_CANCEL_INTEGRATION_OK latencyMs=" + cancelLatencyMs +
                        " ownerIsolation=true");
            } finally {
                QueryCancellationRegistry.unregister(queryId, statement);
            }
            assertFalse(QueryCancellationRegistry.cancel(queryId, owner),
                    "Completed queries must no longer be cancellable");
        } finally {
            worker.shutdownNow();
            assertTrue(worker.awaitTermination(5, TimeUnit.SECONDS),
                    "SQL test worker thread did not stop");
        }
    }
}
