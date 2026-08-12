package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ViewLineageDTO {

    private List<Item> sources = new ArrayList<>();
    private List<Item> views = new ArrayList<>();
    private List<Item> dashboards = new ArrayList<>();
    private List<Item> analyses = new ArrayList<>();

    @Data
    public static class Item {
        private String id;
        private String name;

        public Item(String id, String name) {
            this.id = id;
            this.name = name;
        }
    }
}
