package datart.data.provider;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import datart.core.base.exception.Exceptions;
import datart.core.common.FileUtils;
import datart.core.common.MessageResolver;
import datart.core.data.provider.*;
import datart.data.provider.base.DataProviderException;
import datart.data.provider.calcite.SqlParserUtils;
import datart.data.provider.calcite.dialect.SqlStdOperatorSupport;
import datart.data.provider.jdbc.DataSourceFactory;
import datart.data.provider.jdbc.DataSourceFactoryDruidImpl;
import datart.data.provider.jdbc.JdbcDriverInfo;
import datart.data.provider.jdbc.JdbcProperties;
import datart.data.provider.jdbc.adapters.JdbcDataProviderAdapter;
import lombok.extern.slf4j.Slf4j;
import org.apache.calcite.sql.SqlDialect;
import org.apache.commons.lang3.StringUtils;
import org.springframework.util.CollectionUtils;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import javax.sql.DataSource;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.sql.SQLException;
import java.util.*;
import java.util.concurrent.ConcurrentSkipListMap;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
public class JdbcDataProvider extends DataProvider {

    public static final String DEFAULT_ADAPTER = "datart.data.provider.jdbc.adapters.JdbcDataProviderAdapter";

    private static final String JDBC_DRIVER_BUILD_IN = "/jdbc-driver.yml";

    private static final String JDBC_DRIVER_EXT = "config/jdbc-driver-ext.yml";

    public static final String DB_TYPE = "dbType";

    public static final String USER = "user";

    public static final String PASSWORD = "password";

    public static final String URL = "url";

    public static final String DRIVER_CLASS = "driverClass";

    public static final String ENABLE_SPECIAL_SQL = "enableSpecialSQL";

    private static final String I18N_PREFIX = "config.template.jdbc.";

    /**
     * 获取连接时最大等待时间（毫秒）
     */
    public static final Integer DEFAULT_MAX_WAIT = 5000;

    private final Map<String, JdbcDataProviderAdapter> cachedProviders = new ConcurrentSkipListMap<>();

    @Override
    public Object test(DataProviderSource source) {
        JdbcProperties jdbcProperties = conv2JdbcProperties(source);
        return ProviderFactory.createDataProvider(jdbcProperties, false).test(jdbcProperties);
    }

    @Override
    public Set<String> readAllDatabases(DataProviderSource source) throws SQLException {
        JdbcDataProviderAdapter adapter = matchProviderAdapter(source);
        return adapter.readAllDatabases();
    }

    @Override
    public Set<String> readTables(DataProviderSource source, String database) throws SQLException {
        JdbcDataProviderAdapter adapter = matchProviderAdapter(source);
        return adapter.readAllTables(database);
    }

    @Override
    public Set<Column> readTableColumns(DataProviderSource source, String database, String table) throws SQLException {
        JdbcDataProviderAdapter adapter = matchProviderAdapter(source);
        return adapter.readTableColumn(database, table);
    }

    @Override
    public Dataframe execute(DataProviderSource source, QueryScript script, ExecuteParam executeParam) throws Exception {
        JdbcDataProviderAdapter adapter = matchProviderAdapter(source);
        //If server aggregation is enabled, query the full data before performing server aggregation
        if (executeParam.isServerAggregate() && !script.isTest()) {
            return adapter.executeInLocal(script, executeParam);
        } else {
            return adapter.executeOnSource(script, executeParam);
        }
    }

    @Override
    public String renderSql(DataProviderSource source, QueryScript script, ExecuteParam executeParam) throws Exception {
        return matchProviderAdapter(source).renderSql(script, executeParam);
    }

    @Override
    public String getType() {
        try {
            return getBaseInfo().getType();
        } catch (IOException e) {
            log.error("The JDBC Data Provider configuration file resolves error", e);
        }
        return null;
    }

    // Pattern to detect dangerous H2 connection parameters that can lead to RCE
    private static final Pattern DANGEROUS_H2_PARAM = Pattern.compile(
            "(?i)(;|&)(INIT|TRIGGER|ALIAS)=.*?(?=[;&]|$)"
    );
    // Pattern to detect RUNSCRIPT with URL scheme (http/https) in H2 connection
    private static final Pattern H2_RUNSCRIPT_URL = Pattern.compile(
            "(?i)RUNSCRIPT\\s+FROM\\s+['\"]?(https?|ftp)://"
    );

