package datart.data.provider.jdbc.adapters;

import datart.core.data.provider.QueryCancellationRegistry;
import org.junit.jupiter.api.Test;

import java.sql.Statement;
import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doThrow;

class QueryCancellationRegistryTest {

    @Test
    void shouldOnlyCancelTheCurrentUsersRegisteredStatement() throws Exception {
        Statement statement = mock(Statement.class);
        QueryCancellationRegistry.register("query-1", "user-1", statement);

        assertFalse(QueryCancellationRegistry.cancel("query-1", "user-2"));
        verifyNoInteractions(statement);
        assertTrue(QueryCancellationRegistry.cancel("query-1", "user-1"));
        verify(statement).cancel();

        QueryCancellationRegistry.unregister("query-1", statement);
        assertFalse(QueryCancellationRegistry.cancel("query-1", "user-1"));
    }

    @Test
    void shouldNotUnregisterAReplacementStatementWhenOlderQueryFinallyCloses() throws Exception {
        Statement oldStatement = mock(Statement.class);
        Statement newStatement = mock(Statement.class);
        String queryId = "test-replacement";
        QueryCancellationRegistry.register(queryId, "same-owner", oldStatement);
        try {
            QueryCancellationRegistry.register(queryId, "same-owner", newStatement);
            // Slow cleanup from the old SQL must not drop the newer handle.
            QueryCancellationRegistry.unregister(queryId, oldStatement);
            assertTrue(QueryCancellationRegistry.cancel(queryId, "same-owner"));
            verify(newStatement).cancel();
            verifyNoInteractions(oldStatement);
        } finally {
            QueryCancellationRegistry.unregister(queryId, newStatement);
        }
        assertFalse(QueryCancellationRegistry.cancel(queryId, "same-owner"));
    }

    @Test
    void shouldReturnFalseIfTheJdbcDriverCannotCancelAStatement() throws Exception {
        Statement statement = mock(Statement.class);
        doThrow(new SQLException("driver cancellation unavailable")).when(statement).cancel();
        String queryId = "test-driver-failure";
        QueryCancellationRegistry.register(queryId, "owner", statement);
        try {
            assertFalse(QueryCancellationRegistry.cancel(queryId, "someone-else"));
            assertFalse(QueryCancellationRegistry.cancel(queryId, "owner"));
            verify(statement).cancel();
        } finally {
            QueryCancellationRegistry.unregister(queryId, statement);
        }
        assertFalse(QueryCancellationRegistry.cancel(queryId, "owner"));
    }
}