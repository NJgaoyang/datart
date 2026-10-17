package datart.server.service.impl;

import datart.core.base.exception.BaseException;
import datart.core.entity.View;
import datart.security.base.ResourceType;
import datart.server.base.params.ShareAuthorizedToken;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ShareSupportedFunctionSecurityTest {
    private static ShareAuthorizedToken token() {
        ShareAuthorizedToken t = new ShareAuthorizedToken();
        t.setVizType(ResourceType.VIEW);
        t.setVizId("view-one");
        t.setPermissionBy("share-owner");
        return t;
    }

    private static View view(String sourceId) {
        View v = new View();
        v.setId("view-one");
        v.setSourceId(sourceId);
        return v;
    }

    @Test
    void sharesMayQueryOnlyTheSourceBelongingToTheirView() {
        assertDoesNotThrow(() ->
                ShareServiceImpl.requireSharedFunctionSource(token(), "source-one", view("source-one")));
        assertThrows(BaseException.class, () ->
                ShareServiceImpl.requireSharedFunctionSource(token(), "source-two", view("source-one")));
    }

    @Test
    void rejectsUnrelatedResourcesAndMissingAuthenticatedIdentity() {
        ShareAuthorizedToken t = token();
        t.setVizType(ResourceType.DASHBOARD);
        assertThrows(BaseException.class, () ->
                ShareServiceImpl.requireSharedFunctionSource(t, "source-one", view("source-one")));
        t.setVizType(ResourceType.VIEW);
        t.setPermissionBy(null);
        assertThrows(BaseException.class, () ->
                ShareServiceImpl.requireSharedFunctionSource(t, "source-one", view("source-one")));
        assertThrows(BaseException.class, () ->
                ShareServiceImpl.requireSharedFunctionSource(token(), "source-one", null));
        View anotherView = view("source-one");
        anotherView.setId("view-two");
        assertThrows(BaseException.class, () ->
                ShareServiceImpl.requireSharedFunctionSource(token(), "source-one", anotherView));
    }
}