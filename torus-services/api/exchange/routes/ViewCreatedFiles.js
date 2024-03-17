/**
 * @Api_Name        : /ViewCreatedFiles,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXC-1000
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var serviceName = "ViewCreatedFiles";


router.post('/ViewCreatedFiles', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        objLogInfo.PROCESS = 'EXCHANGE_UPLOAD';
        objLogInfo.HANDLER_CODE = 'VIEW_CREATED_FILES';
        objLogInfo.ACTION_DESC = 'ViewCreatedFiles';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;

            getDBInstances(mHeaders, objLogInfo, function (DBInstance) {
                Object.assign(inputRequest, DBInstance);
                inputRequest["session"] = objSessionInfo;
                inputRequest['tenant_id'] = objSessionInfo['TENANT_ID'];
                inputRequest['objLogInfo'] = objLogInfo;

                reqTranDBInstance.GetTranDBConn(mHeaders, false, function (pSession) {
                    inputRequest['tran_db_instance'] = pSession;
                    reqExchangeHelper.GetCreatedFiles(inputRequest, function (pErrorCode, pErrorMesg, pErrorObj, pArrResponseData) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, pArrResponseData, objLogInfo, pErrorCode, pErrorMesg, pErrorObj);
                    });
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling SaveGateways API ... ', error);
        }
    });
});


function getDBInstances(mHeaders, objLogInfo, callBackDBInstance) {
    var obj = {
        "clt_cas_instance": ""
    };

    async.series({
        clt_cas_instance: function (callbackAsync) {
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                callbackAsync(null, clt_cas_instance);
            });
        }
    }, function (error, result) {
        if (error) {
            callBackDBInstance(obj);
        } else {
            callBackDBInstance(result);
        }
    });
}


module.exports = router;