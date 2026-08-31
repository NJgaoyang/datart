package datart.core.data.provider;

import lombok.Data;

import java.io.Serializable;

/** Metadata shared by function validation, source capability APIs and the editor. */
@Data
public class FunctionDefinition implements Serializable {

    private final String name;
    private final int minArgs;
    private final int maxArgs;
    private final String returnType;
    private final String minStarRocksVersion;

    public FunctionDefinition(String name, int minArgs, int maxArgs,
                              String returnType, String minStarRocksVersion) {
        this.name = name;
        this.minArgs = minArgs;
        this.maxArgs = maxArgs;
        this.returnType = returnType;
        this.minStarRocksVersion = minStarRocksVersion;
    }
}
