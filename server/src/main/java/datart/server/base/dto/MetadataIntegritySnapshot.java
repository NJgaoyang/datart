package datart.server.base.dto;

import lombok.Data;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
public class MetadataIntegritySnapshot {

    private String overallChecksum;

    private Map<String, Integer> rowCounts = new LinkedHashMap<>();

    private Map<String, String> checksums = new LinkedHashMap<>();

    private Map<String, Integer> resourceIdCounts = new LinkedHashMap<>();

    private Map<String, String> resourceIdChecksums = new LinkedHashMap<>();

    private boolean passwordHashCovered;
}
