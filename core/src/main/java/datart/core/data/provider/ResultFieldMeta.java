/*
 * Datart
 *
 * Licensed under the Apache License, Version 2.0
 */
package datart.core.data.provider;

import lombok.Data;

import java.io.Serializable;

/** Result metadata keyed by ordinal; column names remain technical identities. */
@Data
public class ResultFieldMeta implements Serializable {

    private String fieldId;

    private String technicalName;

    private String displayName;

    private Integer ordinal;
}
