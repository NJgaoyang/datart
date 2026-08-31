package datart.server.common.metadata;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MetadataSnapshotHasherTest {

    @Test
    void shouldProduceStableChecksumIndependentOfMapIterationOrder() {
        Map<String, Object> first = new HashMap<>();
        first.put("id", "user-1");
        first.put("password", "$2a$10$old-hash");
        first.put("active", true);

        Map<String, Object> second = new HashMap<>();
        second.put("active", true);
        second.put("password", "$2a$10$old-hash");
        second.put("id", "user-1");

        String firstChecksum = MetadataSnapshotHasher.checksum(
                "user", List.of("id", "password", "active"), List.of(first));
        String secondChecksum = MetadataSnapshotHasher.checksum(
                "user", List.of("id", "password", "active"), List.of(second));

        assertEquals(firstChecksum, secondChecksum);
        assertTrue(firstChecksum.matches("[0-9a-f]{64}"));
    }

    @Test
    void shouldDetectPasswordHashChange() {
        Map<String, Object> before = Map.of(
                "id", "user-1",
                "password", "$2a$10$old-hash",
                "active", true);
        Map<String, Object> after = Map.of(
                "id", "user-1",
                "password", "$2a$10$new-hash",
                "active", true);

        assertNotEquals(
                MetadataSnapshotHasher.checksum("user", List.of("id", "password", "active"), List.of(before)),
                MetadataSnapshotHasher.checksum("user", List.of("id", "password", "active"), List.of(after)));
    }

    @Test
    void shouldCombineChecksumsInSortedKeyOrder() {
        Map<String, String> first = new HashMap<>();
        first.put("role", "role-checksum");
        first.put("user", "user-checksum");
        Map<String, String> second = new HashMap<>();
        second.put("user", "user-checksum");
        second.put("role", "role-checksum");

        assertEquals(MetadataSnapshotHasher.combine(first), MetadataSnapshotHasher.combine(second));
    }
}
