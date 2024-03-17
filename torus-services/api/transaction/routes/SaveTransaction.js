/*
    @Api_Name           : /SaveTransaction,
    @Description        : To save data to transaction DB target table and transaction_set
    @Last Error Code    : 'ERR-TRX-100042'
*/

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var router = reqExpress.Router();
var serviceName = 'SaveTransaction';

// Host api to server
router.post('/SaveTransaction', function SaveTransaction(appRequest, appResponse) {

    try {
        var reqSaveTransactionHelper = require('../../../../torus-references/transaction/SaveTransactionHelper');
        reqLogInfo.AssignLogInfoDetail(appRequest, function (LogInfo, objSessionInfo) {
            var objLogInfo = LogInfo;
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            try {
                objLogInfo.HANDLER_CODE = 'SAVE_TRAN';
                // Handle the close event when client closes the api request
                appResponse.on('close', function () { // This will call unexpected close from client
                    reqSaveTransactionHelper.FinishApiCall(objLogInfo);
                });
                appResponse.on('finish', function () {
                    reqSaveTransactionHelper.FinishApiCall(objLogInfo);

                });
                appResponse.on('end', function () {
                    reqSaveTransactionHelper.FinishApiCall(objLogInfo);

                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                var mSession;

                // Use the APP_ID, If APP_ID is available from the request params
                if (params.APP_ID) {
                    objLogInfo.APP_ID = params.APP_ID;
                    objSessionInfo.APP_ID = params.APP_ID;
                }

                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                // Call hepler class function
                reqSaveTransactionHelper.SaveTransaction(params, headers, objLogInfo, function (error, result, info) {
                    try {
                        var data = '';
                        if (error) {
                            if (error.ERROR.message && error.ERROR.message.indexOf('unique constraint') > -1) {
                                // This is for oracle 
                                data = "Data already exist";
                                error.INFO = error.ERROR.message;
                                reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, error.ERROR_CODE, '', '', 'FAILURE', error.INFO);
                            } else if (error.ERROR.message && error.ERROR.message.indexOf('ORA-01400') > -1) {
                                data = "Some mandatory field has null value";
                                error.INFO = error.ERROR.message;
                                reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, error.ERROR_CODE, '', '', 'FAILURE', error.INFO);
                            } else if (error.ERROR && error.ERROR.toString().indexOf('unique constraint') > -1) {
                                // This is for Pg 
                                data = "Data already exist";
                                error.INFO = error.ERROR;
                                reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, error.ERROR_CODE, '', '', 'FAILURE', error.INFO);
                            } else if (error.ERROR && error.ERROR.toString().indexOf('not-null constraint') > -1) {
                                data = "Some mandatory field has null value";
                                error.INFO = error.ERROR;
                                reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, error.ERROR_CODE, '', '', 'FAILURE', error.INFO);
                            } else {
                                params = null;
                                headers = null;
                                appRequest = null
                                sessionInfoKeys = null;
                                reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                                data = null;

                            }
                        } else if (info) {
                            params = null;
                            headers = null;
                            appRequest = null;
                            sessionInfoKeys = null;
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);

                        } else {
                            params = null;
                            headers = null;
                            appRequest = null;
                            sessionInfoKeys = null;
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);

                        }
                    } catch (error) {
                        params = null;
                        headers = null;
                        appRequest = null;
                        sessionInfoKeys = null;
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-TRX-100002', 'Error in reqSaveTransactionHelper.SaveTransaction callback', error);
                    }
                });
            } catch (error) {
                params = null;
                headers = null;
                sessionInfoKeys = null;
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-TRX-100003', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        params = null;
        sessionInfoKeys = null;
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', null, 'ERR-TRX-100004', 'Error in SaveTransaction function', error);
    }
});

module.exports = router;
/********* End of Service *********/