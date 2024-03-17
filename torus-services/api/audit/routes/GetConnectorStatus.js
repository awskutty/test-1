/**
 * Description      : To Get the Connector List From the Table and sending mail based on Connector Status
 * Last Error_Code  : ERR_GET_CONNECTOR_STATUS_00004
 */

// Require dependencies
var request = require('request');
var reqLinq = require('node-linq').LINQ;
var reqCron = require('node-cron');
var reqAsync = require('async');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqProducer = require('../../../../torus-references/common/Producer');
var reqKafkaConnectorHelper = require('./helper/KafkaConnectorHelper');
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];

// Initialize Global variables
var serviceName = 'GetConnectorStatus';
var logFilePath = 'api/audit';
var objLogInfo = reqLogWriter.GetLogInfo('TRAN_DATA_PRODUCER', 'TRAN_DATA_PRODUCER_PROCESS', 'TRAN_DATA_PRODUCER_ACTION', logFilePath);
var objRunningChilds = {};
var arrTotalConnectors = [];
var ConnectorInfo = {
    objLogInfo: objLogInfo,
    routingkeys: {}
};

// Read redis keys, filter TRANDB key values and create child process for each
function ProduceWithAllTranDBKeys() {
    try {
        var coreDBRediskeyPrefix = '';
        var kafkaRediskeyPrefix = '';
        if (serviceModel) {
            if (serviceModel.TYPE == 'ULTIMATE') { // Cassandra
                coreDBRediskeyPrefix = 'CASSANDRA';
            } else if (serviceModel.TRANDB == 'POSTGRES') { // Tran DB Pg
                coreDBRediskeyPrefix = 'POSTGRES';
            } else {
                coreDBRediskeyPrefix = 'ORACLE'; // Tran DB Oracle
            }
        } else { // Default Case
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00001', 'There is No Service Model Config', '');
            return; //No Need to Continue the Process
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Redis Key Prefix - ' + coreDBRediskeyPrefix, objLogInfo);
        if (!coreDBRediskeyPrefix) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00003', 'Invalid Redis Key Prefix', '');
            return; //No Need to Continue the Process
        }
        reqRedisInstance.GetRedisConnection(function (error, clientRedis) {
            try {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00002', 'Error in GetRedisConnection()...', error);
                } else {
                    clientRedis.keys('*', function (error, arrAllRedisKeys) {
                        try {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00004', 'Error in clientRedis.keys()...', error);
                                return; //No Need to Continue the Process
                            } else {
                                var connStr = coreDBRediskeyPrefix;
                                var arrCoreDBKeys = new reqLinq(arrAllRedisKeys)
                                    .Where(function (key) {
                                        var tempConStr = key.split('~')[0];
                                        if (tempConStr == connStr) {
                                            return true;
                                        } else {
                                            return false;
                                        }
                                    })
                                    .ToArray();
                                connStr = kafkaRediskeyPrefix;
                                var arrKafkaRedisKeys = new reqLinq(arrAllRedisKeys)
                                    .Where(function (key) {
                                        var tempConStr = key.split('~')[0];
                                        if (tempConStr == connStr) {
                                            return true;
                                        } else {
                                            return false;
                                        }
                                    })
                                    .ToArray();

                                var i = 0;
                                if (arrCoreDBKeys.length) {
                                    doWithCurrentKey(arrCoreDBKeys[i]);
                                } else {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00005', 'No Core DB Key Found', '');
                                    return; //No Need to Continue the Process
                                }

                                function doWithCurrentKey(currentKey) {
                                    try {
                                        i++;
                                        reqInstanceHelper.GetConfig(currentKey, function (currJson, error) {
                                            if (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00006', 'Error in doWithCurrentKey() - GetConfig() Callback...', error);
                                                if (i < arrCoreDBKeys.length) {
                                                    doWithCurrentKey(arrCoreDBKeys[i]);
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Thread Started for All the Core DB Keys', objLogInfo);
                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                }
                                            } else {
                                                var coreDBRedisKeyValue = JSON.parse(currJson);
                                                var ServerConfig = '';
                                                var keyNameWithServerIpUser = '';
                                                connStr = coreDBRediskeyPrefix;
                                                // Ulitimate Env - Cassandra Case
                                                if (coreDBRedisKeyValue.CassandraServers && coreDBRedisKeyValue.CassandraServers.length) {
                                                    ServerConfig = coreDBRedisKeyValue.CassandraServers[0];
                                                    keyNameWithServerIpUser = ServerConfig.Server + '_' + ServerConfig.Port + '_' + ServerConfig.UserName;
                                                } // Oracle Case
                                                else if (coreDBRedisKeyValue.OracleServers && coreDBRedisKeyValue.OracleServers.length) {
                                                    ServerConfig = coreDBRedisKeyValue.OracleServers[0];
                                                    keyNameWithServerIpUser = ServerConfig.Server + '_' + ServerConfig.Port + '_' + ServerConfig.UserID;
                                                } // Postgres Case
                                                else {
                                                    ServerConfig = coreDBRedisKeyValue.PostgresServers[0];
                                                    keyNameWithServerIpUser = ServerConfig.Server + '_' + ServerConfig.Port + '_' + ServerConfig.UserID;
                                                }
                                                if (!keyNameWithServerIpUser) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'There is No DB Configuration Found From Redis', objLogInfo);
                                                    reqLogWriter.EventUpdate(objLogInfo);
                                                    if (i < arrCoreDBKeys.length) {
                                                        doWithCurrentKey(arrCoreDBKeys[i]);
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Thread Started for All the Core DB Keys', objLogInfo);
                                                        reqLogWriter.EventUpdate(objLogInfo);
                                                    }
                                                } else {
                                                    keyNameWithServerIpUser = keyNameWithServerIpUser.replace(/\./g, '_');
                                                    keyNameWithServerIpUser = keyNameWithServerIpUser.replace(/\-/g, '_');
                                                    var isChildRunning = checkChildRunning(keyNameWithServerIpUser);
                                                    if (!objRunningChilds[keyNameWithServerIpUser]) {
                                                        objRunningChilds[keyNameWithServerIpUser] = coreDBRedisKeyValue;
                                                    }
                                                    if (!isChildRunning) {
                                                        var headers = {
                                                            routingkey: currentKey.replace(connStr + '~', '').toLowerCase()
                                                        };
                                                        reqInstanceHelper.PrintInfo(serviceName, 'thread for currentKey - ' + currentKey + ' and its Rounting Key - ' + headers.routingkey, objLogInfo);
                                                        if (currentKey) { //'CASSANDRA~CLT-1304~APP-109~TNT-0~ENV-DEV'

                                                            reqDBInstance.GetFXDBConnection(headers, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                                                                var cond = {};
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Getting Connector List', objLogInfo);
                                                                reqDBInstance.GetTableFromFXDBNoCache(dep_cas_instance, 'CONNECTORS', [], cond, objLogInfo, function (connectorsError, connectorsRes) {
                                                                    if (connectorsError) {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Error while Getting Connector List from Table...', objLogInfo);
                                                                        reqInstanceHelper.PrintInfo(serviceName, connectorsError, objLogInfo);
                                                                        if (i < arrCoreDBKeys.length) {
                                                                            doWithCurrentKey(arrCoreDBKeys[i]);
                                                                        } else {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Thread Completed for All the Core DB Keys', objLogInfo);
                                                                            reqLogWriter.EventUpdate(objLogInfo);
                                                                        }
                                                                    } else {
                                                                        if (connectorsRes.rows && connectorsRes.rows.length) {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Got Connector List from the Table...', objLogInfo);
                                                                            var CheckAvailableConnectorStatusReqObj = {};
                                                                            CheckAvailableConnectorStatusReqObj.objLogInfo = objLogInfo;
                                                                            CheckAvailableConnectorStatusReqObj.headers = headers;
                                                                            // CheckAvailableConnectorStatusReqObj.connectorList = connectorsRes.rows;
                                                                            for (let u = 0; u < connectorsRes.rows.length; u++) {
                                                                                const element = connectorsRes.rows[u];
                                                                                var elementIndex = arrTotalConnectors.findIndex((e) => { return e.connector_name == element.connector_name });
                                                                                // element.routingkey = headers.routingkey;
                                                                                if (elementIndex == -1) {
                                                                                    arrTotalConnectors.push(element);
                                                                                    ConnectorInfo.routingkeys[headers.routingkey] = {
                                                                                        connectorList: arrTotalConnectors,
                                                                                        serverInfo: keyNameWithServerIpUser
                                                                                    };
                                                                                }
                                                                            }
                                                                            // CheckAvailableConnectorStatus(CheckAvailableConnectorStatusReqObj);
                                                                            if (i < arrCoreDBKeys.length) {
                                                                                doWithCurrentKey(arrCoreDBKeys[i]);
                                                                            } else {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Thread Completed for All the Core DB Keys', objLogInfo);
                                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                                            }
                                                                        } else {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'There is No Connector Data from the Table...', objLogInfo);
                                                                            if (i < arrCoreDBKeys.length) {
                                                                                doWithCurrentKey(arrCoreDBKeys[i]);
                                                                            } else {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Thread Completed for All the Core DB Keys', objLogInfo);
                                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                                            }
                                                                        }
                                                                    }
                                                                });
                                                            });
                                                        } else {
                                                            if (i < arrCoreDBKeys.length) {
                                                                doWithCurrentKey(arrCoreDBKeys[i]);
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Thread Completed for All the Core DB Keys', objLogInfo);
                                                                reqLogWriter.EventUpdate(objLogInfo);
                                                            }
                                                        }
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'already running', objLogInfo);
                                                        if (i < arrCoreDBKeys.length) {
                                                            doWithCurrentKey(arrCoreDBKeys[i]);
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Thread Completed for All the Core DB Keys', objLogInfo);
                                                            reqLogWriter.EventUpdate(objLogInfo);
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00001-1003', 'Catch Error in doWithCurrentKey()...', error);
                                        callback();
                                    }
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00001-1004', 'Catch Error in clientRedis.keys() Callback...', error);
                            callback();
                        }
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00001-1005', 'Catch Error in GetRedisConnection() Callback...', error);
                callback();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_GET_CONNECTOR_STATUS_00001-1006', 'Catch Error in produceWithAllTranDBKeys()...', error);
        callback();
    }
}


// Check for any child process is running or not
function checkChildRunning(objRunningChildsKey) {

    if (objRunningChilds[objRunningChildsKey]) {
        return true;
    } else {
        return false;
    }
}


function CheckAvailableConnectorStatus(pCheckAvailableConnectorStatus) {
    try {
        var routingkey = pCheckAvailableConnectorStatus.headers.routingkey;
        var task = reqCron.schedule('*/10 * * * * *', function () {
            reqInstanceHelper.PrintInfo(serviceName, 'Thread Started for Routing key - ' + routingkey, objLogInfo);
            var kafkaConnectorsReqObj = {};
            kafkaConnectorsReqObj.objLogInfo = pCheckAvailableConnectorStatus.objLogInfo;
            kafkaConnectorsReqObj.headers = pCheckAvailableConnectorStatus.headers;
            kafkaConnectorsReqObj.connectorsList = pCheckAvailableConnectorStatus.connectorList;
            reqKafkaConnectorHelper.GetConnectorStatus(kafkaConnectorsReqObj, function (error, kafkaConnectorsCBResult) {
                var VerifyConnectorStatusReqObj = {};
                VerifyConnectorStatusReqObj.objLogInfo = pCheckAvailableConnectorStatus.objLogInfo;
                VerifyConnectorStatusReqObj.headers = pCheckAvailableConnectorStatus.headers;
                VerifyConnectorStatusReqObj.connectorList = pCheckAvailableConnectorStatus.connectorList;
                VerifyConnectorStatus(kafkaConnectorsReqObj);

            });
        });
        tasks.push(task);
        return callback('started');
    } catch (error) {

    }

}


// To verify the Connector Status and Sending mail for Stopped or Failed Status

function VerifyConnectorStatus(VerifyConnectorStatusReqObj) {
    try {
        var connectorList = VerifyConnectorStatusReqObj.connectorList;
        var objLogInfo = VerifyConnectorStatusReqObj.objLogInfo;
        if (connectorList.length) {
            reqAsync.forEachOfSeries(arrConnectorConfig, function (each_connector_config, index, iteratorCB) {
                reqInstanceHelper.PrintInfo(serviceName, 'Connector Name - ' + each_connector_config.connector_name);
                reqInstanceHelper.PrintInfo(serviceName, 'Connector Status - ' + each_connector_config.status);
                if (each_connector_config.status == 'STOPPED' || each_connector_config.status == 'FAILED') {
                    reqInstanceHelper.PrintInfo(serviceName, 'Sending Mail for Connector - ' + each_connector_config.connector_name, objLogInfo);
                    var commStaticData = {
                        connector_info: 'Connector Info has been sent via mail'
                    };
                    var sendMsgReqObj = {
                        DT_CODE: 'DEFAULT',
                        DTT_CODE: 'DEFAULT',
                        WFTPA_ID: 'DEFAULT',
                        EVENT_CODE: 'DEFAULT',
                        COMMMG_CODE: 'COMM_CATEGORY1608288044113',
                        STATIC_DATA: JSON.stringify(commStaticData)
                    };
                    // var input_request = {
                    //     url: serverhost,
                    //     method: 'POST',
                    //     json: true,
                    //     body: { PARAMS: insertObj, PROCESS_INFO: processInfo },
                    //     headers: headers
                    // };
                    // request(input_request, function (error, response, body) {
                    //     if (error) {
                    //         reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Connector Status From Kafka Connect - ' + error, objLogInfo);
                    //     } else if (body && (body.error_code == 404 || body.connector.state.toUpperCase() !== 'RUNNING' && body.connector.state.toUpperCase() !== 'UNASSIGNED')) {
                    //         each_connector_config.status = 'STOPPED';
                    //     } else {
                    //         each_connector_config.status = 'STARTED';
                    //     }
                    //     iteratorCB();
                    // });

                    reqProducer.ProduceMessage('COMMM_PROCESS_DATA', JSON.stringify([sendMsgReqObj]), VerifyConnectorStatusReqObj.headers, function (status) {
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

        }
    } catch (error) {

    }

}

function CheckConnectorList(params) {
    try {

    } catch (error) {

    }

}


module.exports = {
    ProduceWithAllTranDBKeys: ProduceWithAllTranDBKeys,
    ConnectorInfo: ConnectorInfo
};