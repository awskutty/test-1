/**
 * @Api_Name        : /ViewCreatedFiles,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR_GET_EX_LOGS_0002
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqMoment = require('moment');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "GetExgLogs";


router.post('/GetExgLogs', function (appRequest, appResponse) {
    var params = appRequest.body.PARAMS;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var EXHF_ID = params.EXHF_ID;
        var STATUS = params.STATUS;

        objLogInfo.PROCESS = 'GET_EXG_LOGS';
        objLogInfo.HANDLER_CODE = 'GET EXCHANGE LOGS';
        objLogInfo.ACTION_DESC = 'GET_EXG_LOGS';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                // Getting the Exg Logs From Database
                var query = "";
                if (EXHF_ID && STATUS) {
                    query = query + "select EL.log_message,EL.log_type,EL.created_date,EL.created_by,EL.exl_id,EHF.file_name,EL.status from EX_LOGS EL inner join EX_HEADER_FILES EHF on EL.EXHF_ID = EHF.EXHF_ID where EL.EXHF_ID = '" + EXHF_ID + "' and EL.status = '" + STATUS + "'";
                }
                else if (EXHF_ID) {
                    query = query + "select EL.log_message,EL.log_type,EL.created_date,EL.created_by,EL.exl_id,EHF.file_name,EL.status from EX_LOGS EL inner join EX_HEADER_FILES EHF on EL.EXHF_ID = EHF.EXHF_ID where EL.EXHF_ID = '" + EXHF_ID + "'";
                }
                else if (STATUS) {
                    query = query + "select * from EX_LOGS EL where EL.status = '" + STATUS + "'";
                } else {
                    query = "select * from EX_LOGS EL";
                }
                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_GET_EX_LOGS_0002', 'Error While Getting Ex Logs ', error);
                    } else {
                        var resultInfo = result.rows;
                        for (let index = 0; index < resultInfo.length; index++) {
                            var element = resultInfo[index];
                            if (element.created_date) {
                                element.created_date = reqMoment(element.created_date).format('YYYY-MM-DD hh:mm:ss A');
                            }
                        }
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, resultInfo, objLogInfo, null, null, null);
                    }
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_GET_EX_LOGS_0001', 'Catch Error while Preparing Ex Logs... ', error);
        }
    });
});



module.exports = router;