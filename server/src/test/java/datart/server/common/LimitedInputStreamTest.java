package datart.server.common;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertThrows;

class LimitedInputStreamTest {

    @Test
    void shouldRejectContentBeyondLimit() {
        LimitedInputStream input = new LimitedInputStream(
                new ByteArrayInputStream(new byte[11]), 10);

        assertThrows(IOException.class, () -> {
            while (input.read() >= 0) {
                // consume
            }
        });
    }
}
