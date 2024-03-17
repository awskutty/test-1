/**
 * @Api_Name        : /LoadExchangeGateway,
 * @Description     : To load Exchange gateway details
 * @Last_Error_Code : ERR-EXC-1000
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath+'instance/DBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "LoadExchangeGateway";
var router = reqExpress.Router();


router.post('/LoadExchangeGateway', function (appRequest, appResponse) {

    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
        objLogInfo.ACTION_DESC = 'ExportFile';

        appResponse.on('close', function () {});
        appResponse.on('finish', function () {});
        appResponse.on('end', function () {});

        try {
            var mHeaders = appRequest.headers;
            var reqBody = appRequest.body.PARAMS;
            reqBody['tenant_id'] = objSessionInfo['TENANT_ID'];
            reqBody['TENANT_ID'] = objSessionInfo['TENANT_ID'];

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                reqBody.dep_cas_instance = dep_cas_instance;
                reqBody.objLogInfo = objLogInfo;
                reqExchangeHelper.LoadExchangeGateway(reqBody, function (responseData) {
                    if (responseData.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, responseData.SUCCESS_DATA, objLogInfo, null, null, null);
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, responseData.ERROR_CODE, responseData.ERROR_MESSAGE, responseData.ERROR_OBJECT);
                    }
                });
            });
        }
        catch(error){
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Exception Occured While Calling LoadExchangeGateway API ... ', error);
        }
    });

});

module.exports = router;
