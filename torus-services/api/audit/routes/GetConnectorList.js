/*
@Api_Name         : /LoadConnectors,
@Description      : To Load Connector List Info 
@Last_Error_code  : ERR-ARCH-45005
*/


// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqKafkaConnectorHelper = require('./helper/KafkaConnectorHelper');
router.post('/LoadConnectors', function (appRequest, appResponse) {
    try {
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var ServiceName = 'LoadConnectors';
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                var cond = {};
                if (!params.connector_info) {
                    _getConnectorsFromTable();
                } else {
                    var kafkaConnectorsReqObj = {};
                    kafkaConnectorsReqObj.objLogInfo = objLogInfo;
                    kafkaConnectorsReqObj.headers = pHeaders;
                    kafkaConnectorsReqObj.connectorsList = [params.connector_info];
                    reqKafkaConnectorHelper.GetConnectorStatus(kafkaConnectorsReqObj, function (error, kafkaConnectorsCBResult) {
                        prepareResult(kafkaConnectorsCBResult.data);
                    });
                }

                reqInstanceHelper.PrintInfo(ServiceName, 'Getting Connector List...', objLogInfo);
                function _getConnectorsFromTable() {
                    try {
                        reqDBInstance.GetTableFromFXDBNoCache(pClient, "CONNECTORS", [], cond, objLogInfo, function (perr, pRes) {
                            if (perr) {
                                reqInstanceHelper.PrintInfo(ServiceName, 'Error while Getting Connector List from Table...', objLogInfo);
                                reqInstanceHelper.PrintInfo(ServiceName, perr, objLogInfo);
                                var res = {};
                                res.message = "Error occured while query CONNECTORS";
                                res.errCode = "ERR-ARCH-45001";
                                res.errobj = perr;
                                res.data = [];
                                sendFailureRespone(res);
                            } else {
                                if (pRes.rows && pRes.rows.length) {
                                    reqInstanceHelper.PrintInfo(ServiceName, 'Got Connector List from the Table...', objLogInfo);
                                    var kafkaConnectorsReqObj = {};
                                    kafkaConnectorsReqObj.objLogInfo = objLogInfo;
                                    kafkaConnectorsReqObj.headers = pHeaders;
                                    kafkaConnectorsReqObj.connectorsList = pRes.rows;
                                    reqKafkaConnectorHelper.GetConnectorStatus(kafkaConnectorsReqObj, function (error, kafkaConnectorsCBResult) {
                                        prepareResult(kafkaConnectorsCBResult.data);
                                    });

                                } else {
                                    reqInstanceHelper.PrintInfo(ServiceName, 'There is No Connector Data from the Table...', objLogInfo);
                                    var res = {};
                                    res.message = "There is No Connector Data Found in the Table....";
                                    res.errobj = null;
                                    res.errCode = "ERR-ARCH-45003";
                                    res.data = [];
                                    sendFailureRespone(res);
                                }
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.PrintInfo(ServiceName, 'Catch Error in _getConnectorsTable()....', objLogInfo);
                        reqInstanceHelper.PrintInfo(ServiceName, error, objLogInfo);
                        var res = {};
                        res.message = "Catch Error in _getConnectorsTable()....";
                        res.errCode = "ERR-ARCH-45002";
                        res.data = [];
                        res.errobj = error;
                        sendFailureRespone(res);
                    }
                };

                function prepareResult(pData, TableType, dtCode, dtDesc) {
                    try {
                        var arrRes = pData;
                        reqInstanceHelper.SendResponse(ServiceName, appResponse, arrRes, objLogInfo, '', '', '', '');
                    } catch (error) {
                        reqInstanceHelper.PrintInfo(ServiceName, 'Catch Error in prepareResult()....', objLogInfo);
                        reqInstanceHelper.PrintInfo(ServiceName, error, objLogInfo);
                        var res = {};
                        res.message = "Exception occured prepareResult function";
                        res.errCode = "ERR-ARCH-45004";
                        res.errobj = error;
                        res.data = [];
                        sendFailureRespone(perr);
                    }
                }

                function sendFailureRespone(pres) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, pres.data, objLogInfo, pres.errCode, '', pres.errobj, 'SUCCESS', pres.message);
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(ServiceName, 'Catch Error in router.post(/LoadConnectors)....', null);
        reqInstanceHelper.PrintInfo(ServiceName, error, null);
        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', null, 'ERR-ARCH-45005', 'Catch Error in router.post(/LoadConnectors)....', error, 'FAILURE');
    }

});
module.exports = router;