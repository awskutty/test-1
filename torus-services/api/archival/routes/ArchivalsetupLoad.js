/*
@Api_Name         : /ArchivalIndex,
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
router.post('/loadarsetup', function (appRequest, appResponse) {
    try {

        var ServiceName = 'savearchivalsetup';
        var pHeaders = appRequest.headers;
        var objLogInfo = {};
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                var params = appRequest.body.PARAMS;
                var objcond = {};

                objcond.APP_ID = objLogInfo.APP_ID;
                objcond.DT_CODE = params.DTCode;
                objcond.DTT_CODE = params.DttCode;


                // if (params.TableType === 'STATIC') {
                objcond = {};

                objcond.APP_ID = objLogInfo.APP_ID;
                objcond.TARGET_TABLE = params.TargetTable;
                if (params.Mode && params.Mode == 'TENANT') {
                    objcond.TENANT_ID = objLogInfo.TENANT_ID
                }
                // }

                _gefromtable(objcond).then(function (result) {
                    // appResponse.send(result);
                    reqInstanceHelper.SendResponse(ServiceName, appResponse, result, objLogInfo, '', '', '', 'SUCCESS');

                }).catch(function (error) {
                    // error/exception hanling
                    sendFailureRespone(res);
                });




                function _gefromtable(objCond) {
                    return new Promise((resolve, reject) => {
                        try {
                            reqDBInstance.GetTableFromFXDBNoCache(pClient, "ARCHIVAL_SETUP", [], objCond, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    var res = {};
                                    res.errMessage = "Error occured _gefromtable ARCHIVAL_SETUP function";
                                    res.errCode = "ERR-ARCH-45030";
                                    res.errobj = pErr;
                                    reject(pErr);
                                } else {
                                    resolve(pRes.rows[0]);
                                }
                            });
                        } catch (error) {
                            var res = {};
                            res.errMessage = "Exception occured _gefromtable function";
                            res.errCode = "ERR-ARCH-45030";
                            res.errobj = error;
                            reject(res);
                        }
                    });
                }
            });
        });

        function sendFailureRespone(pres) {
            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, pres.errCode, pres.errMessage, pres.errobj, 'FAILURE');
        }
    } catch (error) {
        var res = {};
        res.errMessage = "Exception occured loadarsetup function";
        res.errCode = "ERR-ARCH-45030";
        res.errobj = error;
        sendFailureRespone(res);
    }
});

module.exports = router;