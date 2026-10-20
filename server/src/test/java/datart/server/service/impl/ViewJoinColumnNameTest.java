package datart.server.service.impl;

import datart.core.entity.View;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ViewJoinColumnNameTest {

    @Test
    void keepsSqlOutputColumnWithDotsWhenJoiningComposedViewsAgain() {
        View composed = new View();
        composed.setType("SQL");
        assertEquals("db.users.id", ViewServiceImpl.resolveInputColumnName(composed, "db.users.id"));
        View physical = new View();
        physical.setType("STRUCT");
        assertEquals("id", ViewServiceImpl.resolveInputColumnName(physical, "db.users.id"));
    }
    @Test
    void joinVariableScopingPreservesSeparateValuesAndExactNames() {
        String sql = "SELECT * FROM sales WHERE city=${city} AND team=$team$ AND city_code=${city_code}";
        String left = ViewServiceImpl.namespaceSqlVariables(sql, "__join0__",
                java.util.Set.of("city", "team"));
        String right = ViewServiceImpl.namespaceSqlVariables(sql, "__join1__",
                java.util.Set.of("city", "team"));
        org.junit.jupiter.api.Assertions.assertTrue(left.contains("${__join0__city}"));
        org.junit.jupiter.api.Assertions.assertTrue(right.contains("${__join1__city}"));
        org.junit.jupiter.api.Assertions.assertTrue(left.contains("$__join0__team$"));
        org.junit.jupiter.api.Assertions.assertTrue(left.contains("${city_code}"));
        org.junit.jupiter.api.Assertions.assertFalse(left.contains("${__join1__city}"));
    }

}
