package datart.server.base.dto;

import lombok.Data;

@Data
public class ReadinessScopeReport {

    private int total;
    private int ready;
    private int warnings;
    private int blockers;
}
