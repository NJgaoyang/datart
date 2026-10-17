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
}
