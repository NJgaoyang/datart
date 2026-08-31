package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class HistoryMigrationPreview {

    private String orgId;

    private boolean destructive;

    private int total;

    private int needsReview;

    private List<Item> items = new ArrayList<>();

    @Data
    public static class Item {
        private String resourceType;
        private String resourceId;
        private String resourceName;
        private String status;
        private List<String> reasons = new ArrayList<>();
    }
}
