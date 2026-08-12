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

package datart.server.job;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.common.Application;
import datart.core.common.TransactionHelper;
import datart.core.common.UUIDGenerator;
import datart.core.data.provider.SchemaItem;
import datart.core.data.provider.TableInfo;
import datart.core.entity.Source;
import datart.core.entity.SourceSchemas;
import datart.core.entity.User;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import datart.core.mappers.ext.UserMapperExt;
import datart.security.manager.DatartSecurityManager;
import datart.server.service.DataProviderService;
import datart.server.service.SourceService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.quartz.*;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;

import java.io.Closeable;
import java.io.IOException;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

@Slf4j
public class SchemaSyncJob implements Job, Closeable {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static final String SOURCE_ID = "SOURCE_ID";

    private final DataProviderService dataProviderService;

    private final SourceSchemasMapperExt sourceSchemasMapper;

    public SchemaSyncJob() {
        this(null, null);
    }

    SchemaSyncJob(DataProviderService dataProviderService, SourceSchemasMapperExt sourceSchemasMapper) {
        this.dataProviderService = dataProviderService;
        this.sourceSchemasMapper = sourceSchemasMapper;
    }

    @Override
    public void close() throws IOException {
    }

    @Override
    public void execute(JobExecutionContext context) throws JobExecutionException {
        String sourceId = (String) context.getMergedJobDataMap().get(SOURCE_ID);
        try {
            Source source = null;
            try {
                source = Application.getBean(SourceService.class).retrieve(sourceId, false);
            } catch (Exception ignored) {
            }
            // remove job if source not exists
            if (source == null) {
                JobKey key = context.getJobDetail().getKey();
                Application.getBean(Scheduler.class).deleteJob(key);
                log.warn("source {} not exists , the job has been deleted ", sourceId);
                return;
            }
            login(source);
            execute(sourceId);
        } catch (Exception e) {
            log.error("source schema sync error ", e);
        } finally {
            releaseLogin();
        }
    }

    public boolean execute(String sourceId) throws Exception {
        loginBySourceId(sourceId);
        try {
            List<SchemaItem> schemaItems = new LinkedList<>();
            DataProviderService dataProviderService = this.dataProviderService == null
                    ? Application.getBean(DataProviderService.class)
                    : this.dataProviderService;
            Set<String> databases = dataProviderService.readAllDatabases(sourceId);
            if (CollectionUtils.isNotEmpty(databases)) {
                for (String database : databases) {
                    SchemaItem schemaItem = new SchemaItem();
                    schemaItem.setDbName(database);
                    schemaItem.setTables(new LinkedList<>());
                    Set<String> tables;
                    try {
                        tables = dataProviderService.readTables(sourceId, database);
                    } catch (Exception e) {
                        throw new IllegalStateException(
                                String.format("Failed to sync database schema: %s", database), e);
                    }
                    if (CollectionUtils.isNotEmpty(tables)) {
                        for (String table : tables) {
                            try {
                                TableInfo tableInfo = new TableInfo();
                                tableInfo.setTableName(table);
                                tableInfo.setColumns(dataProviderService.readTableColumns(sourceId, database, table));
                                schemaItem.getTables().add(tableInfo);
                            } catch (Exception e) {
                                throw new IllegalStateException(
                                        String.format("Failed to sync table schema: %s.%s", database, table), e);
                            }
                        }
                    }
                    schemaItems.add(schemaItem);
                }
            }
            upsertSchemaInfo(sourceId, schemaItems);
            return true;
        } finally {
            releaseLogin();
        }
    }

    private void login(Source source) {
        if (source == null || StringUtils.isBlank(source.getCreateBy())) {
            return;
        }
        UserMapperExt userMapper = Application.getBean(UserMapperExt.class);
        User user = userMapper.selectByPrimaryKey(source.getCreateBy());
        if (user != null) {
            Application.getBean(DatartSecurityManager.class).runAs(user.getUsername());
        }
    }

    private void loginBySourceId(String sourceId) {
        try {
            Source source = Application.getBean(SourceService.class).retrieve(sourceId, false);
            login(source);
        } catch (Exception e) {
            log.warn("Failed to login for schema sync on source {}", sourceId, e);
        }
    }

    private void releaseLogin() {
        try {
            Application.getBean(DatartSecurityManager.class).releaseRunAs();
        } catch (Exception ignored) {
        }
    }

    private void upsertSchemaInfo(String sourceId, List<SchemaItem> schemaItems) {
        TransactionStatus transaction = TransactionHelper.getTransaction(TransactionDefinition.PROPAGATION_REQUIRES_NEW, TransactionDefinition.ISOLATION_REPEATABLE_READ);
        try {
            SourceSchemasMapperExt mapper = sourceSchemasMapper == null
                    ? Application.getBean(SourceSchemasMapperExt.class)
                    : sourceSchemasMapper;
            SourceSchemas sourceSchemas = mapper.selectBySource(sourceId);
            int affectedRows;
            if (sourceSchemas == null) {
                sourceSchemas = new SourceSchemas();
                sourceSchemas.setId(UUIDGenerator.generate());
                sourceSchemas.setSourceId(sourceId);
                sourceSchemas.setUpdateTime(new Date());
                sourceSchemas.setSchemas(OBJECT_MAPPER.writeValueAsString(schemaItems));
                affectedRows = mapper.insert(sourceSchemas);
            } else {
                sourceSchemas.setUpdateTime(new Date());
                sourceSchemas.setSchemas(OBJECT_MAPPER.writeValueAsString(schemaItems));
                affectedRows = mapper.updateByPrimaryKey(sourceSchemas);
            }
            if (affectedRows != 1) {
                throw new IllegalStateException("Failed to save synchronized database schema");
            }
            TransactionHelper.commit(transaction);
        } catch (Exception e) {
            TransactionHelper.rollback(transaction);
            log.error("source schema parse error ", e);
            throw new IllegalStateException("Failed to save synchronized database schema", e);
        }
    }

}
