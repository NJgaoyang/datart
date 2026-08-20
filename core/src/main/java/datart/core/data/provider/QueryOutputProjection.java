/*
 * Datart
 *
 * Licensed under the Apache License, Version 2.0
 */
package datart.core.data.provider;

import lombok.Data;

import java.io.Serializable;

/** Separates stable query result identity from the business label shown to users. */
@Data
public class QueryOutputProjection implements Serializable {

    private String fieldId;

    private String technicalAlias;

    private String displayAlias;

    private Integer ordinal;
}
