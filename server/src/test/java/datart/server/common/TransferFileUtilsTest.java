package datart.server.common;

import datart.server.base.transfer.model.DatachartTemplateModel;
import datart.server.base.transfer.model.TransferModel;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TransferFileUtilsTest {

    @Test
    void shouldRoundTripJsonTransferFile() throws Exception {
        Path file = Files.createTempFile("datart-transfer", ".datart");
        try {
            TransferFileUtils.write(new DatachartTemplateModel(), file.toString());

            try (java.io.InputStream input = Files.newInputStream(file)) {
                assertTrue(TransferFileUtils.read(input, 1024 * 1024)
                        instanceof DatachartTemplateModel);
            }
        } finally {
            Files.deleteIfExists(file);
        }
    }

    @Test
    void shouldReadWhitelistedLegacyTransferFile() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream output = new ObjectOutputStream(new GZIPOutputStream(bytes))) {
            output.writeObject(new DatachartTemplateModel());
        }

        TransferModel model = TransferFileUtils.read(
                new ByteArrayInputStream(bytes.toByteArray()), 1024 * 1024);

        assertTrue(model instanceof DatachartTemplateModel);
    }
}
