/*
 * Datart
 *
 * Licensed under the Apache License, Version 2.0
 */
package datart.core.data.provider;

public final class QueryOutputAlias {

    private static final String PREFIX = "__fcol_";

    private QueryOutputAlias() {
    }

    public static String of(int ordinal) {
        if (ordinal < 0) {
            throw new IllegalArgumentException("ordinal must be >= 0");
        }
        return PREFIX + ordinal;
    }
}
