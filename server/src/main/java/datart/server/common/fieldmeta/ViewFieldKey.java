package datart.server.common.fieldmeta;

import java.util.List;

public final class ViewFieldKey {

    private ViewFieldKey() {
    }

    public static String of(String viewType, List<String> sourcePath, String originName,
                            String fieldCategory, String expression) {
        if ("SQL".equalsIgnoreCase(viewType)) {
            return "SQL|" + originName;
        }
        if ("COMPUTED".equalsIgnoreCase(fieldCategory)) {
            return "COMPUTED|" + (hasText(expression) ? expression.trim() : originName);
        }
        String path = String.join(".", sourcePath == null ? List.of() : sourcePath);
        return "FIELD|" + (path.isBlank() ? originName : path);
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
