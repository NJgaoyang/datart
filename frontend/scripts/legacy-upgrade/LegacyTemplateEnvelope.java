import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.server.common.TransferFileUtils;
import datart.server.base.transfer.model.DashboardTemplateModel;
import datart.server.base.transfer.model.DatachartTemplateModel;
import java.nio.file.Files;
import java.nio.file.Path;

// Uses the server's allowlisted deserializer; never accepts arbitrary Java classes.
class LegacyTemplateEnvelope {
    public static void main(String[] args) throws Exception {
        try (var input = Files.newInputStream(Path.of(args[0]))) {
            var model = TransferFileUtils.read(input, 128L * 1024 * 1024);
            if (!(model instanceof DashboardTemplateModel) && !(model instanceof DatachartTemplateModel)) {
                throw new IllegalArgumentException("Only dashboard and datachart templates are supported");
            }
            var mapper = new ObjectMapper();
            mapper.setVisibility(com.fasterxml.jackson.annotation.PropertyAccessor.ALL,
                    com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility.NONE);
            mapper.setVisibility(com.fasterxml.jackson.annotation.PropertyAccessor.FIELD,
                    com.fasterxml.jackson.annotation.JsonAutoDetect.Visibility.ANY);
            ObjectNode root = mapper.createObjectNode();
            root.put("type", model.getClass().getName());
            root.put("formatVersion", 2);
            root.put("packageType", "RESOURCE");
            root.set("payload", mapper.valueToTree(model));
            mapper.writeValue(Path.of(args[1]).toFile(), root);
        }
    }
}