    private JdbcProperties conv2JdbcProperties(DataProviderSource config) {
        JdbcProperties jdbcProperties = new JdbcProperties();
        jdbcProperties.setDbType(config.getProperties().get(DB_TYPE).toString().toUpperCase());
        String rawUrl = config.getProperties().get(URL).toString();
        jdbcProperties.setUrl(appendDefaultConnectionParams(
                sanitizeJdbcUrl(rawUrl, jdbcProperties.getDbType()), jdbcProperties.getDbType()));
        Object user = config.getProperties().get(USER);
        if (user != null && StringUtils.isNotBlank(user.toString())) {
            jdbcProperties.setUser(user.toString());
        }
        Object password = config.getProperties().get(PASSWORD);
        if (password != null && StringUtils.isNotBlank(password.toString())) {
            jdbcProperties.setPassword(password.toString());
        }
        String driverClass = config.getProperties().getOrDefault(DRIVER_CLASS, "").toString();
        jdbcProperties.setDriverClass(StringUtils.isBlank(driverClass) ?
                ProviderFactory.getJdbcDriverInfo(jdbcProperties.getDbType()).getDriverClass() :
                driverClass);

        Object enableSpecialSQL = config.getProperties().get(ENABLE_SPECIAL_SQL);

        if (enableSpecialSQL != null && "true".equals(enableSpecialSQL.toString())) {
            jdbcProperties.setEnableSpecialSql(true);
        }

        Object properties = config.getProperties().get("properties");
        if (properties != null) {
            if (properties instanceof Map) {
                Properties prop = new Properties();
                prop.putAll((Map) properties);
                jdbcProperties.setProperties(prop);
            }
        }
        return jdbcProperties;
    }

    /**
     * Sanitize JDBC URL to prevent RCE through dangerous connection parameters (CVE-2025-56819).
     * Blocks H2 INIT/RUNSCRIPT/TRIGGER/ALIAS parameters that could execute arbitrary code,
     * and restricts file-based H2 URLs for sensitive file reading (CVE-2025-70829).
     */
    static String sanitizeJdbcUrl(String url, String dbType) {
        if (url == null || StringUtils.isBlank(url)) {
            return url;
        }
        // Only apply stricter checks for H2 databases
        if ("H2".equalsIgnoreCase(dbType)) {
            // Block dangerous H2 connection parameters: INIT, TRIGGER, ALIAS
            if (DANGEROUS_H2_PARAM.matcher(url).find()) {
                Exceptions.tr(DataProviderException.class,
                        "message.provider.jdbc.url.rejected",
                        "Dangerous H2 connection parameter detected (INIT/TRIGGER/ALIAS). Use a safe connection URL.");
            }
            // Block RUNSCRIPT with remote URL
            if (H2_RUNSCRIPT_URL.matcher(url).find()) {
                Exceptions.tr(DataProviderException.class,
                        "message.provider.jdbc.url.rejected",
                        "Remote RUNSCRIPT detected in H2 URL. This is not allowed for security reasons.");
            }
            // Prevent file-based H2 connections from reading arbitrary system files
            // Only allow connections to the designated files directory
            if (url.matches("(?i)jdbc:h2:file:(?!.*?files/h2/dbs/).*")) {
                Exceptions.tr(DataProviderException.class,
                        "message.provider.jdbc.url.rejected",
                        "File-based H2 connections are restricted to the application data directory.");
            }
        }
        return url;
    }

    /**
     * StarRocks/Doris 的 FE MySQL 协议端口不支持 SSL，而 mysql-connector-j 8.x 默认 sslMode=PREFERRED
     * 会先尝试 SSL 协商，服务端不支持时会直接断开连接，表现为
     * Communications link failure / EOFException（Can not read response from server）导致同步库表、查询失败。
     * 对这两类数据源在用户未显式配置 SSL 参数时默认追加 useSSL=false。
     */
    static String appendDefaultConnectionParams(String url, String dbType) {
        if (url == null || StringUtils.isBlank(url)) {
            return url;
        }
        boolean needDisableSsl = "STARROCKS".equalsIgnoreCase(dbType) || "DORIS".equalsIgnoreCase(dbType);
        if (!needDisableSsl) {
            return url;
        }
        String lower = url.toLowerCase();
        // 用户已显式配置 SSL 参数时尊重其配置，不覆盖
        if (lower.contains("usessl=") || lower.contains("sslmode=")) {
            return url;
        }
        return url + (url.contains("?") ? "&" : "?") + "useSSL=false";
    }

