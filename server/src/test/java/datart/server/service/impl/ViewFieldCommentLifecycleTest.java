package datart.server.service.impl;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ViewFieldCommentLifecycleTest {

    @Test
    void clearsWhenCommentIsVerifiedRemovedOrPhysicalOriginChanges() {
        assertTrue(ViewFieldServiceImpl.shouldClearMissingComment("[\"db\",\"t\",\"city\"]",
                "[\"db\",\"t\",\"city\"]", false, true));
        assertTrue(ViewFieldServiceImpl.shouldClearMissingComment("[\"db\",\"t\",\"city\"]",
                "[]", true, false));
        assertTrue(ViewFieldServiceImpl.shouldClearMissingComment("[\"db\",\"t\",\"city\"]",
                "[\"db\",\"v\",\"city\"]", false, false));
    }

    @Test
    void preservesPreviousCommentWhenSchemaLookupFailsTransiently() {
        assertFalse(ViewFieldServiceImpl.shouldClearMissingComment(
                "[\"db\",\"t\",\"city\"]", "[\"db\",\"t\",\"city\"]", false, false));
    }
}
