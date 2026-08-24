package datart.server.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import datart.core.common.FileUtils;
import datart.server.base.transfer.model.*;

import java.io.*;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

public final class TransferFileUtils {

    public static final int CURRENT_FORMAT_VERSION = 2;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
            .setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.NONE)
            .setVisibility(PropertyAccessor.FIELD, JsonAutoDetect.Visibility.ANY);

    private static final Map<String, Class<? extends TransferModel>> ALLOWED_TYPES;

    static {
        Map<String, Class<? extends TransferModel>> types = new HashMap<>();
        register(types, ResourceModel.class);
        register(types, DashboardResourceModel.class);
        register(types, DashboardTemplateModel.class);
        register(types, DatachartResourceModel.class);
        register(types, DatachartTemplateModel.class);
        register(types, FolderTransferModel.class);
        register(types, SourceResourceModel.class);
        register(types, ViewResourceModel.class);
        ALLOWED_TYPES = Collections.unmodifiableMap(types);
    }

    private TransferFileUtils() {
    }

    public static void write(TransferModel model, String path) throws IOException {
        FileUtils.mkdirParentIfNotExist(path);
        TransferEnvelope envelope = new TransferEnvelope();
        envelope.setType(model.getClass().getName());
        envelope.setFormatVersion(CURRENT_FORMAT_VERSION);
        envelope.setPayload(OBJECT_MAPPER.valueToTree(model));
        try (OutputStream output = new GZIPOutputStream(new FileOutputStream(path))) {
            OBJECT_MAPPER.writeValue(output, envelope);
        }
    }

    public static TransferModel read(InputStream source, long maxDecompressedBytes)
            throws IOException, ClassNotFoundException {
        return readWithMetadata(source, maxDecompressedBytes).model();
    }

    public static TransferReadResult readWithMetadata(InputStream source, long maxDecompressedBytes)
            throws IOException, ClassNotFoundException {
        try (BufferedInputStream input = new BufferedInputStream(
                new LimitedInputStream(new GZIPInputStream(source), maxDecompressedBytes))) {
            input.mark(4);
            int firstByte = input.read();
            input.reset();
            if (firstByte == '{') {
                TransferEnvelope envelope = OBJECT_MAPPER.readValue(input, TransferEnvelope.class);
                Class<? extends TransferModel> type = ALLOWED_TYPES.get(envelope.getType());
                if (type == null || envelope.getPayload() == null) {
                    throw new InvalidObjectException("Unsupported transfer file type");
                }
                TransferModel model = OBJECT_MAPPER.treeToValue(envelope.getPayload(), type);
                return new TransferReadResult(model,
                        envelope.getFormatVersion() == null ? 1 : envelope.getFormatVersion());
            }
            try (SecureObjectInputStream legacyInput = new SecureObjectInputStream(input)) {
                Object value = legacyInput.readObject();
                if (!(value instanceof TransferModel)) {
                    throw new InvalidObjectException("Invalid legacy transfer file");
                }
                return new TransferReadResult((TransferModel) value, 1);
            }
        }
    }

    public record TransferReadResult(TransferModel model, int formatVersion) {
    }

    private static void register(Map<String, Class<? extends TransferModel>> types,
                                 Class<? extends TransferModel> type) {
        types.put(type.getName(), type);
    }

    public static class TransferEnvelope {

        private Integer formatVersion = 1;

        private String type;

        private JsonNode payload;

        public String getType() {
            return type;
        }

        public Integer getFormatVersion() {
            return formatVersion;
        }

        public void setFormatVersion(Integer formatVersion) {
            this.formatVersion = formatVersion;
        }

        public void setType(String type) {
            this.type = type;
        }

        public JsonNode getPayload() {
            return payload;
        }

        public void setPayload(JsonNode payload) {
            this.payload = payload;
        }
    }
}
