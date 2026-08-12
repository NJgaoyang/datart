package datart.server.common;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

public class LimitedInputStream extends FilterInputStream {

    private final long maxBytes;

    private long bytesRead;

    public LimitedInputStream(InputStream inputStream, long maxBytes) {
        super(inputStream);
        this.maxBytes = maxBytes;
    }

    @Override
    public int read() throws IOException {
        int value = super.read();
        if (value >= 0) {
            count(1);
        }
        return value;
    }

    @Override
    public int read(byte[] buffer, int offset, int length) throws IOException {
        int count = super.read(buffer, offset, length);
        if (count > 0) {
            count(count);
        }
        return count;
    }

    private void count(long count) throws IOException {
        bytesRead += count;
        if (bytesRead > maxBytes) {
            throw new IOException("Decompressed import file exceeds the allowed size");
        }
    }
}
