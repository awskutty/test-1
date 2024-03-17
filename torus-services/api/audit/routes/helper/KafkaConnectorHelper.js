// Require dependencies
var request = require('request');
var reqAsync = require('async');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqEncryptionInstance = require('../../../../../torus-references/common/crypto/EncryptionInstance');
var serviceName = 'KafkaConnectorHelper';

function GetConnectorStatus(params, GetConnectorStatusCB) {
    try {
        /*     params Should Contains
                - objLogInfo
                - headers
                - connectorsList */
        // Getting Connector Status Directl from Kafka Connect Service
        var info = '';
        var kafkaConnectorsInfo = {};
        var objLogInfo = params.objLogInfo;
        var kafkaConfigRedisKey = 'KAFKA_CONFIG~';
        reqInstanceHelper.PrintInfo(serviceName, 'Getting Kafka Config for Resdis Key - ' + kafkaConfigRedisKey, objLogInfo);
        reqTranDBInstance.GetRedisKeyConfig(params.headers, kafkaConfigRedisKey, false, objLogInfo, function (kafkaConfig, error) {
            kafkaConfig = kafkaConfig ? JSON.parse(kafkaConfig) : '';
            if (kafkaConfig && kafkaConfig.SERVER && kafkaConfig.KAFKA_SERVER_PORT && kafkaConfig.KAFKA_CONNECT_SERVER_PORT) {
                var kafkaConnectUrl = 'http://' + kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT + '/connectors';
                const input_request = {
                    url: kafkaConnectUrl,
                    method: 'GET',
                    json: true
                };
                reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect API Config - ' + input_request, objLogInfo);
                var arrConnectorConfig = params.connectorsList;
                reqInstanceHelper.PrintInfo(serviceName, 'Total No. Of Kafka Connectors - ' + arrConnectorConfig.length, objLogInfo);
                reqAsync.forEachOfSeries(arrConnectorConfig, function (each_connector_config, index, iteratorCB) {
                    input_request.url = kafkaConnectUrl + '/' + each_connector_config.connector_name + '/status';
                    if (each_connector_config.status !== 'CREATED') {
                        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect Rest API Config - ' + JSON.stringify(input_request));
                        request(input_request, function (error, response, body) {
                            if (error) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Connector Status From Kafka Connect - ' + error, objLogInfo);
                            } else if (body && (body.error_code == 404)) {
                                each_connector_config.status = 'STOPPED';
                            } else {
                                var connectorState = '';
                                if ((body && body.connector && body.connector.state)) {
                                    connectorState = body.connector.state;
                                }
                                if (connectorState == 'UNASSIGNED') {
                                    each_connector_config.status = 'UNASSIGNED';
                                }
                                var totalTasks = body.tasks;
                                for (let y = 0; y < totalTasks.length; y++) {
                                    const element = totalTasks[y];
                                    if (element.state.toUpperCase() == 'RUNNING') {
                                        each_connector_config.status = 'STARTED';
                                        each_connector_config.remarks = ''; // No need to show the previouse error logs 
                                    }
                                    else if (element.state.toUpperCase() == 'FAILED') {
                                        each_connector_config.status = 'FAILED';
                                    }
                                    else if (element.state.toUpperCase() == 'UNASSIGNED') {
                                        each_connector_config.status = 'UNASSIGNED';
                                    }
                                    if (element.trace) {
                                        each_connector_config.remarks = element.trace;
                                    }
                                }
                            }
                            reqInstanceHelper.PrintInfo(serviceName, each_connector_config.connector_name + ' Connector Status - ' + connectorState);
                            reqInstanceHelper.PrintInfo(serviceName, each_connector_config.connector_name + ' Connector Error - ' + each_connector_config.error);
                            iteratorCB();
                        });
                    } else {
                        iteratorCB();
                    }
                }, function (params) {
                    info = arrConnectorConfig.length + ' - Connectors are Processed Successfully...';
                    reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                    kafkaConnectorsInfo.data = arrConnectorConfig;
                    kafkaConnectorsInfo.message = info;
                    GetConnectorStatusCB(null, kafkaConnectorsInfo);
                });

            } else {
                info = 'Some Parameters are missed in this kafka config - ' + JSON.stringify(kafkaConfig);
                reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                kafkaConnectorsInfo.data = arrConnectorConfig;
                kafkaConnectorsInfo.message = null;
                GetConnectorStatusCB(info, kafkaConnectorsInfo);
            }

        });
    } catch (error) {
        info = 'Catch Error in StartKafkaConnectors()..........'
        reqInstanceHelper.PrintInfo(serviceName, info, null);
        kafkaConnectorsInfo.message = info;
        kafkaConnectorsInfo.data = arrConnectorConfig;
        GetConnectorStatusCB(error, kafkaConnectorsInfo);
    }
}


