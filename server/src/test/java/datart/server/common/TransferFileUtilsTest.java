package datart.server.common;

import com.fasterxml.jackson.databind.JsonMappingException;
import datart.server.base.transfer.model.DatachartTemplateModel;
import datart.server.base.transfer.model.SourceResourceModel;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
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

    @Test
    void shouldIgnoreRemovedSourcePropertiesInV1Json() throws Exception {
        TransferFileUtils.TransferReadResult result = readJson(legacySourceJson());

        assertEquals(1, result.formatVersion());
        SourceResourceModel model = (SourceResourceModel) result.model();
        assertEquals("old source", model.getMainModels().get(0).getSource().getName());
        assertEquals("{}", model.getMainModels().get(0).getSource().getConfig());
        assertEquals("MYSQL", model.getMainModels().get(0).getSource().getType());
    }

    @Test
    void shouldKeepV2JsonStrictForUnknownProperties() {
        String sourceType = SourceResourceModel.class.getName();
        String json = "{\"formatVersion\":2,\"type\":\"" + sourceType
                + "\",\"payload\":{\"unexpectedTypoProperty\":\"rejected\"}}";

        assertThrows(JsonMappingException.class, () -> readJson(json));
    }

    @Test
    void shouldNotWriteRemovedSourcePropertiesToV2Json() throws Exception {
        TransferFileUtils.TransferReadResult imported = readJson(legacySourceJson());

        Path file = Files.createTempFile("datart-v2-source", ".datart");
        try {
            TransferFileUtils.write(imported.model(), file.toString());
            String json;
            try (GZIPInputStream input = new GZIPInputStream(Files.newInputStream(file))) {
                json = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            }
            assertFalse(json.contains("schemaUpdateDate"));
        } finally {
            Files.deleteIfExists(file);
        }
    }

    private static TransferFileUtils.TransferReadResult readJson(String json) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (GZIPOutputStream output = new GZIPOutputStream(bytes)) {
            output.write(json.getBytes(StandardCharsets.UTF_8));
        }
        return TransferFileUtils.readWithMetadata(
                new ByteArrayInputStream(bytes.toByteArray()), 1024 * 1024);
    }

    private static String legacySourceJson() {
        return "{\"type\":\"" + SourceResourceModel.class.getName() + "\",\"payload\":{"
                + "\"mainModels\":[{\"source\":{"
                + "\"name\":\"old source\",\"config\":\"{}\",\"type\":\"MYSQL\","
                + "\"schemaUpdateDate\":\"2023-01-01 00:00:00\","
                + "\"someRemovedLegacyProperty\":\"ignored\"}}]}}";
    }
}
