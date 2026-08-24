package datart.server.common.strict;

import datart.core.base.exception.NotAllowedException;

public class StrictFieldReferenceException extends NotAllowedException {

    public StrictFieldReferenceException(String code, String detail) {
        super(code + (detail == null ? "" : ": " + detail));
    }
}
