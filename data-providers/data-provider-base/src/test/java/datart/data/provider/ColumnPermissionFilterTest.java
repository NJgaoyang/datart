package datart.data.provider;

import datart.core.base.consts.ValueType;
import datart.core.data.provider.*;
import datart.core.data.provider.sql.FunctionColumn;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ColumnPermissionFilterTest {

    private Dataframe frame(String name) {
        Dataframe df = new Dataframe();
        df.setColumns(new ArrayList<>(List.of(Column.of(ValueType.STRING, name))));
        df.setRows(new ArrayList<>(List.of(new ArrayList<>(List.of("visible")))));
        return df;
    }

    @Test
    void doesNotGrantIdentifierSubstrings() {
        Dataframe df = frame("secret_id");
        ExecuteParam param = ExecuteParam.builder()
                .includeColumns(Set.of(SelectColumn.of(null, "id"))).build();
        ColumnPermissionFilter.mask(df, param);
        assertNull(df.getRows().get(0).get(0));
    }

    @Test
    void restoresPermissionIdentityAcrossOrdinalTransportAliases() {
        Dataframe df = frame("__fcol_0");
        QueryOutputProjection projection = new QueryOutputProjection();
        projection.setOrdinal(0);
        projection.setTechnicalAlias("city");
        ExecuteParam param = ExecuteParam.builder()
                .columns(List.of(SelectColumn.of("city", "city")))
                .outputProjections(List.of(projection))
                .includeColumns(Set.of(SelectColumn.of(null, "city"))).build();
        ColumnPermissionFilter.mask(df, param);
        assertEquals("visible", df.getRows().get(0).get(0));
    }

    @Test
    void requiresEverySourceOfComputedField() {
        Dataframe df = frame("__fcol_0");
        QueryOutputProjection p = new QueryOutputProjection();
        p.setOrdinal(0);
        p.setTechnicalAlias("ratio");
        FunctionColumn f = new FunctionColumn();
        f.setAlias("ratio");
        f.setSnippet("a / b");
        ExecuteParam param = ExecuteParam.builder()
                .columns(List.of(SelectColumn.of("ratio", "ratio")))
                .functionColumns(List.of(f))
                .outputProjections(List.of(p))
                .includeColumns(Set.of(SelectColumn.of(null, "a"))).build();
        ColumnPermissionFilter.mask(df, param);
        assertNull(df.getRows().get(0).get(0));
        df.getRows().get(0).set(0, "visible");
        param.setIncludeColumns(Set.of(SelectColumn.of(null, "a"), SelectColumn.of(null, "b")));
        ColumnPermissionFilter.mask(df, param);
        assertEquals("visible", df.getRows().get(0).get(0));
    }

    @Test
    void emptyOrUnknownPermissionsMustNotRevealColumns() {
        Dataframe df = frame("city");
        ColumnPermissionFilter.mask(df, ExecuteParam.builder()
                .includeColumns(Set.of()).build());
        assertNull(df.getRows().get(0).get(0));
    }
}
