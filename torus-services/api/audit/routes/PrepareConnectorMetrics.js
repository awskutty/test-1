/*
@Api_Name         : /PrepareConnectorMetrics,
@Description      : To Load Connector List Info 
@Last_Error_code  : ERR-ARCH-45005
*/


// Require dependencies
var reqExpress = require('express');
var reqAsync = require('async');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');

var reqGetConnectorStatus = require('./GetConnectorStatus');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqKafkaConnectorHelper = require('./helper/KafkaConnectorHelper');
router.get('/PrepareConnectorMetrics', function (appRequest, appResponse) {
    try {
        var connectorMetrics = '';
        var ServiceName = 'PrepareConnectorMetrics';
        var ConnectorInfo = reqGetConnectorStatus.ConnectorInfo;
        var objLogInfo = ConnectorInfo.objLogInfo;
        reqInstanceHelper.PrintInfo(ServiceName, 'Getting Connector List From Memory', objLogInfo);
        reqAsync.forEachOfSeries(ConnectorInfo.routingkeys, function (routingKey, i, routingKeyCB) {
            var headers = { routingKey: i.toUpperCase() };
            var kafkaConnectorsReqObj = {};
            kafkaConnectorsReqObj.objLogInfo = objLogInfo;
            kafkaConnectorsReqObj.headers = headers;
            kafkaConnectorsReqObj.connectorsList = routingKey.connectorList;
            reqKafkaConnectorHelper.GetConnectorStatus(kafkaConnectorsReqObj, function (error, kafkaConnectorsCBResult) {
                var connectorStatus = '';
                for (let c = 0; c < kafkaConnectorsCBResult.data.length; c++) {
                    const element = kafkaConnectorsCBResult.data[c];
                    if (element.status.toUpperCase() == 'STARTED' || element.status.toUpperCase() == 'CREATED') {
                        connectorStatus = '1'; // Success Case
                    } else {
                        connectorStatus = '0'; // Failure Case
                    }
                    // connectorMetrics = connectorMetrics + element.connector_name + ' ' + connectorStatus + '\n';
                    // connectorMetrics = connectorMetrics + routingKey.serverInfo + '_' + element.connector_name + ' ' + connectorStatus + '\n';
                    connectorMetrics = connectorMetrics + element.connector_name + '_' + routingKey.serverInfo + ' ' + connectorStatus + '\n';
                }
                routingKeyCB();
            });
        },
            function (params) {
                // connectorMetrics = '';
                // connectorMetrics = connectorMetrics + 'connectors_count 101' + '\n';
                // connectorMetrics = connectorMetrics + 'connectors_list 20' + '\n';
                // // connectorMetrics = connectorMetrics + 'DB_HST_TRN_ATTACHMENTS_SRC 1' + '\n';
                // connectorMetrics = connectorMetrics + '1_DB_HST_TRN_ATTACHMENTS_SRC 1' + '\n';
                // connectorMetrics = connectorMetrics + 'DB_HST_TRN_ATTACHMENTS_SRC_1 1' + '\n';
                appResponse.end(connectorMetrics);
                connectorMetrics = '';
                reqLogWriter.EventUpdate(objLogInfo);
            });
    } catch (error) {
        reqInstanceHelper.PrintInfo(ServiceName, 'Catch Error in router.post(/PrepareConnectorMetrics)....', null);
        reqInstanceHelper.PrintInfo(ServiceName, error, null);
        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', null, 'ERR-ARCH-45005', 'Catch Error in router.post(/PrepareConnectorMetrics)....', error, 'FAILURE');
    }

});
module.exports = router;