/*
@Api_Name         : /AddConnector,
@Description      : To Add a New Connector in the Table
@Last_Error_code  : ERR-ADD-CONN-00008
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqUuid = require('uuid');

var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqSvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')


router.post('/AddConnector', function (appRequest, appResponse) {
    try {
        var ServiceName = 'AddConnector';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        params.connector_name = params.connector_name.trim();
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Add_Connector';
            reqTranDBHelper.GetTranDBConn(pHeaders, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    reqInstanceHelper.PrintInfo(ServiceName, 'Adding New Connector...', objLogInfo);
                    reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                            var cond = {};
                            cond.setup_code = 'KAFKA_CONNECTOR_CONFIG';
                            var KAFKA_CONNECTOR_CONFIG = {};
                            reqSvchelper.GetSetupJson(clt_cas_instance, cond, objLogInfo, function (res) {
                                if (res.Status == 'SUCCESS') {
                                    if (res.Data.length) {
                                        var setup_json = JSON.parse(res.Data[0].setup_json);
                                        if (setup_json) {
                                            KAFKA_CONNECTOR_CONFIG = setup_json;
                                        }
                                    }
                                    var pTable = "CONNECTORS";
                                    var clientConfig = JSON.parse(params.config);
                                    if (params && !params.SKIP_PARAMS) {
                                        var connect_config = {};
                                        var connector_for = clientConfig.connector_for;
                                        connect_config['tasks.max'] = '1';
                                        connect_config['value.converter'] = 'org.apache.kafka.connect.json.JsonConverter';
                                        connect_config['value.converter.schemas.enable'] = 'false';
                                        connect_config['key.converter.schemas.enable'] = 'false';
                                        connect_config['key.converter'] = 'org.apache.kafka.connect.json.JsonConverter';
                                        reqInstanceHelper.PrintInfo(ServiceName, 'Connector Method - ' + clientConfig.connector_method, objLogInfo);
                                        reqInstanceHelper.PrintInfo(ServiceName, 'Connector Type - ' + clientConfig.connector_type, objLogInfo);
                                        reqInstanceHelper.PrintInfo(ServiceName, 'Connector Mode - ' + clientConfig.connector_mode, objLogInfo);
                                        reqInstanceHelper.PrintInfo(ServiceName, 'Connector For - ' + connector_for, objLogInfo);
                                        if (clientConfig.connector_type.toUpperCase() == 'SOURCE' || (clientConfig.connector_type.toUpperCase() == 'SINK' && connector_for.toUpperCase() == 'DATABASE')) {
                                            // Reusing the Same Code for Both Source and Sink Connectors for Database
                                            reqInstanceHelper.PrintInfo(ServiceName, 'Connector Table List- ' + clientConfig.connector_table_list, objLogInfo);
                                            reqInstanceHelper.PrintInfo(ServiceName, 'Connector Table Column Name - ' + clientConfig.table_column_name, objLogInfo);
                                            if (clientConfig.connector_method.toUpperCase() == 'JDBC') {
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Connector Method - ' + clientConfig.connector_method, objLogInfo);
                                                reqInstanceHelper.PrintInfo(ServiceName, 'No. Of Connection Attempt - ' + KAFKA_CONNECTOR_CONFIG.CONNECTION_ATTEMPT, objLogInfo);
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Connection Retry Attempt in Ms - ' + KAFKA_CONNECTOR_CONFIG.CONNECTION_ATTEMPT_MS, objLogInfo);
                                                connect_config['connection.attempts'] = KAFKA_CONNECTOR_CONFIG.CONNECTION_ATTEMPT || '100';
                                                connect_config['connection.backoff.ms'] = KAFKA_CONNECTOR_CONFIG.CONNECTION_ATTEMPT_MS || '10000';
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Checking DB_TYPE from the Tran DB Config...', objLogInfo);
                                                connect_config['connection.user'] = '$TRANDB_USER';
                                                connect_config['connection.password'] = '$TRANDB_PASSWORD';
                                                // Sample Pattern For Postgres- jdbc: postgresql://IP:Port/You_DB_Name 
                                                // Sample Pattern For Oracle - jdbc:oracle:thin:@//IP:Port/You_DB_Name
                                                connect_config['connection.url'] = '$JDBC_URL_PREFIX//$TRANDB_SERVER:$TRANDB_PORT/$TRANDB_NAME';
                                                // connect_config['connection.url'] = 'jdbc:oracle:thin:@//$TRANDB_SERVER:$TRANDB_PORT/$TRANDB_NAME';
                                                var tableWhiteList = '';
                                                // For oracle, Sample Schema - CLT1408_VPHTEST_AD_GSS_TRAN
                                                // For Postgre, Sample Schema - '' [Empty]
                                                tableWhiteList = '$SCHEMA_NAME' + clientConfig.connector_table_list.toUpperCase();

                                                clientConfig.table_column_name = clientConfig.table_column_name.toUpperCase();
                                                if (clientConfig.connector_mode) {
                                                    if (clientConfig.connector_mode.toUpperCase() == 'INSERT') {
                                                        connect_config['mode'] = 'incrementing';
                                                        connect_config['incrementing.column.name'] = clientConfig.table_column_name;
                                                    } else if (clientConfig.connector_mode.toUpperCase() == 'UPDATE') {
                                                        connect_config['mode'] = 'timestamp';
                                                        connect_config['timestamp.column.name'] = clientConfig.table_column_name;
                                                    }
                                                }
                                                if (connector_for == 'DATABASE') {
                                                    // Sink Connector Config
                                                    connect_config['connector.class'] = 'io.confluent.connect.jdbc.JdbcSinkConnector';
                                                    connect_config['value.converter.schemas.enable'] = 'true';
                                                    connect_config['key.converter.schemas.enable'] = 'true';
                                                    connect_config['topics'] = clientConfig.kafka_topic_name;
                                                    connect_config['auto.create'] = 'false';
                                                    connect_config['table.name.format'] = 'false';
                                                    connect_config['pk.mode'] = 'record_key';
                                                    connect_config['pk.fields'] = clientConfig.table_column_name;
                                                    connect_config['delete.enabled'] = 'true';
                                                    connect_config['table.name.format'] = tableWhiteList;
                                                } else {
                                                    // Source Connector Config
                                                    connect_config['topic.prefix'] = clientConfig.kafka_topic_prefix;
                                                    connect_config['connector.class'] = 'io.confluent.connect.jdbc.JdbcSourceConnector';
                                                    connect_config['numeric.mapping'] = 'best_fit';
                                                    connect_config['table.whitelist'] = tableWhiteList;
                                                }
                                                var pRows = [{
                                                    'CON_ID': reqUuid.v1(),
                                                    "CONNECTOR_NAME": params.connector_name,
                                                    'CONNECTOR_TYPE': params.connector_type,
                                                    'CONFIG_JSON': JSON.stringify(connect_config),
                                                    'STATUS': 'CREATED',
                                                    'REMARKS': '',
                                                    'CREATED_BY': objLogInfo.U_ID || objLogInfo.USER_ID,
                                                    'CREATED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                    'prct_id': prct_id
                                                }];
                                                reqInstanceHelper.PrintInfo(ServiceName, 'New Connector Config...', objLogInfo);
                                                reqInstanceHelper.PrintInfo(ServiceName, JSON.stringify(pRows), objLogInfo);
                                                _inserttable(pTable, pRows).then((res) => {
                                                    reqInstanceHelper.PrintInfo(ServiceName, 'Succesfully Added New Connector...', objLogInfo);
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Connector Added successfully.');
                                                }).catch((error) => {
                                                    reqInstanceHelper.PrintInfo(ServiceName, 'Failed to Adding a New Connector...', objLogInfo);
                                                    reqInstanceHelper.PrintInfo(ServiceName, error, objLogInfo);
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, 'ERR-ADD-CONN-00001', 'Error While Adding a New Connector', error, 'FAILURE', '');
                                                });
                                            } else {
                                                reqInstanceHelper.PrintInfo(ServiceName, 'DEBEZIUM Connector Method is not Implemented Yet...', objLogInfo);
                                                return reqInstanceHelper.SendResponse(ServiceName, appResponse, "FAILURE", objLogInfo, 'ERR-ADD-CONN-00008', '', '', 'FAILURE', 'Failed to Add Connector due to its DEBEZIUM Connector Method...');
                                            }
                                        } else {
                                            // For Solr
                                            connect_config['connector.class'] = 'com.github.jcustenborder.kafka.connect.solr.HttpSolrSinkConnector';
                                            connect_config['topics'] = clientConfig.kafka_topic_name;
                                            connect_config['solr.queue.size'] = '100';
                                            connect_config['solr.commit.within'] = '10';

                                            connect_config['solr.url'] = 'http://$SOLR_SERVER:$SOLR_PORT/solr/' + clientConfig.core_name;

                                            var pRows = [{
                                                'CON_ID': reqUuid.v1(),
                                                "CONNECTOR_NAME": params.connector_name,
                                                'CONFIG_JSON': JSON.stringify(connect_config),
                                                'STATUS': 'CREATED',
                                                'REMARKS': '',
                                                'CREATED_BY': objLogInfo.U_ID || objLogInfo.USER_ID,
                                                'CREATED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo)
                                            }];
                                            reqInstanceHelper.PrintInfo(ServiceName, 'New Connector Config...', objLogInfo);
                                            reqInstanceHelper.PrintInfo(ServiceName, JSON.stringify(pRows), objLogInfo);
                                            _inserttable(pTable, pRows).then((res) => {
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Succesfully Added New Connector...', objLogInfo);
                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Connector Added successfully.');
                                            }).catch((error) => {
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Failed to Adding a New Connector...', objLogInfo);
                                                reqInstanceHelper.PrintInfo(ServiceName, error, objLogInfo);
                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, 'ERR-ADD-CONN-00007', 'Error While Adding a New Sink Connector', error, 'FAILURE', '');
                                            });
                                        }
                                    } else {
                                        if (params && params.Update == 'Y') {
                                            var cond = {
                                                con_id: params.con_id
                                            };
                                            var updaterow = {
                                                'connector_name': params.connector_name,
                                                'connector_type': params.connector_type,
                                                'config_json': JSON.stringify(clientConfig),
                                                'prct_id': prct_id
                                            };
                                            reqDBInstance.UpdateFXDB(pClient, 'CONNECTORS', updaterow, cond, objLogInfo, function (pErr, pRes) {
                                                if (pErr) {
                                                    console.log(pErr);
                                                    reqInstanceHelper.PrintInfo(ServiceName, 'Connector config_json Update Failed...', objLogInfo);
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, 'ERR-ADD-CONN-00023', 'Error While update a Connector', pErr, 'FAILURE', '');
                                                } else {
                                                    reqInstanceHelper.PrintInfo(ServiceName, 'Connector config_json Updated...', objLogInfo);
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Connector Updated successfully.');
                                                }
                                            });
                                        } else {
                                            var pRows = [{
                                                'CON_ID': reqUuid.v1(),
                                                "CONNECTOR_NAME": params.connector_name,
                                                'CONNECTOR_TYPE': params.connector_type,
                                                'CONFIG_JSON': JSON.stringify(clientConfig),
                                                'STATUS': 'CREATED',
                                                'REMARKS': '',
                                                'CREATED_BY': objLogInfo.U_ID || objLogInfo.USER_ID,
                                                'CREATED_DATE': reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                'prct_id': prct_id
                                            }];
                                            reqInstanceHelper.PrintInfo(ServiceName, 'New Connector Config...', objLogInfo);
                                            reqInstanceHelper.PrintInfo(ServiceName, JSON.stringify(pRows), objLogInfo);
                                            _inserttable(pTable, pRows).then((res) => {
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Succesfully Added New Connector...', objLogInfo);
                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Connector Added successfully.');
                                            }).catch((error) => {
                                                reqInstanceHelper.PrintInfo(ServiceName, 'Failed to Adding a New Connector...', objLogInfo);
                                                reqInstanceHelper.PrintInfo(ServiceName, error, objLogInfo);
                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, 'ERR-ADD-CONN-00001', 'Error While Adding a New Connector', error, 'FAILURE', '');
                                            });
                                        }

                                    }

                                    function _inserttable(pTable, pRows) {
                                        return new Promise((resolve, reject) => {
                                            try {
                                                reqDBInstance.InsertFXDB(pClient, pTable, pRows, objLogInfo, function (pErr, pRes) {
                                                    if (pErr) {
                                                        reject(pErr);
                                                    } else {
                                                        resolve(pRes);
                                                    }
                                                });
                                            } catch (error) {
                                                reject(error);
                                            }
                                        });
                                    }
                                } else {
                                    InstanceHelper.PrintInfo(ServiceName, 'Error While Getting KAFKA_CONNECTOR_CONFIG From Platform Setup Table...', objLogInfo);
                                    return reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, 'ERR-ADD-CONN-00009', '', '', 'FAILURE', 'Error While Getting KAFKA_CONNECTOR_CONFIG From Platform Setup Table...');
                                }
                            });
                        });
                    });
                });
            });
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(ServiceName, 'Catch Error in router.post(/AddConnector)...', null);
        reqInstanceHelper.PrintInfo(ServiceName, error, null);
        reqInstanceHelper.SendResponse(ServiceName, appResponse, null, null, 'ERR-ADD-CONN-00002', 'Catch Error in router.post(/AddConnector)', error, 'FAILURE', '');
    }
});
module.exports = router;