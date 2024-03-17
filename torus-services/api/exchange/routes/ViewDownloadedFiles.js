/**
 * @Api_Name        : /ViewCreatedFiles,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-VIEWDOWNLOADEDFILE-1003
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var fs = require('fs');
var serviceName = "ViewDownloadedFiles";

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];

router.post('/ViewDownloadedFiles', function (appRequest, appResponse) {
    var inputRequest = appRequest.body.PARAMS;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var APP_ID = objSessionInfo.APP_ID;
        var TENANT_ID = objSessionInfo.TENANT_ID;
        var FFG_CODE = inputRequest.EXFFG_CODE;

        objLogInfo.PROCESS = 'VIEW_DOWNLOADED_FILES_PROCESS';
        objLogInfo.HANDLER_CODE = 'VIEW_DOWNLOADED_FILES';
        objLogInfo.ACTION_DESC = 'VIEWDOWNLOADEDFILES';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;

            reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                var mHeaders = appRequest.headers;
                getDBInstances(mHeaders, objLogInfo, function (DBInstance) {
                    inputRequest["session"] = objSessionInfo;
                    Object.assign(inputRequest, DBInstance);
                    inputRequest["session"] = objSessionInfo;
                    inputRequest['tenant_id'] = TENANT_ID;
                    inputRequest['TENANT_ID'] = TENANT_ID

                    var isLatestPlatformVersion = false;
                    var newPlatformFilters = " and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "'";
                    var selectFileSize = '';
                    if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
                        reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
                        isLatestPlatformVersion = true;
                        selectFileSize = 'file_size,';
                    }
                    var query = "select exhf_id as file_id, file_name as name, " + selectFileSize + " file_status as STATUS, eh.exffg_code  from ex_header_files ehf inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where file_status = 'DOWNLOADED' and exffg_code= '" + inputRequest.EXFFG_CODE + "' ";
                    if (isLatestPlatformVersion) {
                        reqInstanceHelper.PrintInfo(serviceName, 'For Screen, APP_ID and TENANT_ID filters are Added in the Query..', objLogInfo);
                        query = query + newPlatformFilters;
                    }
                    reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                        if (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXC-', 'Error Getting downloaded files ', error);
                        } else {
                            var files = [];
                            var rows = result.rows;
                            for (var i = 0; i < rows.length; i++) {
                                files.push({
                                    name: rows[i]['name'],
                                    hf_id: rows[i]['file_id'],
                                    STATUS: rows[i]['status'],
                                    size: rows[i]['file_size']
                                });
                            }
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, files, objLogInfo, null, null, null);
                        }
                    });
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-VIEWDOWNLOADEDFILE-1000', 'Catch Error while Preparing Downloaded Files... ', error);
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