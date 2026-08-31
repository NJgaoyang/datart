package datart.data.provider.jdbc;

import datart.core.base.consts.ValueType;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.sql.Types;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DataTypeUtilsTest {

    @Test
    void keepsDateAndDatetimeDistinct() {
        assertEquals(ValueType.DATE, DataTypeUtils.jdbcType2DataType(Types.DATE));
        assertEquals(ValueType.DATETIME, DataTypeUtils.jdbcType2DataType(Types.TIMESTAMP));
        assertEquals(ValueType.DATE, DataTypeUtils.javaType2DataType(java.sql.Date.valueOf("2026-08-17")));
        assertEquals(ValueType.DATETIME, DataTypeUtils.javaType2DataType(Timestamp.valueOf("2026-08-17 12:30:00")));
        assertEquals(ValueType.DATETIME, DataTypeUtils.javaType2DataType(LocalDateTime.of(2026, 8, 17, 12, 30)));
        assertEquals(Types.DATE, DataTypeUtils.valueType2SqlTypes(ValueType.DATE));
        assertEquals(Types.TIMESTAMP, DataTypeUtils.valueType2SqlTypes(ValueType.DATETIME));
    }
}
