/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package datart.data.provider.calcite.dialect;

import datart.core.data.provider.StdSqlOperator;
import org.apache.calcite.sql.SqlCall;
import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlWriter;
import org.apache.calcite.sql.dialect.StarRocksSqlDialect;

import java.util.EnumSet;
import java.util.Set;
import java.util.concurrent.ConcurrentSkipListSet;

import static datart.core.data.provider.StdSqlOperator.*;

/**
 * StarRocks SQL dialect with datart custom operator support.
 * Extends Calcite 1.37's built-in StarRocksSqlDialect.
 */
public class StarRocksSqlStdOperatorSupport extends StarRocksSqlDialect
        implements SqlStdOperatorSupport, FetchAndOffsetSupport {

    static ConcurrentSkipListSet<StdSqlOperator> OWN_SUPPORTED = new ConcurrentSkipListSet<>(
            EnumSet.of(STDDEV, PERCENTILE_APPROX, ABS, CEILING, FLOOR, POWER, ROUND, SQRT, EXP, LOG10, LN, MOD, RAND,
                    DEGREES, RADIANS, TRUNC, SIGN,
                    ACOS, ASIN, ATAN, ATAN2, SIN, COS, TAN, COT,
                    LENGTH, CONCAT, REPLACE, SUBSTRING, LOWER, UPPER, LTRIM, RTRIM, TRIM,
                    NOW, DAY, SECOND, MINUTE, HOUR, DAY, WEEK, QUARTER, MONTH, YEAR,
                    DAY_OF_WEEK, DAY_OF_MONTH, DAY_OF_YEAR,
                    IF, COALESCE,
                    AGG_DATE_YEAR, AGG_DATE_QUARTER, AGG_DATE_MONTH, AGG_DATE_WEEK, AGG_DATE_DAY,
                    AGG_DATE_HOUR, AGG_DATE_MINUTE, AGG_DATE_SECOND,
                    AGG_DATE_YEAR_NATIVE, AGG_DATE_QUARTER_NATIVE, AGG_DATE_MONTH_NATIVE,
                    AGG_DATE_WEEK_NATIVE, AGG_DATE_DAY_NATIVE, AGG_DATE_HOUR_NATIVE,
                    AGG_DATE_MINUTE_NATIVE, AGG_DATE_SECOND_NATIVE, TIME_SLICE));

    static {
        OWN_SUPPORTED.addAll(SUPPORTED);
    }

    public StarRocksSqlStdOperatorSupport() {
        this(DEFAULT_CONTEXT);
    }

    private StarRocksSqlStdOperatorSupport(Context context) {
        super(context);
    }

    @Override
    public void unparseCall(SqlWriter writer, SqlCall call, int leftPrec, int rightPrec) {
        if (unparsePercentileApprox(writer, call)) {
            return;
        }
        if (isStdSqlOperator(call) && unparseStdSqlOperator(writer, call, leftPrec, rightPrec)) {
            return;
        }
        super.unparseCall(writer, call, leftPrec, rightPrec);
    }

    private boolean unparsePercentileApprox(SqlWriter writer, SqlCall call) {
        if (call.getKind() != SqlKind.WITHIN_GROUP || !(call.operand(0) instanceof SqlCall)) {
            return false;
        }
        SqlCall percentile = call.operand(0);
        if (!"PERCENTILE_CONT".equalsIgnoreCase(percentile.getOperator().getName())
                || percentile.operandCount() != 1 || !(call.operand(1) instanceof SqlNodeList)) {
            return false;
        }
        SqlNodeList orderList = call.operand(1);
        if (orderList.size() < 1 || orderList.size() > 2) {
            return false;
        }
        SqlWriter.Frame frame = writer.startFunCall(PERCENTILE_APPROX.getSymbol());
        orderList.get(0).unparse(writer, 0, 0);
        writer.sep(",");
        percentile.operand(0).unparse(writer, 0, 0);
        if (orderList.size() == 2) {
            writer.sep(",");
            orderList.get(1).unparse(writer, 0, 0);
        }
        writer.endFunCall(frame);
        return true;
    }

    @Override
    public boolean unparseStdSqlOperator(SqlWriter writer, SqlCall call, int leftPrec, int rightPrec) {
        StdSqlOperator operator = symbolOf(call.getOperator().getName());
        switch (operator) {
            case TRUNC:
                return unparseFunctionCall(writer, "TRUNCATE", call);
            case DAY_OF_WEEK:
                return unparseFunctionCall(writer, "DAYOFWEEK", call);
            case DAY_OF_MONTH:
                return unparseFunctionCall(writer, "DAYOFMONTH", call);
            case DAY_OF_YEAR:
                return unparseFunctionCall(writer, "DAYOFYEAR", call);
            case AGG_DATE_YEAR:
                writer.print("YEAR(" + call.getOperandList().get(0).toSqlString(this).getSql() + ")");
                return true;
            case AGG_DATE_QUARTER: {
                String columnName = call.getOperandList().get(0).toSqlString(this).getSql();
                writer.print("CONCAT(DATE_FORMAT(" + columnName + ",'%Y-'),QUARTER(" + columnName + "))");
                return true;
            }
            case AGG_DATE_MONTH:
                writer.print("DATE_FORMAT(" + call.getOperandList().get(0).toSqlString(this).getSql() + ",'%Y-%m')");
                return true;
            case AGG_DATE_WEEK:
                writer.print("DATE_FORMAT(" + call.getOperandList().get(0).toSqlString(this).getSql() + ",'%x-%v')");
                return true;
            case AGG_DATE_DAY:
                writer.print("DATE_FORMAT(" + call.getOperandList().get(0).toSqlString(this).getSql() + ",'%Y-%m-%d')");
                return true;
            case AGG_DATE_HOUR:
                return unparseDateFormat(writer, "%Y-%m-%d %H", call);
            case AGG_DATE_MINUTE:
                return unparseDateFormat(writer, "%Y-%m-%d %H:%i", call);
            case AGG_DATE_SECOND:
                return unparseDateFormat(writer, "%Y-%m-%d %H:%i:%s", call);
            case AGG_DATE_YEAR_NATIVE:
                return unparseDateTrunc(writer, "year", call, true);
            case AGG_DATE_QUARTER_NATIVE:
                return unparseDateTrunc(writer, "quarter", call, true);
            case AGG_DATE_MONTH_NATIVE:
                return unparseDateTrunc(writer, "month", call, true);
            case AGG_DATE_WEEK_NATIVE:
                return unparseDateTrunc(writer, "week", call, true);
            case AGG_DATE_DAY_NATIVE:
                return unparseDateTrunc(writer, "day", call, true);
            case AGG_DATE_HOUR_NATIVE:
                return unparseDateTrunc(writer, "hour", call, false);
            case AGG_DATE_MINUTE_NATIVE:
                return unparseDateTrunc(writer, "minute", call, false);
            case AGG_DATE_SECOND_NATIVE:
                return unparseDateTrunc(writer, "second", call, false);
            default:
                break;
        }
        return false;
    }

    private boolean unparseDateTrunc(SqlWriter writer, String unit, SqlCall call, boolean asDate) {
        writer.print(asDate ? "CAST(DATE_TRUNC('" : "DATE_TRUNC('");
        writer.print(unit);
        writer.print("', ");
        call.getOperandList().get(0).unparse(writer, 0, 0);
        writer.print(asDate ? ") AS DATE)" : ")");
        return true;
    }

    private boolean unparseDateFormat(SqlWriter writer, String format, SqlCall call) {
        writer.print("DATE_FORMAT(" + call.getOperandList().get(0).toSqlString(this).getSql()
                + ",'" + format + "')");
        return true;
    }

    @Override
    public void quoteStringLiteral(StringBuilder buf, String charsetName, String val) {
        buf.append(literalQuoteString);
        buf.append(val.replace(literalEndQuoteString, literalEscapedQuote));
        buf.append(literalEndQuoteString);
    }

    @Override
    public Set<StdSqlOperator> supportedOperators() {
        return OWN_SUPPORTED;
    }
}