function StartKafkaConnectors(params, StartKafkaConnectorsCB) {
    try {
        /*     params Should Contains
                - objLogInfo
                - headers
                - kafkaConfig
                - dep_cas_instance
                - connectorsList */
        var kafkaConnectorsInfo = {};
        var data = {};
        var objLogInfo = params.objLogInfo;
        var headers = params.headers;
        var info = '';
        var kafkaConfig = params.kafkaConfig ? JSON.parse(params.kafkaConfig) : '';
        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Server - ' + kafkaConfig.SERVER, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Server Port - ' + kafkaConfig.KAFKA_SERVER_PORT, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect Server Port - ' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT, objLogInfo);
        if (kafkaConfig && kafkaConfig.SERVER && kafkaConfig.KAFKA_SERVER_PORT && kafkaConfig.KAFKA_CONNECT_SERVER_PORT) {
            var dep_cas_instance = params.dep_cas_instance;
            var kafkaConnectUrl = 'http://' + kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT + '/connectors';
            const input_request = {
                url: kafkaConnectUrl,
                method: "POST",
                json: true
            };
            reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect URL - ' + kafkaConnectUrl, objLogInfo);
            var arrConnectorConfig = params.connectorsList;
            var successConnectors = [];
            var failedConnectors = [];
            reqInstanceHelper.PrintInfo(serviceName, 'Total No. Of Kafka Connectors - ' + arrConnectorConfig.length, objLogInfo);


            // Getting Tran DB Config From Redis
            var tranDBKey = 'TRANDB~';
            reqInstanceHelper.PrintInfo(serviceName, 'Getting Tran DB Config - ' + tranDBKey, objLogInfo);
            reqTranDBInstance.GetRedisKeyConfig(headers, tranDBKey, false, objLogInfo, function (tranDBConfig, error) {
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Tran DB Config...', objLogInfo);
                    info = 'Error While Getting data For Redis TranDB Config';
                    reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                    data.successConnectors = successConnectors;
                    data.failedConnectors = failedConnectors;
                    kafkaConnectorsInfo.data = data;
                    kafkaConnectorsInfo.message = null;
                    StartKafkaConnectorsCB(info, kafkaConnectorsInfo);
                } else {
                    tranDBConfig = JSON.parse(tranDBConfig);
                    var dbType = tranDBConfig.DB_TYPE;
                    reqInstanceHelper.PrintInfo(serviceName, 'Checking DB_TYPE from the Tran DB Config...', objLogInfo);
                    if (dbType && tranDBConfig.Server && tranDBConfig.Port && tranDBConfig.Database && tranDBConfig.SearchPath) {
                        // Preparing Tran DB Config for Replacing
                        var TRANDB_USER = tranDBConfig.UserID;
                        console.log(tranDBConfig.Password, 'tranDBConfig.Password');
                        var TRANDB_PASSWORD = reqEncryptionInstance.DoDecrypt(tranDBConfig.Password.toLowerCase());
                        console.log(TRANDB_PASSWORD, 'After encription');
                        var TRANDB_SERVER = tranDBConfig.Server;
                        var TRANDB_PORT = tranDBConfig.Port;
                        var TRANDB_NAME = tranDBConfig.Database;
                        var JDBC_URL_PREFIX = '';
                        var SCHEMA_NAME = '';

                        reqInstanceHelper.PrintInfo(serviceName, 'DB Type - ' + dbType, objLogInfo);
                        var tableSchema = '';
                        tableSchema = tranDBConfig.SearchPath;
                        if (dbType.toUpperCase() == 'POSTGRES') {
                            JDBC_URL_PREFIX = 'jdbc:postgresql:';
                            SCHEMA_NAME = '';
                        } else if (dbType.toUpperCase() == 'ORACLE') {
                            JDBC_URL_PREFIX = 'jdbc:oracle:thin:@';
                            SCHEMA_NAME = TRANDB_USER.toUpperCase() + '.';
                        }

                        // Getting Solr Config From Redis

                        var solrDBKey = 'SOLR_LOGGING~';
                        reqInstanceHelper.PrintInfo(serviceName, 'Getting SOLR LOGGING Config - ' + solrDBKey, objLogInfo);
                        reqTranDBInstance.GetRedisKeyConfig(headers, solrDBKey, false, objLogInfo, function (solrDBKeyConfig, error) {
                            if (error) {
                                info = 'Error While Getting data For Redis SOLR LOGGING Config';
                                reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                                data.successConnectors = successConnectors;
                                data.failedConnectors = failedConnectors;
                                kafkaConnectorsInfo.data = data;
                                kafkaConnectorsInfo.message = null;
                                StartKafkaConnectorsCB(info, kafkaConnectorsInfo);
                            } else {

                                solrDBKeyConfig = JSON.parse(solrDBKeyConfig);
                                reqInstanceHelper.PrintInfo(serviceName, 'Solr DB IP - ' + solrDBKeyConfig.SERVER, objLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'Solr DB PORT - ' + solrDBKeyConfig.PORT, objLogInfo);
                                // reqInstanceHelper.PrintInfo(serviceName, 'Solr DB CORE NAME - ' + clientConfig.core_name, objLogInfo);
                                if (solrDBKeyConfig && solrDBKeyConfig.SERVER && solrDBKeyConfig.PORT) {
                                    // Preparing Solr Config for Replacing
                                    var SOLR_SERVER = solrDBKeyConfig.SERVER;
                                    var SOLR_PORT = solrDBKeyConfig.PORT;

                                    reqAsync.forEachOfSeries(arrConnectorConfig, function (each_connector_config, index, iteratorCB) {
                                        each_connector_config.config = JSON.parse(each_connector_config.config); // Need to uncomment 
                                        var connecter_info = {};
                                        var connectorJson = each_connector_config.config;
                                        for (const key in connectorJson) {
                                            var element = connectorJson[key];

                                            // Replacing Solr sink connector config 
                                            // Used Split with Join() instead of Replace() which is not working with $$
                                            if (element.includes('<SOLR_SERVER>')) {
                                                element = element.split('<SOLR_SERVER>').join(SOLR_SERVER);
                                            }
                                            if (element.includes('<SOLR_PORT>')) {
                                                element = element.split('<SOLR_PORT>').join(SOLR_PORT);
                                            }

                                            // Replacing DB sink connector config
                                            if (element.includes('<TRANDB_USER>')) {
                                                element = element.split('<TRANDB_USER>').join(TRANDB_USER);
                                            }
                                            if (element.includes('<TRANDB_PASSWORD>')) {
                                                element = element.split('<TRANDB_PASSWORD>').join(TRANDB_PASSWORD);
                                            }
                                            if (element.includes('<TRANDB_SERVER>')) {
                                                element = element.split('<TRANDB_SERVER>').join(TRANDB_SERVER);
                                            }
                                            if (element.includes('<TRANDB_PORT>')) {
                                                element = element.split('<TRANDB_PORT>').join(TRANDB_PORT);
                                            }
                                            if (element.includes('<TRANDB_NAME>')) {
                                                element = element.split('<TRANDB_NAME>').join(TRANDB_NAME);
                                            }
                                            if (element.includes('<JDBC_URL_PREFIX>')) {
                                                element = element.split('<JDBC_URL_PREFIX>').join(JDBC_URL_PREFIX);
                                            }
                                            if (element.includes('<SCHEMA_NAME>')) {
                                                element = element.split('<SCHEMA_NAME>.').join(SCHEMA_NAME);
                                            }

                                            // Case Conversion based on Postgres and Oracle
                                            if (dbType.toUpperCase() == 'POSTGRES') {
                                                if (key.toUpperCase() == 'PK.FIELDS' || key.toUpperCase() == 'TABLE.NAME.FORMAT' || key.toUpperCase() == 'TABLE.WHITELIST' || key.toUpperCase() == 'INCREMENTING.COLUMN.NAME') {
                                                    element = element.toLowerCase();
                                                }
                                            } else if (dbType.toUpperCase() == 'ORACLE') {
                                                if (key.toUpperCase() == 'PK.FIELDS' || key.toUpperCase() == 'TABLE.NAME.FORMAT' || key.toUpperCase() == 'TABLE.WHITELIST' || key.toUpperCase() == 'INCREMENTING.COLUMN.NAME') {
                                                    element = element.toUpperCase();
                                                }
                                            }
                                            console.log(element, '------------');
                                            connectorJson[key] = element;
                                        }
                                        var kafkaConnectReqObj = {};
                                        kafkaConnectReqObj.name = each_connector_config.connector_name;
                                        kafkaConnectReqObj.config = each_connector_config.config;
                                        input_request.body = kafkaConnectReqObj;
                                        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect Config - ' + JSON.stringify(input_request));
                                        request(input_request, function (error, response, body) {
                                            if (body == undefined) {
                                                bodyobj = error;
                                            } else {
                                                bodyobj = body;
                                            }
                                            var cond = {
                                                con_id: each_connector_config.con_id
                                            };
                                            var modifiedDate = new Date();
                                            if (error != undefined) {
                                                var updaterow = {
                                                    'status': 'FAILED',
                                                    'remarks': JSON.stringify(error),
                                                    'config_json_replaced': JSON.stringify(each_connector_config.config),
                                                    'modified_by': objLogInfo.U_ID || objLogInfo.USER_ID,
                                                    'modified_date': modifiedDate
                                                };
                                                _updateConnectors(dep_cas_instance, 'CONNECTORS', updaterow, cond, objLogInfo, function successcallback(res, err) {
                                                    connecter_info.connector_name = each_connector_config.connector_name;
                                                    connecter_info.connector_id = each_connector_config.con_id;
                                                    connecter_info.kafkaConnectErrorObj = error;
                                                    connecter_info.DBUpdateErrorObj = err;
                                                    failedConnectors.push(connecter_info);
                                                    iteratorCB();
                                                });
                                            } else {
                                                if (body && body.error_code) {
                                                    var updaterow;
                                                    updaterow = {
                                                        'status': 'FAILED',
                                                        'remarks': JSON.stringify(bodyobj),
                                                        'config_json_replaced': JSON.stringify(each_connector_config.config),
                                                        'modified_by': objLogInfo.U_ID || objLogInfo.USER_ID,
                                                        'modified_date': modifiedDate
                                                    };
                                                    _updateConnectors(dep_cas_instance, 'CONNECTORS', updaterow, cond, objLogInfo, function successcallback(res, err) {
                                                        connecter_info.connector_name = each_connector_config.connector_name;
                                                        connecter_info.connector_id = each_connector_config.con_id;
                                                        connecter_info.kafkaConnectErrorObj = error;
                                                        connecter_info.DBUpdateErrorObj = err;
                                                        failedConnectors.push(connecter_info);
                                                        iteratorCB();
                                                    });
                                                } else {
                                                    updaterow = {
                                                        'status': 'STARTED',
                                                        'remarks': '',
                                                        'config_json_replaced': JSON.stringify(each_connector_config.config),
                                                        'modified_by': objLogInfo.U_ID || objLogInfo.USER_ID,
                                                        'modified_date': modifiedDate
                                                    };
                                                    _updateConnectors(dep_cas_instance, 'CONNECTORS', updaterow, cond, objLogInfo, function successcallback(res, err) {
                                                        connecter_info.connector_name = each_connector_config.connector_name;
                                                        connecter_info.connector_id = each_connector_config.con_id;
                                                        connecter_info.kafkaConnectErrorObj = error;
                                                        connecter_info.DBUpdateErrorObj = err;
                                                        successConnectors.push(connecter_info);
                                                        iteratorCB();
                                                    });
                                                }
                                            }
                                        });
                                    }, function (params) {
                                        info = arrConnectorConfig.length + ' - Connectors are Processed Successfully...';
                                        reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                                        data.successConnectors = successConnectors;
                                        data.failedConnectors = failedConnectors;
                                        kafkaConnectorsInfo.data = data;
                                        kafkaConnectorsInfo.message = info;
                                        StartKafkaConnectorsCB(null, kafkaConnectorsInfo);
                                    });


                                } else {
                                    info = 'Some Required Information is Missed From the Redis Solr Logging Config, pl check the SERVER and PORT';
                                    reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                                    data.successConnectors = successConnectors;
                                    data.failedConnectors = failedConnectors;
                                    kafkaConnectorsInfo.data = data;
                                    kafkaConnectorsInfo.message = null;
                                    StartKafkaConnectorsCB(info, kafkaConnectorsInfo);
                                }

                            }
                        });

                    } else {
                        info = 'Some Required Information is Missed From the Redis Tran Db Config, pl check the DB_TYPE, SERVER, PORT, DATABASE NAME, SEARCH PATH within the Tran DB Config';
                        reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                        data.successConnectors = successConnectors;
                        data.failedConnectors = failedConnectors;
                        kafkaConnectorsInfo.data = data;
                        kafkaConnectorsInfo.message = null;
                        StartKafkaConnectorsCB(info, kafkaConnectorsInfo);
                    }
                }
            });
        } else {
            info = 'Some Parameters are missed in this kafka config - ' + JSON.stringify(kafkaConfig);
            reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
            data.successConnectors = successConnectors;
            data.failedConnectors = failedConnectors;
            kafkaConnectorsInfo.data = data;
            kafkaConnectorsInfo.message = null;
            StartKafkaConnectorsCB(info, kafkaConnectorsInfo);
        }
    } catch (error) {
        info = 'Catch Error in StartKafkaConnectors()..........'
        reqInstanceHelper.PrintInfo(serviceName, info, null);
        kafkaConnectorsInfo.message = info;
        data.successConnectors = successConnectors;
        data.failedConnectors = failedConnectors;
        kafkaConnectorsInfo.data = data;
        StartKafkaConnectorsCB(error, kafkaConnectorsInfo);
    }
}




