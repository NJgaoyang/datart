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

package datart.data.provider.jdbc;

import com.alibaba.druid.pool.DruidDataSource;
import com.alibaba.druid.pool.DruidDataSourceFactory;
import datart.data.provider.JdbcDataProvider;
import lombok.extern.slf4j.Slf4j;

import javax.sql.DataSource;
import java.util.Properties;

@Slf4j
public class DataSourceFactoryDruidImpl implements DataSourceFactory<DruidDataSource> {

    @Override
    public DruidDataSource createDataSource(JdbcProperties jdbcProperties) throws Exception {
        Properties properties = configDataSource(jdbcProperties);
        DruidDataSource druidDataSource = (DruidDataSource) DruidDataSourceFactory.createDataSource(properties);
        druidDataSource.setBreakAfterAcquireFailure(true);
        druidDataSource.setConnectionErrorRetryAttempts(0);
        log.info("druid data source created ({})", druidDataSource.getName());
        return druidDataSource;
    }

    @Override
    public void destroy(DataSource dataSource) {
        ((DruidDataSource) dataSource).close();
    }

    private Properties configDataSource(JdbcProperties properties) {
        Properties pro = new Properties();
        //connect params
        pro.setProperty(DruidDataSourceFactory.PROP_DRIVERCLASSNAME, properties.getDriverClass());
        pro.setProperty(DruidDataSourceFactory.PROP_URL, properties.getUrl());
        if (properties.getUser() != null) {
            pro.setProperty(DruidDataSourceFactory.PROP_USERNAME, properties.getUser());
        }
        if (properties.getPassword() != null) {
            pro.setProperty(DruidDataSourceFactory.PROP_PASSWORD, properties.getPassword());
        }
        pro.setProperty(DruidDataSourceFactory.PROP_MAXWAIT, JdbcDataProvider.DEFAULT_MAX_WAIT.toString());

        // Connection keepalive and validation configuration
        // These prevent "Communications link failure" caused by idle connections
        // being dropped by the server (StarRocks, MySQL, etc.) or intermediate proxies.
        pro.setProperty(DruidDataSourceFactory.PROP_TESTWHILEIDLE, "true");
        pro.setProperty(DruidDataSourceFactory.PROP_TESTONBORROW, "false");
        pro.setProperty(DruidDataSourceFactory.PROP_TESTONRETURN, "false");
        pro.setProperty(DruidDataSourceFactory.PROP_VALIDATIONQUERY, "SELECT 1");
        pro.setProperty("validationQueryTimeout", "3");
        pro.setProperty(DruidDataSourceFactory.PROP_TIMEBETWEENEVICTIONRUNSMILLIS, "30000");
        pro.setProperty(DruidDataSourceFactory.PROP_MINEVICTABLEIDLETIMEMILLIS, "60000");
        pro.setProperty("keepAlive", "true");
        pro.setProperty("keepAliveBetweenTimeMillis", "30000");
        pro.setProperty("phyMaxUseCount", "1000");
        // Disable MySQL COM_PING in favor of validationQuery for consistency across all database types
        pro.setProperty("druid.mysql.usePingMethod", "false");

        // Conservative defaults prevent every source from pre-allocating a large
        // pool. Individual high-concurrency sources can override these properties.
        pro.setProperty(DruidDataSourceFactory.PROP_INITIALSIZE, "1");
        pro.setProperty(DruidDataSourceFactory.PROP_MINIDLE, "1");
        pro.setProperty(DruidDataSourceFactory.PROP_MAXACTIVE, "16");

        //opt config (user properties can override the above defaults)
        if (properties.getProperties() != null) {
            pro.putAll(properties.getProperties());
        }
        return pro;
    }
}
