/*
    @Api_Name           : /SaveTransaction,
    @Description        : To save data to transaction DB target table and transaction_set
    @Last Error Code    : 'ERR-TRX-100042'
*/

// Require dependencies
var reqExpress = require('express');
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var router = reqExpress.Router();
var serviceName = 'SaveTransaction';

// Host api to server
router.post('/ext/SaveTransaction', function SaveTransaction(appRequest, appResponse) {
    var objLogInfo;
    try {
        //var reqSaveTransactionHelper = require('./helper/SaveTransactionHelper');
        var reqSaveTransactionHelper = require('../../../../../torus-references/transaction/SaveTransactionHelper');
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {


            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            try {
                objLogInfo.HANDLER_CODE = 'SAVE_TRAN';
                // Handle the close event when client closes the api request
                appResponse.on('close', function () { // This will call unexpected close from client
                    reqSaveTransactionHelper.FinishApiCall();
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function () {
                    reqSaveTransactionHelper.FinishApiCall();
                });
                appResponse.on('end', function () {
                    reqSaveTransactionHelper.FinishApiCall();
                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }

                if (params.LOGIN_NAME) {
                    reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (cltClient) {
                        reqDBInstance.GetTableFromFXDB(cltClient, 'users', ['u_id', 'appur_sts'], { login_name: params.LOGIN_NAME.toUpperCase() }, objLogInfo, function (error, result) {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'errcode', 'errmsg', error);
                            } else {
                                var row = result.rows[0];
                                params.U_ID = row.u_id;
                                var appur_sts = new reqLinq(JSON.parse(row.appur_sts))
                                    .Where(function (item) {
                                        return item.APP_CODE == params.APP_CODE;
                                    }).FirstOrDefault();
                                params.APP_ID = appur_sts.APP_ID;
                                var clustersystems = JSON.parse(appur_sts.CLUSTER_NODES)[0].clustersystems[0];
                                params.S_ID = clustersystems.data.s_id;
                                params.SYSTEM_DESC = clustersystems.data.sysDesc;
                                callHelper();
                            }
                        });
                    });
                } else {
                    callHelper();
                }

                // Call hepler class function
                function callHelper() {
                    try {
                        reqSaveTransactionHelper.SaveTransaction(params, headers, objLogInfo, function (error, result, info) {
                            try {
                                if (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                                } else if (info) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-TRX-100002', 'Error in reqSaveTransactionHelper.SaveTransaction callback', error);
                            }
                        });
                    } catch (error) {

                    }
                }
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-TRX-100003', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', null, 'ERR-TRX-100004', 'Error in SaveTransaction function', error);
    }
});

module.exports = router;
/********* End of Service *********/