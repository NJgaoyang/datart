/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */
package datart.data.provider.calcite;

import java.util.Arrays;
import java.util.Map;

final class TableAliasResolver {

    private TableAliasResolver() {
    }

    static void register(Map<String, String> aliases, String[] tablePath, String alias) {
        String qualifiedName = tableKey(tablePath, tablePath.length);
        aliases.put(qualifiedName, alias);

        String simpleName = tablePath[tablePath.length - 1];
        String existing = findIgnoreCase(aliases, simpleName);
        if (existing == null) {
            aliases.put(simpleName, alias);
        } else if (!existing.equals(alias)) {
            removeIgnoreCase(aliases, simpleName);
        }
    }

    static String resolve(Map<String, String> aliases, String[] columnPath) {
        if (aliases == null || aliases.isEmpty() || columnPath == null || columnPath.length < 2) {
            return null;
        }

        String qualifiedTable = tableKey(columnPath, columnPath.length - 1);
        String alias = findIgnoreCase(aliases, qualifiedTable);
        if (alias != null) {
            return alias;
        }
        return findIgnoreCase(aliases, columnPath[columnPath.length - 2]);
    }

    private static String tableKey(String[] path, int endExclusive) {
        return String.join(".", Arrays.copyOf(path, endExclusive));
    }

    private static String findIgnoreCase(Map<String, String> aliases, String key) {
        String exact = aliases.get(key);
        if (exact != null) {
            return exact;
        }
        return aliases.entrySet().stream()
                .filter(entry -> entry.getKey().equalsIgnoreCase(key))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private static void removeIgnoreCase(Map<String, String> aliases, String key) {
        aliases.keySet().removeIf(existing -> existing.equalsIgnoreCase(key));
    }
}
