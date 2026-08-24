package datart.server.common.metadata;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;

public final class MetadataSnapshotHasher {

    private MetadataSnapshotHasher() {
    }

    public static String checksum(String table, List<String> columns, List<Map<String, Object>> rows) {
        StringJoiner canonical = new StringJoiner("\n");
        canonical.add(table);
        canonical.add(String.join("|", columns));
        for (Map<String, Object> row : rows) {
            StringJoiner values = new StringJoiner("|");
            for (String column : columns) {
                values.add(canonicalValue(row.get(column)));
            }
            canonical.add(values.toString());
        }
        return sha256(canonical.toString());
    }

    public static String combine(Map<String, String> checksums) {
        StringJoiner canonical = new StringJoiner("\n");
        checksums.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> canonical.add(entry.getKey() + "=" + entry.getValue()));
        return sha256(canonical.toString());
    }

    private static String canonicalValue(Object value) {
        if (value == null) {
            return "<NULL>";
        }
        if (value instanceof byte[] bytes) {
            return new String(bytes, StandardCharsets.UTF_8);
        }
        return value.toString();
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder(digest.length * 2);
            for (byte item : digest) {
                result.append(String.format("%02x", item));
            }
            return result.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
