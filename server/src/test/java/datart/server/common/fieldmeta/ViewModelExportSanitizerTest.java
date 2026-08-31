package datart.server.common.fieldmeta;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ViewModelExportSanitizerTest {

    @Test
    void removesRedundantMarkersButKeepsCustomDisplayNameAndComment() throws Exception {
        String model = """
                {
                  "columns": {
                    "city": {
                      "name": ["city"],
                      "displayName": "城市",
                      "comment": "城市",
                      "isDisplayNameCustom": true
                    },
                    "order_id": {
                      "name": ["order_id"],
                      "displayName": "order_id",
                      "comment": "订单编号",
                      "isDisplayNameCustom": false
                    }
                  }
                }
                """;

        String sanitized = ViewModelExportSanitizer.sanitize(model);

        assertTrue(sanitized.contains("\"displayName\":\"城市\""));
        assertTrue(sanitized.contains("\"comment\":\"城市\""));
        assertTrue(sanitized.contains("\"comment\":\"订单编号\""));
        assertFalse(sanitized.contains("isDisplayNameCustom"));
        assertFalse(sanitized.contains("\"displayName\":\"order_id\""));
    }
}
