/*
@Api_Name         : /savearchivalsetup,
@Description      : To create archival index 
@Last_Error_code  : ERR-HAN-
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqAsync = require('async');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('../../../../torus-references/transaction/Common');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');


router.post('/DeleteArchivalSetup', function (appRequest, appResponse) {
    try {
        var ServiceName = 'DeleteArchivalSetup';
        var pHeaders = appRequest.headers;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var objLogInfo = {};
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                // reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_Conn(cltClinet) {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                    _PrintInfo(objLogInfo, "Get Connection Ended");
                    var params = appRequest.body.PARAMS;
                    deleteArsetup();

                    function deleteArsetup() {
                        try {
                            var delCond = {
                                as_id: params.as_id
                            };
                            reqDBInstance.DeleteFXDB(pClient, 'ARCHIVAL_SETUP', delCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    var res = {};
                                    res.errMessage = " while delete archival setup  table ";
                                    res.errCode = "ERR-ARCH-45057";
                                    res.errobj = pErr;
                                    sendFailureRespone(res);
                                } else {
                                    reqTranDBInstance.DeleteTranDB(pSession, 'ARCHIVAL_QRY_INFO', delCond, objLogInfo, function (Res, err) {
                                        if (err) {
                                            var res = {};
                                            res.errMessage = " while delete archival query info table ";
                                            res.errCode = "ERR-ARCH-45055";
                                            res.errobj = err;
                                            sendFailureRespone(res);
                                        } else {
                                            reqTranDBInstance.DeleteTranDB(pSession, 'ARCHIVAL_PROCESS_INFO', delCond, objLogInfo, function (res, error) {
                                                if (error) {
                                                    var res = {};
                                                    res.errMessage = " while delete archival process table ";
                                                    res.errCode = "ERR-ARCH-45056";
                                                    res.errobj = error;
                                                    sendFailureRespone(res);
                                                } else {
                                                    reqInstanceHelper.SendResponse(ServiceName, appResponse, "SUCCESS", objLogInfo, '', '', '', 'SUCCESS');
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        } catch (error) {
                            var res = {};
                            res.errMessage = " when call  deleteArsetup ";
                            res.errCode = "ERR-ARCH-45058";
                            res.errobj = error;
                            sendFailureRespone(res);
                        }
                    };

                });

                function sendFailureRespone(pres) {
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, pres.errCode, pres.errMessage, pres.errobj, 'FAILURE');
                }

                function _PrintInfo(pLogInfo, pMessage) {
                    reqInstanceHelper.PrintInfo(ServiceName, pMessage, pLogInfo);
                }




            });
        });
    } catch (error) {
        var res = {};
        res.errMessage = "Exception occured prepareResult function";
        res.errCode = "ERR-ARCH-45002";
        res.errobj = error;
        sendFailureRespone(res);

    }
});

module.exports = router;