function StopKafkaConnectors(params, StopKafkaConnectorsCB) {
    try {
        /*     params Should Contains
                - objLogInfo
                - kafkaConfig
                - dep_cas_instance
                - connectorsList */
        var kafkaConnectorsInfo = {};
        var data = {};
        var objLogInfo = params.objLogInfo;
        var info = '';
        var bodyobj;
        var kafkaConfig = params.kafkaConfig ? JSON.parse(params.kafkaConfig) : '';
        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Server - ' + kafkaConfig.SERVER, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Server Port - ' + kafkaConfig.KAFKA_SERVER_PORT, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect Server Port - ' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT, objLogInfo);
        if (kafkaConfig && kafkaConfig.SERVER && kafkaConfig.KAFKA_SERVER_PORT && kafkaConfig.KAFKA_CONNECT_SERVER_PORT, objLogInfo) {
            var dep_cas_instance = params.dep_cas_instance;
            var kafkaConnectUrl = 'http://' + kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT + '/connectors/';
            const input_request = {
                url: kafkaConnectUrl,
                method: "DELETE",
                json: true
            };
            reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect URL - ' + kafkaConnectUrl, objLogInfo);
            var arrConnectorConfig = params.connectorsList;
            var successConnectors = [];
            var failedConnectors = [];
            reqInstanceHelper.PrintInfo(serviceName, 'Total No. Of Kafka Connectors - ' + arrConnectorConfig.length, objLogInfo);
            reqAsync.forEachOfSeries(arrConnectorConfig, function (each_connector_config, index, iteratorCB) {
                reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect Config - ' + JSON.stringify(each_connector_config));
                input_request.url = kafkaConnectUrl + each_connector_config.connector_name;
                reqInstanceHelper.PrintInfo(serviceName, 'Connector Delete URL - ' + input_request.url, objLogInfo);
                var connecter_info = {};
                input_request.body = each_connector_config;
                request(input_request, function (error, response, body) {
                    if (response == undefined) {
                        bodyobj = error;
                    } else {
                        bodyobj = response;
                    }
                    var cond = {
                        con_id: each_connector_config.con_id
                    };
                    var modifiedDate = new Date();
                    if (error != undefined) {
                        var updaterow = {
                            'status': 'FAILED',
                            'remarks': JSON.stringify(error),
                            'modified_by': objLogInfo.U_ID || objLogInfo.USER_ID,
                            'modified_date': modifiedDate
                        };
                        _updateConnectors(dep_cas_instance, 'CONNECTORS', updaterow, cond, objLogInfo, function successcallback(res, err) {
                            connecter_info.connector_name = each_connector_config.connector_name;
                            connecter_info.connector_id = each_connector_config.con_id;
                            connecter_info.kafkaConnectErrorObj = error;
                            connecter_info.DBUpdateErrorObj = err;
                            failedConnectors.push(connecter_info);
                            iteratorCB();
                        });
                    } else {
                        if (body && body.error_code) {
                            var updaterow;
                            updaterow = {
                                'status': 'FAILED',
                                'remarks': JSON.stringify(bodyobj),
                                'modified_by': objLogInfo.U_ID || objLogInfo.USER_ID,
                                'modified_date': modifiedDate
                            };
                            _updateConnectors(dep_cas_instance, 'CONNECTORS', updaterow, cond, objLogInfo, function successcallback(res, err) {
                                connecter_info.connector_name = each_connector_config.connector_name;
                                connecter_info.connector_id = each_connector_config.con_id;
                                connecter_info.kafkaConnectErrorObj = error;
                                connecter_info.DBUpdateErrorObj = err;
                                failedConnectors.push(connecter_info);
                                iteratorCB();
                            });
                        } else {
                            updaterow = {
                                'status': 'STOPPED',
                                'modified_by': objLogInfo.U_ID || objLogInfo.USER_ID,
                                'modified_date': modifiedDate
                            };
                            _updateConnectors(dep_cas_instance, 'CONNECTORS', updaterow, cond, objLogInfo, function successcallback(res, err) {
                                connecter_info.connector_name = each_connector_config.connector_name;
                                connecter_info.connector_id = each_connector_config.con_id;
                                connecter_info.kafkaConnectErrorObj = error;
                                connecter_info.DBUpdateErrorObj = err;
                                successConnectors.push(connecter_info);
                                iteratorCB();
                            });
                        }
                    }
                });
            }, function (params) {
                info = arrConnectorConfig.length + ' - Connectors are Processed Successfully...';
                reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                data.successConnectors = successConnectors;
                data.failedConnectors = failedConnectors;
                kafkaConnectorsInfo.data = data;
                kafkaConnectorsInfo.message = info;
                StopKafkaConnectorsCB(null, kafkaConnectorsInfo);
            });
        } else {
            info = 'Some Parameters are missed in this kafka config - ' + JSON.stringify(kafkaConfig);
            reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
            data.successConnectors = successConnectors;
            data.failedConnectors = failedConnectors;
            kafkaConnectorsInfo.data = data;
            kafkaConnectorsInfo.message = null;
            StopKafkaConnectorsCB(info, kafkaConnectorsInfo);
        }
    } catch (error) {
        info = 'Catch Error in StopKafkaConnectors()..........'
        reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
        kafkaConnectorsInfo.message = info;
        data.successConnectors = successConnectors;
        data.failedConnectors = failedConnectors;
        kafkaConnectorsInfo.data = data;
        StopKafkaConnectorsCB(error, kafkaConnectorsInfo);
    }
}

function _updateConnectors(pClient, pTable, updaterow, pRows, objLogInfo, callback) {
    try {
        reqDBInstance.UpdateFXDB(pClient, pTable, updaterow, pRows, objLogInfo, function (pErr, pRes) {
            if (pErr) {
                console.log(pErr);
                reqInstanceHelper.PrintInfo(serviceName, 'Connector Status Update Failed...', objLogInfo);
                callback(pErr);
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'Connector Status Updated...', objLogInfo);
                callback(pRes);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Catch Error in _updateConnectors()', objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, error, objLogInfo);
        callback(error);
    }
}


module.exports = {
    StartKafkaConnectors: StartKafkaConnectors,
    StopKafkaConnectors: StopKafkaConnectors,
    GetConnectorStatus: GetConnectorStatus
}