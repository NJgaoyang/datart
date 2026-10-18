/*
 * Read-only one-query JDBC cancellation probe.
 *
 * Opt-in only:
 *   DATART_SQL_CANCEL_JDBC_URL=jdbc:mysql://127.0.0.1:3306/datart \
 *   DATART_SQL_CANCEL_JDBC_USER=<test-user> \
 *   DATART_SQL_CANCEL_JDBC_PASSWORD=<secret> \
 *   java -cp '/opt/datart/lib/*' tools/SqlCancellationProbe.java
 *
 * This executes one SELECT SLEEP(8), never reads tables or modifies data.
 * It checks cancellation owner isolation and the actual JDBC driver/server
 * latency. Use a disposable test account and a non-production DB.
 */
import datart.core.data.provider.QueryCancellationRegistry;
import java.sql.*;
import java.util.concurrent.*;

public class SqlCancellationProbe {
    public static void main(String[] args) throws Exception {
        String url = System.getenv("DATART_SQL_CANCEL_JDBC_URL");
        String user = System.getenv("DATART_SQL_CANCEL_JDBC_USER");
        String password = System.getenv("DATART_SQL_CANCEL_JDBC_PASSWORD");
        if (url == null || !url.startsWith("jdbc:mysql:") || user == null || password == null) {
            System.err.println("Provide test MySQL URL/user/password via environment; no credentials printed.");
            System.exit(2);
        }
        ExecutorService thread = Executors.newSingleThreadExecutor();
        String queryId = "read-only-probe-" + java.util.UUID.randomUUID();
        String owner = "test-cancel-owner-" + java.util.UUID.randomUUID();
        long totalStart = System.nanoTime();
        try (Connection connection = DriverManager.getConnection(url, user, password);
             Statement statement = connection.createStatement()) {
            statement.setQueryTimeout(12);
            QueryCancellationRegistry.register(queryId, owner, statement);
            try {
            final CountDownLatch started = new CountDownLatch(1);
            Future<String> query = thread.submit(() -> {
                started.countDown();
                try (ResultSet rs = statement.executeQuery("SELECT SLEEP(8)")) {
                    rs.next();
                    return "completed:" + rs.getInt(1);
                } catch (SQLException e) {
                    return "interrupted";
                }
            });
            if (!started.await(2, TimeUnit.SECONDS)) {
                throw new IllegalStateException("SQL probe did not start");
            }
            Thread.sleep(450);
            if (QueryCancellationRegistry.cancel(queryId, owner + "-other")) {
                throw new IllegalStateException("Cross-owner cancellation was allowed");
            }
            long cancelStart = System.nanoTime();
            if (!QueryCancellationRegistry.cancel(queryId, owner)) {
                throw new IllegalStateException("Owner cancellation was rejected");
            }
            String result = query.get(4, TimeUnit.SECONDS);
            long untilSettledMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - cancelStart);
            long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - totalStart);
            if (untilSettledMs > 4000 || elapsedMs >= 8000) {
                throw new IllegalStateException("Cancellation failed to release SQL promptly");
            }
            System.out.printf("MYSQL_JDBC_CANCEL_OK result=%s cancelToSettledMs=%d totalMs=%d ownerIsolation=true%n",
                    result, untilSettledMs, elapsedMs);
            } finally {
                QueryCancellationRegistry.unregister(queryId, statement);
            }
        } finally {
            thread.shutdownNow();
            if (!thread.awaitTermination(3, TimeUnit.SECONDS)) {
                System.err.println("Probe JDBC thread did not stop");
            }
        }
    }
}