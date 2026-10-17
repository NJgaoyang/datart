package datart.server.service.impl;

import datart.core.base.exception.BaseException;
import datart.core.entity.Download;
import datart.core.entity.User;
import datart.core.mappers.ext.DownloadMapperExt;
import datart.security.manager.DatartSecurityManager;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DownloadServiceSecurityTest {

    // Exceptions.tr falls back to BaseException in isolated unit tests
    // without the MessageResolver application context. Production may
    // throw the more specific NotAllowedException.

    @Test
    void refusesAnotherUsersFinishedDownloadEvenIfIdIsKnown() {
        DownloadMapperExt mapper = mock(DownloadMapperExt.class);
        DownloadServiceImpl service = new DownloadServiceImpl(mapper);
        DatartSecurityManager security = mock(DatartSecurityManager.class);
        User caller = new User();
        caller.setId("user-B");
        when(security.getCurrentUser()).thenReturn(caller);
        service.setSecurityManager(security);

        Download record = record("user-A");
        when(mapper.selectByPrimaryKey("task-1")).thenReturn(record);
        assertThrows(BaseException.class, () -> service.downloadFile("task-1"));
        verify(mapper, never()).updateByPrimaryKey(any());
    }

    @Test
    void shareDownloadRequiresBothExactTokenAndClientIdentity() {
        DownloadMapperExt mapper = mock(DownloadMapperExt.class);
        DownloadServiceImpl service = new DownloadServiceImpl(mapper);
        String owner = DownloadServiceImpl.scopedShareDownloadOwner("token-A", "browser-A");
        when(mapper.selectByPrimaryKey("task-1")).thenReturn(record(owner));

        assertThrows(BaseException.class,
                () -> service.downloadFileForShare("task-1", "token-B", "browser-A"));
        assertThrows(BaseException.class,
                () -> service.downloadFileForShare("task-1", "token-A", "browser-B"));
        assertThrows(BaseException.class,
                () -> service.downloadFileForShare("task-1", "token-A", ""));
        verify(mapper, never()).updateByPrimaryKey(any());

        Download successful = service.downloadFileForShare("task-1", "token-A", "browser-A");
        assertEquals((byte) 2, successful.getStatus());
        verify(mapper, times(1)).updateByPrimaryKey(any());
    }

    private static Download record(String owner) {
        Download download = new Download();
        download.setId("task-1");
        download.setCreateBy(owner);
        download.setStatus((byte) 1);
        download.setPath("download/sample.xlsx");
        return download;
    }
}
