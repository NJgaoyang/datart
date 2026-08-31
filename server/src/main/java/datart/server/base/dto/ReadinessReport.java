package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
public class ReadinessReport {
    private int total;
    private int ready;
    private int warnings;
    private int blockers;
    private double readiness;
    private boolean strictEligible;
    private List<ReadinessIssue> issues = new ArrayList<>();
    private Map<String, ReadinessScopeReport> scopes = new LinkedHashMap<>();
    private int chartFieldReferences;
    private int chartFieldIdReferences;
    private int resolvedChartFieldIdReferences;
    private double chartFieldIdCoverage;
    private double resolvedChartFieldIdCoverage;
}
