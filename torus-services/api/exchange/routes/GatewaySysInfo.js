/**
 * @Api_Name        : /GatewaySysInfo,
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
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var serviceName = "ImportFile";

router.post('/GatewaySysInfo', function (appRequest, appResponse) {
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var APP_ID = objSessionInfo.APP_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-ExportFile';
        objLogInfo.ACTION_DESC = 'ExportFile';

        appResponse.on('close', function () {});
        appResponse.on('finish', function () {});
        appResponse.on('end', function () {});
        try {
            var mHeaders = appRequest.headers;

        }
        catch(ex){

        }
    });
});
module.exports = router;