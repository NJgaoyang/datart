package datart.data.provider.jdbc.adapters;

import datart.core.data.provider.QueryCancellationRegistry;
import org.junit.jupiter.api.Test;

import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

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
}
