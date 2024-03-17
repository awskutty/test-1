/**
 * @Api_Name        : /ViewCreatedFiles,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR_VIEW_UPDATE_FAILED_FILES_0002
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "ViewUpdateFailedFiles";


router.post('/ViewUpdateFailedFiles', function (appRequest, appResponse) {
    var params = appRequest.body.PARAMS;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        var APP_ID = objSessionInfo.APP_ID;
        var TENANT_ID = objSessionInfo.TENANT_ID;
        var FFG_CODE = params.EXFFG_CODE;
        // var FFG_CODE = 'EFTC_OP_SIMREP_FD';
        var UPDATED_SUCESSFILE = params.ACTION;

        objLogInfo.PROCESS = 'EXCHANGE_UPDATE_FAILED';
        objLogInfo.HANDLER_CODE = 'EXCHANGE_UPDATE_FAILED_FILES';
        objLogInfo.ACTION_DESC = 'ViewUpdateFailedFiles';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                // Getting the Update Failed Files From Database
                //var query = "select exhf_id as file_id, file_name as name, file_size , file_status as status, eh.exffg_code  from ex_header_files ehf inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where file_status = 'PARSING_FAILED' and exffg_code= '" + FFG_CODE + "' and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "' ";
                if (UPDATED_SUCESSFILE == "Update_Success") {
                    var query = "select exhf_id as file_id, file_name as name, file_size , file_status as status, eh.exffg_code  from ex_header_files ehf inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where ehf.file_status = 'UPDATED' and eh.exffg_code= '" + FFG_CODE + "' and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "' ";
                } else {
                    var query = "select exhf_id as file_id, file_name as name, file_size , file_status as status, eh.exffg_code  from ex_header_files ehf inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where file_status = 'PARSING_FAILED' and exffg_code= '" + FFG_CODE + "' and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "' ";
                }
                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_VIEW_UPDATE_FAILED_FILES_0002', 'Error While Getting Update Failed Files ', error);
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
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_VIEW_UPDATE_FAILED_FILES_0001', 'Catch Error while Preparing Update Failed Files... ', error);
        }
    });
});



module.exports = router;