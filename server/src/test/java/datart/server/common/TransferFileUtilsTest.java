package datart.server.common;

import datart.server.base.transfer.model.DatachartTemplateModel;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TransferFileUtilsTest {

    @Test
    void shouldRoundTripJsonTransferFile() throws Exception {
        Path file = Files.createTempFile("datart-transfer", ".datart");
        try {
            TransferFileUtils.write(new DatachartTemplateModel(), file.toString());

            try (java.io.InputStream input = Files.newInputStream(file)) {
                TransferFileUtils.TransferReadResult result =
                        TransferFileUtils.readWithMetadata(input, 1024 * 1024);
                assertTrue(result.model() instanceof DatachartTemplateModel);
                assertEquals(2, result.formatVersion());
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

        TransferFileUtils.TransferReadResult result = TransferFileUtils.readWithMetadata(
                new ByteArrayInputStream(bytes.toByteArray()), 1024 * 1024);

        assertTrue(result.model() instanceof DatachartTemplateModel);
        assertEquals(1, result.formatVersion());
    }

    @Test
    void shouldTreatUnversionedJsonTransferFileAsLegacy() throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream output = new GZIPOutputStream(bytes)) {
            output.write(("{\"type\":\"" + DatachartTemplateModel.class.getName()
                    + "\",\"payload\":{}}").getBytes(StandardCharsets.UTF_8));
        }

        TransferFileUtils.TransferReadResult result = TransferFileUtils.readWithMetadata(
                new ByteArrayInputStream(bytes.toByteArray()), 1024 * 1024);

        assertTrue(result.model() instanceof DatachartTemplateModel);
        assertEquals(1, result.formatVersion());
    }
}