    private JdbcDataProviderAdapter matchProviderAdapter(DataProviderSource source) {
        JdbcDataProviderAdapter adapter;
        adapter = cachedProviders.get(source.getSourceId());
        if (adapter != null) {
            return adapter;
        }
        adapter = ProviderFactory.createDataProvider(conv2JdbcProperties(source), true);
        cachedProviders.put(source.getSourceId(), adapter);
        return adapter;
    }

    @Override
    public Set<StdSqlOperator> supportedStdFunctions(DataProviderSource source) {

        SqlDialect sqlDialect = matchProviderAdapter(source).getSqlDialect();

        if (!(sqlDialect instanceof SqlStdOperatorSupport)) {
            return super.supportedStdFunctions(source);
        }

        return ((SqlStdOperatorSupport) sqlDialect).supportedOperators();
    }

    @Override
    public boolean validateFunction(DataProviderSource source, String snippet) {
        try {
            SqlParserUtils.parseSnippet(snippet);
        } catch (Exception e) {
            Exceptions.e(e);
        }
        return true;
    }

    public DataProviderConfigTemplate getConfigTemplate() throws IOException {
        DataProviderConfigTemplate configTemplate = super.getConfigTemplate();
        for (DataProviderConfigTemplate.Attribute attribute : configTemplate.getAttributes()) {
            attribute.setDisplayName(MessageResolver.getMessage("config.template.jdbc." + attribute.getName()));
            if (attribute.getName().equals("dbType")) {
                List<JdbcDriverInfo> jdbcDriverInfos = ProviderFactory.loadDriverInfoFromResource();
                List<Object> dbInfos = jdbcDriverInfos.stream().map(info -> {
                    Properties properties = new Properties();
                    properties.setProperty(DB_TYPE, info.getDbType());
                    properties.setProperty(URL, info.getUrlPrefix() == null ? "" : info.getUrlPrefix());
                    properties.setProperty(DRIVER_CLASS, info.getDriverClass() == null ? "" : info.getDriverClass());
                    return properties;
                }).collect(Collectors.toList());
                attribute.setOptions(dbInfos);
            }
        }
        return configTemplate;
    }

    @Override
    public String getConfigDisplayName(String name) {
        return MessageResolver.getMessage(I18N_PREFIX + name);
    }

    @Override
    public String getConfigDescription(String name) {
        String message = MessageResolver.getMessage(I18N_PREFIX + name + ".desc");
        if (message.startsWith(I18N_PREFIX)) {
            return null;
        } else {
            return message;
        }
    }

    @Override
    public String getQueryKey(DataProviderSource config, QueryScript script, ExecuteParam executeParam) throws Exception {
        JdbcDataProviderAdapter adapter = matchProviderAdapter(config);
        return adapter.getQueryKey(script, executeParam);
    }

    @Override
    public void close() throws IOException {

    }

    public static DataSourceFactory<? extends DataSource> getDataSourceFactory() {
        return new DataSourceFactoryDruidImpl();
    }


    public static class ProviderFactory {

        private static final Map<String, JdbcDriverInfo> jdbcDriverInfoMap = new ConcurrentSkipListMap<>();

        public static JdbcDataProviderAdapter createDataProvider(JdbcProperties prop, boolean init) {
            List<JdbcDriverInfo> jdbcDriverInfos = loadDriverInfoFromResource();

            List<JdbcDriverInfo> driverInfos = jdbcDriverInfos.stream().filter(item -> prop.getDbType().equals(item.getDbType()))
                    .collect(Collectors.toList());

            if (driverInfos.size() == 0) {
                Exceptions.tr(DataProviderException.class, "message.provider.jdbc.dbtype", prop.getDbType());
            }
            if (driverInfos.size() > 1) {
                Exceptions.msg("Duplicated dbType " + prop.getDbType());
            }
            JdbcDriverInfo driverInfo = driverInfos.get(0);

            if (StringUtils.isNotBlank(prop.getDriverClass())) {
                driverInfo.setDriverClass(prop.getDriverClass());
            }
            JdbcDataProviderAdapter adapter = null;
            try {
                if (StringUtils.isNotBlank(driverInfo.getAdapterClass())) {
                    try {
                        Class<?> aClass = Class.forName(driverInfo.getAdapterClass());
                        adapter = (JdbcDataProviderAdapter) aClass.newInstance();
                    } catch (Exception e) {
                        log.error("Jdbc adapter class (" + driverInfo.getAdapterClass() + ") load error.use default adapter");
                    }
                }
                if (adapter == null) {
                    adapter = (JdbcDataProviderAdapter) Class.forName(DEFAULT_ADAPTER).newInstance();
                }
            } catch (Exception e) {
                log.error("Jdbc adapter class load error ", e);
            }
            if (adapter == null) {
                Exceptions.tr(DataProviderException.class, "message.provider.jdbc.create.error", prop.getDbType());
            }
            if (init) {
                adapter.init(prop, driverInfo);
            }
            return adapter;
        }

