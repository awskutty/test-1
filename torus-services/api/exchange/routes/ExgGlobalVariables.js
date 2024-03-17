/**
 * @Api_Name        : /ExgGlobalVaribales,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXC-1000
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "ExgGlobalVaribales";
router.post('/ExgGlobalVaribales', function (appRequest, appResponse) {
    var SESSION_ID = "";
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfoobj, objSessionInfo) {
        var params = appRequest.body.PARAMS;
        var File_Names = params.file_names || [];
        objLogInfo = objLogInfoobj;
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'ExgGlobalVaribales';
        objLogInfo.PROCESS = 'ExgGlobalVaribales';
        objLogInfo.ACTION_DESC = 'ExgGlobalVaribales';
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            if (File_Names.length) {
                for (var i = 0; i < File_Names.length; i++) {
                    if (global.ht_exg_ftp_file_names.get(File_Names[i])) {
                        global.ht_exg_ftp_file_names.remove(File_Names[i]);
                    }
                }
            }
            appResponse.send(GetGlobalVariableDetails());
            function GetGlobalVariableDetails() {
                var result = {};
                result.ht_exg_ftp_file_names_Count = global.ht_exg_ftp_file_names.size();
                result.ht_exg_ftp_file_names_Values = global.ht_exg_ftp_file_names.values(); // Hash Table
                result.Exg_Down_DB_Insert_Failed_prct_ID_Count = global.Exg_Down_DB_Insert_Failed_prct_ID.length;
                result.Exg_Down_DB_Insert_Failed_prct_ID = global.Exg_Down_DB_Insert_Failed_prct_ID;
                result.Exg_Upload_DB_Insert_Failed = {
                    'DB_FAIL_PROCESS': global.ht_exg_DB_fail_process.get('DB_FAIL_PROCESS')
                };
                result.File_Download_DB_PRCT_Update_Failed = {
                    'HT_EXG_DOWN_PRCT_TO_NULL_PROCESS': global.ht_exg_Down_Prct_To_Null_process.get('HT_EXG_DOWN_PRCT_TO_NULL_PROCESS'),
                    'HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_1': global.ht_exg_Down_Prct_To_Null_process.get('HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_1'),
                    'HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_2': global.ht_exg_Down_Prct_To_Null_process.get('HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_2'),
                    'HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_3': global.ht_exg_Down_Prct_To_Null_process.get('HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_3'),
                    'HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_4': global.ht_exg_Down_Prct_To_Null_process.get('HT_EXG_DOWN_PRCT_TO_NULL_PROCESS_4'),
                };
                result.File_Download_Update_DB_PRCT_Update_Failed = {
                    'HT_EXG_DOWN_UPDATE_PRCT_TO_NULL_PROCESS': global.ht_exg_down_update_prct_to_null_process.get('HT_EXG_DOWN_UPDATE_PRCT_TO_NULL_PROCESS')
                };
                return result;
            }
        } catch (ex) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Exception occured", ex);
        }
    });

});

module.exports = router;