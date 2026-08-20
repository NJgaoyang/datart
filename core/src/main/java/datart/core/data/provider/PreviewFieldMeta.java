/*
 * Datart
 *
 * Licensed under the Apache License, Version 2.0
 */
package datart.core.data.provider;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * Read-only field metadata used by an unsaved query preview.
 * It deliberately has no field id because it is never persisted.
 */
@Data
public class PreviewFieldMeta implements Serializable {

    private String originName;

    private List<String> sourcePath;

    private String sourceComment;

    private String displayName;

    private String type;

    private String category;

    private String expression;
}
