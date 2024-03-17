/*
@Api_Name           : /Save Access TimeLog,
@Description        : To save accessing time of a document in client side to database (Attachment viewer opening time)
@Last_Error_code    : ERR-HAN-41205 
*/

// Require dependencies
var reqExpress = require('express');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var casclient = '';
var mTranDB = '';
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var strServiceName = 'SaveAccessTimeLog';


router.post('/SaveAccessTimeLog', function (appRequest, appResponse, next) {
    var objLogInfo = '';
    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
        objLogInfo = pLogInfo;
        reqInsHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
        // Handle the api close event from when client close the request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        var pHeaders = appRequest.headers;
        objLogInfo.HANDLER_CODE = 'SAVE_ACCESS_TIME_LOG';
        var clientparam = appRequest.body.PARAMS;
        var dr = {};
        var PTarget = {};
        var pVWActionId = '';
        var pAppId = '';
        var drWf_info = {};
        var WFINFO = [];
        var pPARAM_VALUE;
        var param_detail;

        InitializeDB(pHeaders, function callbackInitializeDB() {
            SaveAccessTimeLog(clientparam);
        });

        // Save the time to DB
        function SaveAccessTimeLog(clientparam) {
            try {
                dr.TRNA_ID = clientparam.TRNA_ID;
                dr.PAGE_NO = clientparam.PAGE_NO;
                if (clientparam.START_TIME != null) {
                    dr.START_TIME = clientparam.START_TIME;
                };
                if (clientparam.END_TIME != null) {
                    dr.END_TIME = clientparam.END_TIME;
                };
                if (session_info.U_ID != null) {
                    dr.CREATED_BY = session_info.U_ID;
                }
                dr.CREATED_DATE = Date.now();
                dr.CREATED_BY_STS_ID = session_info.APP_STS_ID;
                dr.VERSION_NO = 0;
                dr.CREATED_BY_NAME = session_info.LOGIN_NAME;
                dr.SYSTEM_NAME = session_info.SYSTEM_DESC;

                PTarget = dr;
                pVWActionId = clientparam.VWFTPAID;
                pAppId = session_info.APP_ID;

                SaveAccessTimeLogs(PTarget, pVWActionId, pAppId, function (response) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, response, objLogInfo, '', "", "");
                });
            } catch (error) {
                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41201', "Error in SaveAccessTimeLog function - ", error);

            }
        };

        // Query wf_info and find NEED_ACCESS_TIME_LOG asked or not 
        function SaveAccessTimeLogs(PTarget, pVWActionId, pAppId, callback) {
            if (pVWActionId != undefined && pVWActionId != "") {
                reqFXDBInstance.GetTableFromFXDB(casclient, 'wf_info', [], {
                    app_id: pAppId,
                    wftpa_id: pVWActionId
                }, objLogInfo, function (err, result) {
                    try {
                        if (err) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41202', "Error while  wf_info execution - ", err);
                        } else {
                            if (result.rows.length != 0) {
                                drWf_info = result.rows[0].param_json;
                                WFINFO = JSON.parse(drWf_info);
                                var blnNeedAccessTimeLog = false;
                                WFINFO.forEach(function (obj) {
                                    if (obj.PARAM_NAME == 'NEED_ACCESS_TIME_LOG' && obj.PARAM_VALUE == 'Y') {
                                        blnNeedAccessTimeLog = true;
                                        InsertSaveAccessTime(PTarget, function (presponse) {
                                            return callback('SUCCESS');
                                        });
                                    }
                                });
                            }
                            if (!blnNeedAccessTimeLog)
                                return callback('NEED_ACCESS_TIME_LOG setup missing');

                        }
                    } catch (error) {
                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41203', "Error in  SaveAccessTimeLogs function - ", error);
                    }
                });
            } else {
                return callback("NEED_ACCESS_TIME_LOG setup missing");
            }
        };

        // Insert data into trna_access_time_logs
        function InsertSaveAccessTime(PTarget, callback) {
            try {
                var param = [{
                    trna_id: PTarget.TRNA_ID,
                    page_no: PTarget.PAGE_NO,
                    start_time: PTarget.START_TIME,
                    end_time: PTarget.END_TIME,
                    created_by_sts_id: session_info.APPSTS_ID,
                    version_no: 0,
                    created_by_name: session_info.LOGIN_NAME,
                    system_name: session_info.SYSTEM_DESC,
                    APP_ID: objLogInfo.APP_ID,
                    TENANT_ID: objLogInfo.TENANT_ID
                }];
                reqTranDBInstance.InsertTranDBWithAudit(mTranDB, 'trna_access_time_logs', param, objLogInfo, function callbackExecuteSQL(pRes) {
                    if (pRes.rows != '') {
                        var trnaatl_id = pRes[0].trnaatl_id;
                        _PrintInfo('Access ID : ' + trnaatl_id);
                        return callback('SUCCESS');
                    }
                });

            } catch (error) {
                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41204', "Error while trna_access_time_logs execution - ", error);
            }
        };

        // Print information
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo);
        }

        // Print error message
        function _PrintErr(pError, pErrorCode, pMessage) {
            reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage);
        }

        // Get the dep_cas instance and tran DB instance
        function InitializeDB(pHeaders, callback) {
            try {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                    casclient = pClient;

                    reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                        mTranDB = pSession;
                        callback();
                    });
                });
            } catch (error) {
                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41205', "Error while InitializeDB - ", error);
            }

        }
    });
});

module.exports = router;
/********* End of Service *******/