/*
@Api_Name         : /DeleteConnector,
@Description      : To Add Delete a Connector in the kafka as well as in the Table
@Last_Error_code  : ERR-DEL-CONN-00006
*/


// Require dependencies
var reqExpress = require('express');
var request = require('request');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
router.post('/DeleteConnector', function (appRequest, appResponse) {
    try {
        var serviceName = 'DeleteConnector';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqInstanceHelper.PrintInfo(serviceName, 'Deleting a Connector...', objLogInfo);
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                var pTable = "CONNECTORS";
                var pRows = {
                    con_id: params.con_id
                };
                reqInstanceHelper.PrintInfo(serviceName, 'Connector Name - ' + params.con_id, objLogInfo);
                reqInstanceHelper.PrintInfo(serviceName, 'Frist Deleting Connector from the Kafka Connect Service...', objLogInfo);

                var kafkaConfig = 'KAFKA_CONFIG~';
                reqInstanceHelper.PrintInfo(serviceName, 'Getting Kafka Config for Routing Key - ' + kafkaConfig, objLogInfo);
                reqTranDBInstance.GetRedisKeyConfig(pHeaders, kafkaConfig, false, objLogInfo, function (kafkaConfig, error) {
                    if (error) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Failed To Get the GetRedisKeyConfig...', objLogInfo);
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DEL-CONN-00006', 'Failed To Get the GetRedisKeyConfig...', error, 'FAILURE', '');
                    } else {
                    var kafkaConfig = kafkaConfig ? JSON.parse(kafkaConfig) : '';
                    reqInstanceHelper.PrintInfo(serviceName, 'Kafka Server - ' + kafkaConfig.SERVER, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Kafka Server Port - ' + kafkaConfig.KAFKA_SERVER_PORT, objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect Server Port - ' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT, objLogInfo);
                        if (kafkaConfig && kafkaConfig.SERVER && kafkaConfig.KAFKA_SERVER_PORT && kafkaConfig.KAFKA_CONNECT_SERVER_PORT, objLogInfo) {
                            params.kafkaConfig = kafkaConfig;
                        _DeleteConnectorInKafka(params, function (deleteConnectorInfo) {
                            reqInstanceHelper.PrintInfo(serviceName, 'Now Going to Deleting a Connector from the Table...', objLogInfo);
                            _DeleteConnector(pTable, pRows).then((res) => {
                                reqInstanceHelper.PrintInfo(serviceName, 'Successfully Deleted a Connector from the Table...', objLogInfo);
                                reqInstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS', 'Connector Deleted successfully from the Table...');
                            }).catch((error) => {
                                reqInstanceHelper.PrintInfo(serviceName, 'Failed To Delete the Connector From the Table...', objLogInfo);
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DEL-CONN-00003', 'Failed to Delete a Connector From the Table...', error, 'FAILURE', '');
                            });
                        });
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Required Parameters are missed in this config...Kafka Config - ' + JSON.stringify(kafkaConfig), objLogInfo);
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DEL-CONN-00003', 'Required Parameters are missed in this config...Kafka Config - ' + JSON.stringify(kafkaConfig), error, 'FAILURE', '');
                    }
                    }


                });

                function _DeleteConnector(pTable, pRows) {
                    return new Promise((resolve, reject) => {
                        try {
                            reqDBInstance.DeleteFXDB(pClient, pTable, pRows, objLogInfo, function (pErr, pRes) {
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

                function _DeleteConnectorInKafka(pParam, _DeleteConnectorInKafkaCB) {
                    try {
                      /*   pParam Should Contains
                            - kafkaConfig */
                        var kafkaConfig = pParam.kafkaConfig;
                        reqInstanceHelper.PrintInfo(serviceName, 'Connector Status - ' + params.connector_status, objLogInfo);
                        if (params.connector_status) {
                            if (params.connector_status.toUpperCase() == 'STARTED') {
                                reqInstanceHelper.PrintInfo(serviceName, 'Going to Delete the Connector from the Kafka Connect Service...', objLogInfo);
                                var kafkaConnectUrl = 'http://' + kafkaConfig.SERVER + ':' + kafkaConfig.KAFKA_CONNECT_SERVER_PORT + '/connectors/';
                                var options = {
                                    url: kafkaConnectUrl+ params.connector_name,
                                    method: 'DELETE',
                                };
                                reqInstanceHelper.PrintInfo(serviceName, 'Kafka Connect URL - ' + kafkaConnectUrl, objLogInfo);
                                request(options, function (error, response, body) {
                                    if (error) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Error While Deleting a Connector...', objLogInfo);
                                        reqInstanceHelper.PrintInfo(serviceName, error, objLogInfo);
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DEL-CONN-00001', 'Error While Deleting a Connector...', error, 'FAILURE', '');
                                    } else {
                                        body = body ? JSON.parse(body) : body;
                                        if (body.error_code == 404) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Selected Connector is Not Existed within the Kafka...', objLogInfo);
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Successfully Deleted a Connector from the Kafka Connect Service...', objLogInfo);
                                        }
                                        _DeleteConnectorInKafkaCB();
                                    }
                                });
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'No Need to Delete the Connector from the Kafka Connect Service...', objLogInfo);
                                _DeleteConnectorInKafkaCB();
                            }
                        } else {
                            var info = 'Failed To Delete the Connector due to the Connector Status Information Missing from the Client Params...';
                            reqInstanceHelper.PrintInfo(serviceName, info, objLogInfo);
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DEL-CONN-00005', info, '', 'FAILURE', '');
                        }

                    } catch (error) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Catch Error While Deleting a Connector in _DeleteConnectorInKafka()...', objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, error, objLogInfo);
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-DEL-CONN-00002', 'Error While Deleting a Connector in _DeleteConnectorInKafka()...', error, 'FAILURE', '');
                    }
                }

            });
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Catch Error router.post(DeleteConnector)...', null);
        reqInstanceHelper.PrintInfo(serviceName, error, null);
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, null, 'ERR-DEL-CONN-00004', 'Catch Error router.post(DeleteConnector)...', error, 'FAILURE', '');

    }
});
module.exports = router;