        private static JdbcDriverInfo getJdbcDriverInfo(String dbType) {
            if (jdbcDriverInfoMap.isEmpty()) {
                for (JdbcDriverInfo jdbcDriverInfo : loadDriverInfoFromResource()) {
                    jdbcDriverInfoMap.put(jdbcDriverInfo.getDbType(), jdbcDriverInfo);
                }
            }
            return jdbcDriverInfoMap.get(dbType);
        }

        private static List<JdbcDriverInfo> loadDriverInfoFromResource() {

            ObjectMapper objectMapper = new ObjectMapper();
            objectMapper.setPropertyNamingStrategy(PropertyNamingStrategy.KEBAB_CASE);
            objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

            //Build in database types
            Map<String, Map<String, String>> buildIn = loadYml(JDBC_DRIVER_BUILD_IN);
            // user ext database types
            Map<String, Map<String, String>> extDrivers = loadYml(new File(FileUtils.concatPath(System.getProperty("user.dir"), JDBC_DRIVER_EXT)));
            if (!CollectionUtils.isEmpty(extDrivers)) {
                for (String key : extDrivers.keySet()) {
                    Map<String, String> driver = buildIn.get(key);
                    if (driver == null) {
                        buildIn.put(key, extDrivers.get(key));
                    } else {
                        driver.putAll(extDrivers.get(key));
                    }
                }
            }

            return buildIn.entrySet().stream().map(entry -> {
                try {
                    JdbcDriverInfo jdbcDriverInfo = objectMapper.convertValue(entry.getValue(), JdbcDriverInfo.class);
                    if (StringUtils.isBlank(jdbcDriverInfo.getAdapterClass())) {
                        jdbcDriverInfo.setAdapterClass(DEFAULT_ADAPTER);
                    }
                    // default to quote all identifiers ,  for support special column names and most databases
                    if (jdbcDriverInfo.getQuoteIdentifiers() == null) {
                        jdbcDriverInfo.setQuoteIdentifiers(true);
                    }
                    jdbcDriverInfo.setDbType(jdbcDriverInfo.getDbType().toUpperCase());
                    return jdbcDriverInfo;
                } catch (Exception e) {
                    log.error("DbType " + entry.getKey() + " driver read Exception", e);
                }
                return null;
            }).filter(Objects::nonNull).sorted(Comparator.comparing(JdbcDriverInfo::getDbType)).collect(Collectors.toList());
        }

        @SuppressWarnings("unchecked")
        private static Map<String, Map<String, String>> loadYml(String file) {
            try (InputStream inputStream = ProviderFactory.class.getResourceAsStream(file)) {
                Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions()));
                return (Map<String, Map<String, String>>) yaml.load(inputStream);
            } catch (Exception e) {
                Exceptions.e(e);
            }
            return null;
        }

        @SuppressWarnings("unchecked")
        private static Map<String, Map<String, String>> loadYml(File file) {
            try (InputStream inputStream = new FileInputStream(file)) {
                Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions()));
                return (Map<String, Map<String, String>>) yaml.load(inputStream);
            } catch (Exception e) {
                Exceptions.e(e);
            }
            return null;
        }

    }

    @Override
    public String getConfigFile() {
        return "jdbc-data-provider.json";
    }

    @Override
    public void resetSource(DataProviderSource source) {
        try {
            JdbcDataProviderAdapter adapter = cachedProviders.remove(source.getSourceId());
            if (adapter != null) {
                adapter.close();
            }
            log.info("jdbc source '{}-{}' updated, source has been reset", source.getSourceId(), source.getName());
        } catch (Exception e) {
            log.error("source reset error.", e);
        }
    }
}
