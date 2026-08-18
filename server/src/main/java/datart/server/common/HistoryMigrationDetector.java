package datart.server.common;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Read-only detector for the legacy syntax that needs manual migration review. */
public final class HistoryMigrationDetector {

    private static final Pattern LEGACY_DATE = Pattern.compile(
            "\\bAGG_DATE_(YEAR|QUARTER|MONTH|WEEK|DAY|HOUR|MINUTE|SECOND)\\b",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern RAW_SQL = Pattern.compile(
            "(^|[^A-Z0-9_])(SELECT|WITH)\\s", Pattern.CASE_INSENSITIVE);

    private HistoryMigrationDetector() {
    }

    public static List<String> reasons(String... values) {
        String content = String.join("\n", values == null ? new String[0] : values);
        List<String> reasons = new ArrayList<>();
        if (LEGACY_DATE.matcher(content).find()) {
            reasons.add("LEGACY_DATE_EXPRESSION");
        }
        if (RAW_SQL.matcher(content).find()) {
            reasons.add("RAW_SQL_REVIEW");
        }
        return reasons;
    }
}
