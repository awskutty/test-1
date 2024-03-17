/*
@Api_Name         : /StartAllConnector,
@Description      : To Start All Connector in the kafka  Connect Service
@Last_Error_code  : ERR-START-CONN-00002
*/


// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqKafkaConnectorHelper = require('./helper/KafkaConnectorHelper');
router.post('/StartAllConnector', function (appRequest, appResponse) {
    try {
        var ServiceName = 'StartAllConnector';
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var connectorsList = params.connectorsList || [];
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqInstanceHelper.PrintInfo(ServiceName, 'Connector Count - ' + connectorsList.length, objLogInfo);
            if (connectorsList.length) {
                reqInstanceHelper.PrintInfo(ServiceName, 'Starting a Connector...', objLogInfo);
                reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                    var kafkaConnectorsReqObj = {};
                    kafkaConnectorsReqObj.objLogInfo = objLogInfo;
                    kafkaConnectorsReqObj.dep_cas_instance = dep_cas_instance;
                    kafkaConnectorsReqObj.connectorsList = connectorsList;
                    kafkaConnectorsReqObj.headers = pHeaders;
                    var kafkaConfig = 'KAFKA_CONFIG~';
                    reqInstanceHelper.PrintInfo(ServiceName, 'Getting Kafka Config for Routing Key - ' + kafkaConfig, objLogInfo);
                    reqTranDBInstance.GetRedisKeyConfig(pHeaders, kafkaConfig, false, objLogInfo, function (kafkaConfig, error) {
                        kafkaConnectorsReqObj.kafkaConfig = kafkaConfig;
                        reqKafkaConnectorHelper.StartKafkaConnectors(kafkaConnectorsReqObj, function (error, kafkaConnectorsCBResult) {
                            if (error) {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, kafkaConnectorsCBResult.data, objLogInfo, '', kafkaConnectorsCBResult.message, error, 'FAILURE', '');
                            } else {
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, kafkaConnectorsCBResult.data, objLogInfo, '', '', error, 'SUCCESS', kafkaConnectorsCBResult.message);
                            }
                        });
                    });
                })
            } else {
                reqInstanceHelper.PrintInfo(ServiceName, 'There is No Connector List Found From Client Params...', objLogInfo);
                reqInstanceHelper.SendResponse(ServiceName, appResponse, null, objLogInfo, 'ERR-START-CONN-00002', 'There is No Connector List Found From Client Params...', error, 'FAILURE', '');
            }
        });
    }
    catch (error) {
        reqInstanceHelper.PrintInfo(ServiceName, 'Catch Error in router.post(/StartConnector)...', null);
        reqInstanceHelper.PrintInfo(ServiceName, error, null);
        reqInstanceHelper.SendResponse(ServiceName, appResponse, null, null, 'ERR-START-CONN-00001', 'Catch Error in router.post(/StartConnector)', error, 'FAILURE', '');
    }

});

module.exports = router;