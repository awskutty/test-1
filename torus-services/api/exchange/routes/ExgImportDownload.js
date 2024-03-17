/**
 * @Api_Name        : /ExgImportDownload,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXGIMPORTDOWNLOAD-100023
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqSvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqExchangeEngine = require('./helper/ExchangeEngine');
var reqAuditLog = require(refPath + 'log/audit/AuditLog');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var ftpHelper = require('./helper/FTPHelper');
var serviceName = "EXGImportDownload";
var commonFile = require('./util/Common')
var reqGetEligibleFileHelper = require('./helper/GetEligibleFileHelper')
var minimatch = require(modPath + 'minimatch');
var fs = require('fs');
var reqMoment = require('moment');
var reqPath = require("path");

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/ExgImportDownload', function (appRequest, appResponse) {
    // For Form Data Request Type , Reassiging the PARAMS
    if (!appRequest.body.PARAMS) {
        var reqBodyProcessInfoObj = appRequest.body.PROCESS_INFO;
        delete appRequest.body.PROCESS_INFO;
        var reqBodyParamsObj = appRequest.body;
        if (typeof reqBodyParamsObj.IS_FILE_FROM_CLIENT == 'string') {
            reqBodyParamsObj.IS_FILE_FROM_CLIENT = JSON.parse(reqBodyParamsObj.IS_FILE_FROM_CLIENT);
        }
        if (typeof reqBodyParamsObj.can_import == 'string') {
            reqBodyParamsObj.can_import = JSON.parse(reqBodyParamsObj.can_import);
        }
        if (typeof reqBodyParamsObj.FILE_COUNT_LIMIT == 'string') {
            reqBodyParamsObj.FILE_COUNT_LIMIT = JSON.parse(reqBodyParamsObj.FILE_COUNT_LIMIT);
        }
        if (typeof reqBodyParamsObj.FILE_MEM_TTL_IN_MS == 'string') {
            reqBodyParamsObj.FILE_MEM_TTL_IN_MS = JSON.parse(reqBodyParamsObj.FILE_MEM_TTL_IN_MS);
        }
        appRequest.body = {};
        appRequest.body.PARAMS = reqBodyParamsObj;
        appRequest.body.PROCESS_INFO = reqBodyProcessInfoObj;
    }
    var SESSION_ID = "";
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfoobj, objSessionInfo) {
        objLogInfo = objLogInfoobj;
        var isLatestPlatformVersion = false;
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
            isLatestPlatformVersion = true;
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_DOWNLOAD_IMPORT';
        objLogInfo.PROCESS = 'EXG_FILE_DOWNLOAD_IMPORT';
        objLogInfo.ACTION_DESC = 'DOWNLOAD_IMPORT_FILE';
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var CLIENT_FILES = appRequest.files || {};
            var reqBody = appRequest.body.PARAMS || appRequest.body;
            var reqObj = reqBody;
            var OriginalUrl = appRequest.originalUrl;
            var TENANT_ID = objSessionInfo.TENANT_ID;
            reqObj['TENANT_ID'] = TENANT_ID;
            reqObj['tenant_id'] = TENANT_ID;
            var FFG_CODE = reqBody.FFG_CODE;
            var GW_CODE = reqBody.GW_CODE;
            var Des_sys = reqBody.Des_sys;
            var IS_FILE_FROM_CLIENT = typeof reqBody.IS_FILE_FROM_CLIENT == 'string' && JSON.parse(reqBody.IS_FILE_FROM_CLIENT) || reqBody.IS_FILE_FROM_CLIENT;
            reqBody.DST_ID = Des_sys;
            var SOURCE_S_ID = objSessionInfo.S_ID;
            var APP_ID = objSessionInfo.APP_ID;
            reqObj.EXG_CODE = GW_CODE;
            var storagePath = "";
            var redisDb7TTL = "86400"; // Default as 1 day in seconds
            SESSION_ID = appRequest.body.SESSION_ID;
            var can_import = reqBody.CAN_IMPORT || reqBody.can_import || false;

            var OriginalSelectedFiles = [];

            var fileArr = []
            var selected_files = "";

            if (reqBody.Select_Mode == undefined) {
                reqBody.Select_Mode = "";
            }

            var Service_Log_Folder_Path = reqPath.join(__dirname, '../service_logs/download/' + objSessionInfo.TENANT_ID + '/' + objSessionInfo.APP_ID + '/' + FFG_CODE + '/');
            var processedServiceLogFolder = Service_Log_Folder_Path + 'PROCESSED/';
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                        reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (err, prct_id) {
                            var serviceParamRedisKey = 'SERVICE_PARAMS';
                            // Getting the Service params based on the Service Name from the Redis
                            reqInstanceHelper.GetConfig(serviceParamRedisKey, function (serviceParamRedisKeyValue, error) {
                                // reqInstanceHelper.PrintInfo(serviceName, 'Redis Key - ' + serviceParamRedisKey + ' Redis Value - ' + serviceParamRedisKeyValue, objLogInfo);
                                if (serviceParamRedisKeyValue) {
                                    try {
                                        serviceParamRedisKeyValue = JSON.parse(serviceParamRedisKeyValue)['Exchange'];
                                    } catch (error) {

                                    }
                                }
                                selected_files = typeof reqBody.Selected_items == 'string' && JSON.parse(reqBody.Selected_items) || reqBody.Selected_items;
                                var reqObjServiceLogFile = {};
                                reqObjServiceLogFile.Service_Log_Folder_Path = Service_Log_Folder_Path;
                                reqObjServiceLogFile.tran_db_instance = tran_db_instance;
                                reqInstanceHelper.CheckServiceLogFiles(reqObjServiceLogFile, objLogInfo, function (errorFiles) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Recovery Files Count - ' + errorFiles.length, objLogInfo);
                                    if (errorFiles.length) {
                                        // Checking Whether Recovery File Process is already in progress by using Redis Setnx Method
                                        var CheckRecoveryProcessInProgressReqObj = { objLogInfo: objLogInfo }
                                        CheckRecoveryProcessInProgress(CheckRecoveryProcessInProgressReqObj, function (error, result) {
                                            // result - Recover Process - if IN_PROGRESS, then true else false
                                            if (error || result) { // Not allowed to Process the Recovery Log Files
                                                GotoFileDownloadProcess();
                                            } else {
                                                async.forEachOfSeries(errorFiles, function (objErrorFile, index, errorFileCB) {
                                                    objErrorFile.file_path = Service_Log_Folder_Path + objErrorFile.file_name;
                                                    reqInstanceHelper.ReadingServiceLogFile(objErrorFile, objLogInfo, function (actualFileContent) {
                                                        var file_renaming = (objErrorFile.file_name).split('_');
                                                        var PRCT_ID_PROCESS = null;
                                                        var Table_Name = null;
                                                        var Table_Data = null;
                                                        // Creating Processed Folder for Moving the Processed Recovery Log Files
                                                        var folderCreationReqObj = { destination_folder_path: processedServiceLogFolder };
                                                        reqInstanceHelper.DynamicFolderCreationwithCallback(folderCreationReqObj, function () {
                                                            if (typeof actualFileContent == 'boolean') {
                                                                if (actualFileContent) {
                                                                    reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1])
                                                                        , function () {
                                                                            errorFileCB();
                                                                        });
                                                                } else {
                                                                    errorFileCB();
                                                                }
                                                            } else {
                                                                async.series({
                                                                    EmptyThePRCT_ID: function (EmptyThePRCT_IDCB) {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Updating PRCT_ID or making NULL in the EX_HEADER_FILES Table...', objLogInfo);
                                                                        PRCT_ID_PROCESS = actualFileContent.File_Down_Null_Prct_ID_Process || null;

                                                                        if (!PRCT_ID_PROCESS) {
                                                                            return EmptyThePRCT_IDCB();
                                                                        } else {
                                                                            var condObj = PRCT_ID_PROCESS.condObj;
                                                                            var updateColumn = PRCT_ID_PROCESS.updateColumn;
                                                                            reqTranDBInstance.UpdateTranDBWithAudit(tran_db_instance, 'EX_HEADER_FILES', updateColumn, condObj, objLogInfo, function (result, error) {
                                                                                if (error) {
                                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120059', 'PRCT_ID update or making NULL in the EX_HEADER_FILES Table is Failed...', error);
                                                                                    return EmptyThePRCT_IDCB();
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated PRCT_ID or making NULL in the EX_HEADER_FILES Table...', objLogInfo);
                                                                                    reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1])
                                                                                        , function () {
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'File Renamed Successfully', objLogInfo);
                                                                                            return EmptyThePRCT_IDCB();
                                                                                        });
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                    , DeleteTempTableByPRCT_ID: function (DeleteTempTableByPRCT_IDCB) {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Deleting PRCT_ID Data in the TMP_EX_HEADER_FILES Table...', objLogInfo);
                                                                        var DELETE_PRCT_ID_PROCESS = actualFileContent.DELETE_PRCT_ID || null;
                                                                        Table_Name = actualFileContent.Table_Name || null;
                                                                        if (!DELETE_PRCT_ID_PROCESS) {
                                                                            return DeleteTempTableByPRCT_IDCB();
                                                                        } else {
                                                                            var condObj = { PRCT_ID: DELETE_PRCT_ID_PROCESS };
                                                                            reqTranDBInstance.DeleteTranDB(tran_db_instance, Table_Name, condObj, objLogInfo, function (result, error) {
                                                                                if (error) {
                                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120069', 'Deleting PRCT_ID in the TMP_EX_HEADER_FILES Table is Failed...', error);
                                                                                    return DeleteTempTableByPRCT_IDCB();
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Successfully Deleted PRCT_ID Data in the TMP_EX_HEADER_FILES Table...', objLogInfo);
                                                                                    reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1])
                                                                                        , function () {
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'File Renamed Successfully', objLogInfo);
                                                                                            return DeleteTempTableByPRCT_IDCB();
                                                                                        });
                                                                                }
                                                                            });
                                                                        }
                                                                    }
                                                                    , INSERT_PROCESS: function () {
                                                                        // Getting Recovery Data from Recovery File 
                                                                        var INSERT_PROCESS = actualFileContent.EX_HEADER_FILES_INSERT_PROCESS || actualFileContent.EX_HEADER_INSERT_PROCESS || null;
                                                                        if (!INSERT_PROCESS) {
                                                                            return errorFileCB();
                                                                        } else {
                                                                            Table_Name = INSERT_PROCESS.Table_Name || null;
                                                                            Table_Data = INSERT_PROCESS.Table_Data || null;
                                                                            if (Table_Data && Table_Name) {
                                                                                for (let obj of Table_Data) {
                                                                                    // Converting Date Fields from ISO Format into Required format based on DB
                                                                                    if (obj.CREATED_DATE) {
                                                                                        obj.CREATED_DATE = new Date(obj.CREATED_DATE);
                                                                                    }
                                                                                }
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Inserting the Recovery FileData into the ' + Table_Name + ' Table...', objLogInfo);
                                                                                reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, Table_Name, Table_Data, objLogInfo, null, function (result, error) {
                                                                                    if (error) {
                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100017', 'Error While Inserting the Recovery FileData into the ' + Table_Name + ' Table...', error);
                                                                                        return errorFileCB();
                                                                                    } else {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully Inserted the Recovery FileData into the ' + Table_Name + ' Table...', objLogInfo);
                                                                                        reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1])
                                                                                            , function () {
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'File Renamed Successfully', objLogInfo);
                                                                                                return errorFileCB();
                                                                                            });
                                                                                    }
                                                                                });

                                                                            } else {
                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100016', 'Please check the Recovery Log File which has a Table Name and Table Data', error);
                                                                                return errorFileCB();
                                                                            }
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    });
                                                },
                                                    function () {
                                                        var DownloadRecoveryProcessRedisKey = 'DOWNLOAD_RECOVERY_PROCESS';
                                                        // After Processing the Recovery Log Files, Deleting the DOWNLOAD_RECOVERY_PROCESS Redis key from Redis DB3
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log Files Processed Successfully and Going to Delete the DOWNLOAD_RECOVERY_PROCESS Redis Key From Redis', objLogInfo);
                                                        reqRedisInstance.GetRedisConnectionwithIndex(3, async function (error, db3_redis_instance) {
                                                            if (error) {
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100021', 'Error While Getting Redis Connection with Index - 3 to Remove the Redis Key - DOWNLOAD_RECOVERY_PROCESS', error);
                                                                GotoFileDownloadProcess();
                                                            }
                                                            else {
                                                                // Deleting the DOWNLOAD_RECOVERY_PROCESS Redis key
                                                                // db3_redis_instance.del(DownloadRecoveryProcessRedisKey, function (error, result) {

                                                                var result = await db3_redis_instance.del(DownloadRecoveryProcessRedisKey)
                                                                if (result) {
                                                                    reqInstanceHelper.PrintInfo(serviceName, DownloadRecoveryProcessRedisKey + ' Redis Key is Deleted from the Redis...', objLogInfo);
                                                                } else {
                                                                    if (error) {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Error While Deleting Redis Key - ' + error, objLogInfo);
                                                                    }
                                                                    reqInstanceHelper.PrintInfo(serviceName, DownloadRecoveryProcessRedisKey + ' Redis Key is Not Deleted from the Redis...', objLogInfo);
                                                                }
                                                                GotoFileDownloadProcess();
                                                                // });
                                                            }
                                                        });
                                                    });
                                            }
                                        });
                                    } else { // If There is no Error File For Process
                                        GotoFileDownloadProcess();
                                    }
                                });

                                // Checking Whether Recovery File Process is already in progress by using Redis Setnx Method
                                function CheckRecoveryProcessInProgress(CheckRecoveryProcessInProgressParams, CheckRecoveryProcessInProgressCB) {
                                    try {
                                        var checkRecoveryObjLogInfo = CheckRecoveryProcessInProgressParams.objLogInfo;
                                        /*Should Contains
                                         - objLogInfo
                                        */
                                        reqInstanceHelper.PrintInfo(serviceName, 'Checking Whether the Recovery Process already in Progress or Not in Reids', checkRecoveryObjLogInfo);
                                        reqRedisInstance.GetRedisConnectionwithIndex(3, function (error, db3_redis_instance) {
                                            if (error) {
                                                reqInstanceHelper.PrintError(serviceName, checkRecoveryObjLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100020', 'Error While Getting Redis Connection with Index - 3', error);
                                                CheckRecoveryProcessInProgressCB(error, null) // Skipping the Recovery File Process Due to the Redis DB3 Connection Error
                                            }
                                            else {
                                                var dateFormatString = 'DD-MMM-YYYY hh:mm:ss A';
                                                var downloadRecoveryProcessKeyName = 'DOWNLOAD_RECOVERY_PROCESS';
                                                var downloadRecoveryProcessKeyValue = {};
                                                var downloadRecoveryProcessKeyTTL = '600'; // 10 Minutes in Seconds
                                                downloadRecoveryProcessKeyValue.PROCESS = downloadRecoveryProcessKeyName;
                                                downloadRecoveryProcessKeyValue.DATE_AND_TIME = reqDateFormatter.ConvertDate(new Date(), '', '', dateFormatString);
                                                // db3_redis_instance.set(downloadRecoveryProcessKeyName, JSON.stringify(downloadRecoveryProcessKeyValue), 'NX', 'EX', downloadRecoveryProcessKeyTTL, function (error, result) {
                                                reqRedisInstance.RedisSetNx(db3_redis_instance, downloadRecoveryProcessKeyName, JSON.stringify(downloadRecoveryProcessKeyValue), downloadRecoveryProcessKeyTTL, function () {
                                                    if (result) {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Starting Download Recovery File Process', checkRecoveryObjLogInfo);
                                                        // db3_redis_instance.set(downloadRecoveryProcessKeyName, JSON.stringify(downloadRecoveryProcessKeyValue), 'EX', downloadRecoveryProcessKeyTTL);
                                                        CheckRecoveryProcessInProgressCB(null, false) // Starting the Recovery Log Process
                                                    } else {

                                                        // Already the Recovery Log Process in Progress Case
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Download Recovery File Process is already in Progress', checkRecoveryObjLogInfo);
                                                        // If the DOWNLOAD_RECOVERY_PROCESS Redis Key is existing for long time then need to clear from the Redis
                                                        db3_redis_instance.get(downloadRecoveryProcessKeyName, function (error, downloadRecoveryProcessKeyValue) {
                                                            if (error) {
                                                                reqInstanceHelper.PrintError(serviceName, checkRecoveryObjLogInfo, 'ERR-EXG-100022', 'Error While Getting key Details  from  Redis Get Method with Index - 3', error);
                                                                CheckRecoveryProcessInProgressCB(null, true);
                                                            } else {
                                                                if (downloadRecoveryProcessKeyValue) {
                                                                    try {
                                                                        downloadRecoveryProcessKeyValue = JSON.parse(downloadRecoveryProcessKeyValue);
                                                                        var startTime = downloadRecoveryProcessKeyValue.DATE_AND_TIME;
                                                                        var calculatedTime = reqMoment(startTime, dateFormatString).add(downloadRecoveryProcessKeyTTL, 'seconds').format(dateFormatString);
                                                                        var currentTime = reqDateFormatter.ConvertDate(new Date(), '', '', dateFormatString);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Time Difference - ' + (new Date(currentTime).getTime() - new Date(calculatedTime).getTime()), checkRecoveryObjLogInfo);
                                                                        if (new Date(currentTime).getTime() > new Date(calculatedTime).getTime()) {
                                                                            // Need to Delete the Redis Key
                                                                            // db3_redis_instance.del(downloadRecoveryProcessKeyName, function (error, result) {
                                                                            reqRedisInstance.delRediskey(db3_redis_instance, downloadRecoveryProcessKeyName, function (result) {
                                                                                reqInstanceHelper.PrintInfo(serviceName, downloadRecoveryProcessKeyName + ' is Deleted from the Redis...', checkRecoveryObjLogInfo);
                                                                                CheckRecoveryProcessInProgressCB(null, true);
                                                                            });
                                                                        } else {
                                                                            CheckRecoveryProcessInProgressCB(null, true);
                                                                        }
                                                                    } catch (error) {
                                                                        reqInstanceHelper.PrintError(serviceName, checkRecoveryObjLogInfo, 'ERR-EXG-100023', 'Catch Error While Verifying the Redis Key Timing', error);
                                                                        CheckRecoveryProcessInProgressCB(null, true);
                                                                    }
                                                                } else {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Data From the Redis for Redis Key - ' + downloadRecoveryProcessKeyName, checkRecoveryObjLogInfo);
                                                                    CheckRecoveryProcessInProgressCB(null, true);
                                                                }
                                                            }
                                                        });
                                                    }
                                                });
                                            }
                                        });

                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, checkRecoveryObjLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100019', 'Catch Error in CheckRecoveryProcessInProgress()', error);
                                        CheckRecoveryProcessInProgressCB(error, null) // Skipping the Recovery File Process Due to the Catch Error
                                    }
                                }

                                function GotoFileDownloadProcess() {
                                    if (err || !prct_id) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100011', 'Error in GetProcessToken function', err);
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100011', "Error in GetProcessToken()", err);
                                    } else {
                                        var SKIP_FTP_DOWNLOAD = false;
                                        var cond = {};
                                        cond.setup_code = 'EXG_DOWNLOAD_MODE';
                                        reqSvchelper.GetSetupJson(clt_cas_instance, cond, objLogInfo, function (res) {
                                            if (res.Status == 'SUCCESS') {
                                                if (res.Data.length) {
                                                    var setup_json = JSON.parse(res.Data[0].setup_json);
                                                    if (setup_json && setup_json.EXG_DOWNLOAD_MODE == 'LOGICAL') {
                                                        SKIP_FTP_DOWNLOAD = true;
                                                    }
                                                }
                                                appRequest.body.SKIP_FTP_DOWNLOAD = SKIP_FTP_DOWNLOAD;
                                                appRequest.body.IS_FILE_FROM_CLIENT = IS_FILE_FROM_CLIENT;
                                                reqInstanceHelper.PrintInfo(serviceName, 'Skip FTP File Download Process - ' + SKIP_FTP_DOWNLOAD, objLogInfo);
                                                reqInstanceHelper.PrintInfo(serviceName, 'IS_FILE_FROM_CLIENT - ' + IS_FILE_FROM_CLIENT, objLogInfo);
                                                fetchFilesForDownload(appRequest, appResponse, prct_id, function (response) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'SELECTED_MODE ' + reqBody.Select_Mode, objLogInfo);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'request object ' + JSON.stringify(reqBody), objLogInfo);
                                                    selected_files = response.SUCCESS_DATA || []; // Assigning Files after File Validation Process 
                                                    var ffg_json = "";
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Selected_FILES COUNT ' + selected_files.length, objLogInfo);
                                                    if (selected_files && selected_files.length) {
                                                        try {
                                                            objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                                            reqObj.session = objSessionInfo;
                                                            reqObj.clt_cas_instance = clt_cas_instance;
                                                            reqObj.dep_cas_instance = dep_cas_instance;
                                                            var childrens = [];
                                                            var exGatewayCond = {
                                                                'exg_code': GW_CODE,
                                                                'client_id': objSessionInfo.CLIENT_ID,
                                                                'app_id': objSessionInfo.APP_ID
                                                            };
                                                            if (isLatestPlatformVersion) {
                                                                exGatewayCond.TENANT_ID = TENANT_ID;
                                                            }
                                                            reqExchangeHelper.GetExGatewayDetails(dep_cas_instance, exGatewayCond, objLogInfo, function (error, result) {
                                                                if (error) {
                                                                    var tmpExHeaderFilesCond = {};
                                                                    tmpExHeaderFilesCond.prct_id = prct_id;
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Error While Getting Data From ex_gateways - ' + prct_id, objLogInfo);
                                                                    reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (result, error) {
                                                                        if (error) {
                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100007', 'Failed To Delete TMP_EX_HEADER_FILES Data...', '');
                                                                        } else {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                                        }
                                                                        // To make the file eligible for next thread
                                                                        var RemoveFileNameFromRedisSessionReqObj = {};
                                                                        RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                        RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                        RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                        RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                                        RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                        reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, "ERR-EXG-", "Error while getting data from ex_gateways", error);
                                                                        });
                                                                    });
                                                                } else {
                                                                    if (result.rows.length) {
                                                                        var exGatewaysResponse = result.rows[0];
                                                                        var tempOriginalFiles = [];
                                                                        var failedFiles = []; // array of Objects [{}]
                                                                        var successFilesList = [] // array of Elements ['e1','e2']
                                                                        var failedFilesList = []; // array of Elements ['e1','e2']
                                                                        var arrTenantSetupCategory = ['EXG_STORAGE_PATH', 'EXG_STORAGE_PATH_TYPE', 'EXG_STORAGE_PATH_FTP_INFO', 'EXG_PKI_STORE', 'EXG_FTP_FILELIST_REDIS_TTL_SEC'];
                                                                        var tenantSetupCondObj = {
                                                                            'client_id': CLIENT_ID,
                                                                            'tenant_id': TENANT_ID,
                                                                            'category': arrTenantSetupCategory
                                                                        };
                                                                        reqFXDBInstance.GetTableFromFXDB(clt_cas_instance, 'tenant_setup', [], tenantSetupCondObj, objLogInfo, async function (tenant_setup_error, result) {
                                                                            if (tenant_setup_error) {
                                                                                var tmpExHeaderFilesCond = {};
                                                                                tmpExHeaderFilesCond.prct_id = prct_id;
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Invalid Storage Path - ' + prct_id, objLogInfo);
                                                                                reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (tmp_ex_header_files_error_result, tmp_ex_header_files_error) {
                                                                                    if (tmp_ex_header_files_error) {
                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100006', 'Failed To Delete TMP_EX_HEADER_FILES Data...', tmp_ex_header_files_error);
                                                                                    } else {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                                                    }
                                                                                    // To make the file eligible for next thread
                                                                                    var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                    RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                    RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                    RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                    RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                                                    RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                    reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                        var errorMsg = 'Error While Getting Data From TENANT_SETUP based on Categories like ' + arrTenantSetupCategory.toString();
                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100012', errorMsg, tenant_setup_error);
                                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100012', errorMsg, tenant_setup_error);
                                                                                    });
                                                                                });
                                                                            } else {
                                                                                var ftpTypeStoragePathObj = {};
                                                                                var StoragePathType = '';
                                                                                var keystoresftpInfo = '';

                                                                                for (var v = 0; v < result.rows.length; v++) {
                                                                                    const element = result.rows[v];
                                                                                    try {
                                                                                        if (element.category == 'EXG_STORAGE_PATH') {
                                                                                            // setup_json looks like {"NAME":"EXG_STORAGE_PATH","VALUE":"//home//torus//vph//"}
                                                                                            storagePath = JSON.parse(element['setup_json'])['VALUE'];
                                                                                        } else if (element.category == 'EXG_STORAGE_PATH_TYPE') {
                                                                                            // setup_json looks like { "NAME": "EXG_STORAGE_PATH_TYPE", "VALUE": "FTP" }
                                                                                            StoragePathType = JSON.parse(element['setup_json'])['VALUE'];
                                                                                        } else if (element.category == 'EXG_STORAGE_PATH_FTP_INFO') {
                                                                                            // setup_json looks like {"NAME":"EXG_STORAGE_PATH_FTP_INFO","VALUE":{"IP":"192.168.2.203","PORT":"21","USERNAME":"dharani","PASSWORD":"Factory147"}}
                                                                                            ftpTypeStoragePathObj = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(element['setup_json'])])[0];
                                                                                        } else if (element.category == 'EXG_FTP_FILELIST_REDIS_TTL_SEC') {
                                                                                            var tenantSetupRedisDb7TTL = JSON.parse(element['setup_json'])['VALUE'];
                                                                                            if (tenantSetupRedisDb7TTL) {
                                                                                                redisDb7TTL = tenantSetupRedisDb7TTL;
                                                                                            }
                                                                                        }
                                                                                        else if (element.category == 'EXG_PKI_STORE') {
                                                                                            var encdata = element['setup_json'];
                                                                                            var DecryptedSetupJson = await reqFXDBInstance.GetDecryptedData(clt_cas_instance, encdata, objLogInfo);
                                                                                            keystoresftpInfo = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(DecryptedSetupJson)])[0]; // JSON.parse(element['setup_json'])['VALUE'];
                                                                                            console.log('keystore - ' + JSON.stringify(keystoresftpInfo));
                                                                                        }
                                                                                    } catch (error) {
                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100013', 'Catch Error While parsing Data from Tenant Setup Json...', error);
                                                                                    }
                                                                                }

                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path - ' + storagePath, objLogInfo);
                                                                                if (storagePath || StoragePathType == 'FTP') {
                                                                                    async.series([
                                                                                        function (seriesCallback) {
                                                                                            try {
                                                                                                reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_file_format_groups ', [], {
                                                                                                    'EXFFG_CODE': reqObj.FFG_CODE,
                                                                                                    'app_id': reqObj.session.APP_ID
                                                                                                }, objLogInfo, function (error, result) {
                                                                                                    if (error) {
                                                                                                        var tmpExHeaderFilesCond = {};
                                                                                                        tmpExHeaderFilesCond.prct_id = prct_id;
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Error While Getting Data From EX_FILE_FORMAT_GROUPS - ' + prct_id, objLogInfo);
                                                                                                        reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (result, error) {
                                                                                                            if (error) {
                                                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100008', 'Failed To Delete TMP_EX_HEADER_FILES Data...', '');
                                                                                                            } else {
                                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                                                                            }
                                                                                                            // To make the file eligible for next thread
                                                                                                            var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                            RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                            reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100003', 'Storage Path is not defined...', error);
                                                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100003', 'Error While Getting Data from EX_FILE_FORMAT_GROUPS...', error);
                                                                                                            });
                                                                                                        });
                                                                                                    } else {
                                                                                                        var data = result.rows
                                                                                                        ffg_json = commonFile.parseJSON(data[0]["ffg_json"]);
                                                                                                        seriesCallback();
                                                                                                    }
                                                                                                });
                                                                                            } catch (error) {
                                                                                                var tmpExHeaderFilesCond = {};
                                                                                                tmpExHeaderFilesCond.prct_id = prct_id;
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Catch Error async.series() - ' + prct_id, objLogInfo);
                                                                                                reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (result, error) {
                                                                                                    if (error) {
                                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100009', 'Failed To Delete TMP_EX_HEADER_FILES Data...', '');
                                                                                                    } else {
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                                                                    }
                                                                                                    // To make the file eligible for next thread
                                                                                                    var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                    RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                    RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                    RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                    RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                                                                    RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                    reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100004', 'Catch Error in reqFXDBInstance.GetTableFromFXDB()....', error);
                                                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100004', 'Catch Error in reqFXDBInstance.GetTableFromFXDB()...', error);
                                                                                                    });
                                                                                                });
                                                                                            }
                                                                                        },
                                                                                        function (seriesCallback) {
                                                                                            try {
                                                                                                var formedFile = "";
                                                                                                var fileFormats = ffg_json['FILE_FORMATS'];
                                                                                                for (var j = 0; j < fileFormats.length; j++) {
                                                                                                    if (fileFormats[j]['IS_CHILD'] == "true") {
                                                                                                        for (var files of selected_files) {
                                                                                                            var childFileNameArr = fileFormats[j]['MATCHING_PATTERN'].split(/[{}]/)
                                                                                                            var parentFilePattern = "";
                                                                                                            var position = "";
                                                                                                            var parentFIleText = "";


                                                                                                            for (var arr of childFileNameArr) {
                                                                                                                if (arr.includes("PARENTFILEPATTERN")) {
                                                                                                                    parentFilePattern = arr.split(/[()]/);
                                                                                                                    position = parentFilePattern[2];

                                                                                                                    var positionarr = position.split(",");

                                                                                                                    if (positionarr.length == 2) {
                                                                                                                        parentFIleText += files['name'].substring(parseInt(positionarr[0]), parseInt(positionarr[1]));
                                                                                                                    } else {
                                                                                                                        parentFIleText += files['name'].substring(parseInt(positionarr[0]));
                                                                                                                    }

                                                                                                                }
                                                                                                            }
                                                                                                            for (var arr of childFileNameArr) {
                                                                                                                if (!arr.includes("PARENTFILEPATTERN")) {
                                                                                                                    formedFile += arr;
                                                                                                                } else {
                                                                                                                    formedFile += parentFIleText;
                                                                                                                }


                                                                                                            }
                                                                                                            childrens.push(formedFile);
                                                                                                            formedFile = "";
                                                                                                        }
                                                                                                    }
                                                                                                }
                                                                                                seriesCallback();

                                                                                            } catch (ex) {
                                                                                                seriesCallback();
                                                                                            }
                                                                                        },
                                                                                        function (seriesCallback) {
                                                                                            // reqInstanceHelper.PrintInfo(serviceName, 'reqObj.From_Update - ' + reqObj.From_Update || false, objLogInfo);
                                                                                            // if (!reqObj.From_Update) { // Entered from ExgImportDwonload API...

                                                                                            if (exGatewaysResponse.gateway_type === "FTP" || exGatewaysResponse.gateway_type === "SFTP") {
                                                                                                var newFileDownloadPathPrefix = 'Download//' + TENANT_ID + '//' + APP_ID + '//' + FFG_CODE + '//';
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Storage Path From DB - ' + storagePath, objLogInfo);
                                                                                                if (storagePath) {
                                                                                                    storagePath = storagePath + newFileDownloadPathPrefix;
                                                                                                } else {
                                                                                                    storagePath = newFileDownloadPathPrefix;
                                                                                                }
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Creating Folder in Local If not Exist - ' + storagePath, objLogInfo);
                                                                                                var DynamicFolderCreationReqObj = {};
                                                                                                DynamicFolderCreationReqObj.destination_folder_path = storagePath;
                                                                                                DynamicFolderCreationReqObj.objLogInfo = objLogInfo;
                                                                                                // storagePath = "D:\\exchange\\storage\\";
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'After Adding TENANT_ID,APP_ID,FFG_CODE to the Storage Path - ' + storagePath, objLogInfo);

                                                                                                var ftpConfig = JSON.parse(exGatewaysResponse.gateway_config);
                                                                                                ftpConfig.keystoresftpInfo = keystoresftpInfo;
                                                                                                ftpConfig.read_path = exGatewaysResponse.read_path;
                                                                                                ftpConfig.FOLDERPATH = exGatewaysResponse.read_path;
                                                                                                ftpConfig.storagePath = storagePath;
                                                                                                ftpConfig.log_info = objLogInfo;
                                                                                                ftpConfig.gateway_type = exGatewaysResponse.gateway_type;

                                                                                                // ftpTypeStoragePathObj = {
                                                                                                //     host: '<dev_ip>',
                                                                                                //     port: 'port',
                                                                                                //     user: 'user',
                                                                                                //     password: '<pwd>'
                                                                                                // };
                                                                                                // ftpTypeStoragePathObj = {};
                                                                                                // StoragePathType = 'FTP';
                                                                                                if (IS_FILE_FROM_CLIENT) {
                                                                                                    // Folder Creation in Local Path
                                                                                                    reqInstanceHelper.DynamicFolderCreation(DynamicFolderCreationReqObj);
                                                                                                }
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Exg Download Mode - ' + SKIP_FTP_DOWNLOAD, objLogInfo);
                                                                                                if (!SKIP_FTP_DOWNLOAD) {
                                                                                                    // Folder Creation in Local Path
                                                                                                    reqInstanceHelper.DynamicFolderCreation(DynamicFolderCreationReqObj);
                                                                                                    if (StoragePathType && StoragePathType == 'FTP' && ftpTypeStoragePathObj && Object.keys(ftpTypeStoragePathObj).length) { // To check whether Setup json has any data or not..
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - FTP Storage ', objLogInfo);
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'FTP Info For Database Storage Path - ' + JSON.stringify(ftpTypeStoragePathObj), objLogInfo);
                                                                                                        ftpConfig.ftpTypeStoragePathInfo = ftpTypeStoragePathObj;
                                                                                                    } else {
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - Local Storage ', objLogInfo);
                                                                                                        ftpTypeStoragePathObj = {};
                                                                                                    }
                                                                                                }
                                                                                                OriginalSelectedFiles = Object.assign(OriginalSelectedFiles, selected_files);// Files For Download Process
                                                                                                ftpConfig.FFG_CODE = FFG_CODE;

                                                                                                //    selected_files =  {
                                                                                                //     childfiles: []
                                                                                                //     ff_Id: 1,
                                                                                                //     matching_pattern: "",
                                                                                                //     name: "h (2).xml",
                                                                                                //     parent_ff_Id: "",
                                                                                                //     size: "2KB",
                                                                                                //     STATUS: "NOT DOWNLOADED"
                                                                                                // }
                                                                                                ftpConfig.SKIP_FTP_DOWNLOAD = SKIP_FTP_DOWNLOAD;
                                                                                                ftpConfig.IS_FILE_FROM_CLIENT = IS_FILE_FROM_CLIENT;
                                                                                                ftpConfig.CLIENT_FILES = CLIENT_FILES;

                                                                                                function CheckBeforeStartingDownloadProcess(params, CheckBeforeStartingDownloadProcessCB) {
                                                                                                    try {
                                                                                                        if (SKIP_FTP_DOWNLOAD && !IS_FILE_FROM_CLIENT) { // Only Logical Download Case
                                                                                                            var alteredPath = exGatewaysResponse.read_path;
                                                                                                            if (!(alteredPath).lastIndexOf('\\')) {
                                                                                                                alteredPath + '\\';
                                                                                                            }
                                                                                                            var moveFrom = alteredPath;
                                                                                                            var moveTo = storagePath;
                                                                                                            for (var fileObj of selected_files) {
                                                                                                                fileObj.file_name = fileObj.name;
                                                                                                                fileObj.fromPath = moveFrom;
                                                                                                                fileObj.toPath = moveTo;
                                                                                                            }
                                                                                                            ftpConfig.skipFileMovingProcess = true; // Skipping the File Moving Process because it will be handled with the help of ExgDeleteFTPFiles API
                                                                                                            ftpHelper.changeFilePath(selected_files, ftpConfig, objLogInfo).then((responseChangeFiles) => {
                                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Renaming FTP File Path Result - ' + JSON.stringify(responseChangeFiles), objLogInfo);
                                                                                                                CheckBeforeStartingDownloadProcessCB(null, responseChangeFiles);
                                                                                                            })
                                                                                                                .catch((error) => {
                                                                                                                    CheckBeforeStartingDownloadProcessCB(error, null);
                                                                                                                });
                                                                                                        } else { // Client Side Download Case and  Normal Case
                                                                                                            // FOR DEVELOPMENT
                                                                                                            // ftpConfig = Object.assign(ftpConfig,{ "ip": "192.168.2.203", "port": "22", "username": "sftpuser", "passphrase": "Welcome@100", "cert_file_name": "cert\\rbs.pem", "cert_location_type": "SFTP" });
                                                                                                            // ftpConfig.gateway_type = 'SFTP';
                                                                                                            ftpHelper.downloadFromFTP(selected_files, ftpConfig, '', function (response) {
                                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'FTP Download Result - ' + JSON.stringify(response), objLogInfo);
                                                                                                                CheckBeforeStartingDownloadProcessCB(null, response);
                                                                                                            });
                                                                                                        }
                                                                                                    } catch (error) {
                                                                                                        CheckBeforeStartingDownloadProcessCB(error, null);
                                                                                                    }
                                                                                                }
                                                                                                CheckBeforeStartingDownloadProcess({}, function (error, result) {
                                                                                                    if (!error && result.STATUS == "SUCCESS") {
                                                                                                        var fileStatusFromFtp = result.SUCCESS_DATA;
                                                                                                        failedFiles = fileStatusFromFtp['FailedFiles'];
                                                                                                        selected_files = fileStatusFromFtp['SuccessFiles'];
                                                                                                        async.forEachOf(selected_files, function (value, key, asyncCallback) {
                                                                                                            if (value != null) {
                                                                                                                if (value['type'] == undefined) {
                                                                                                                    if (value["name"] != null && value["name"] != "") {
                                                                                                                        fileArr.push({
                                                                                                                            "fileName": value["name"],
                                                                                                                            "name": value["name"],
                                                                                                                            "size": value["size"],
                                                                                                                            "matching_pattern": value["matching_pattern"]
                                                                                                                        })
                                                                                                                        if (value["childfiles"] && value["childfiles"].length > 0) {
                                                                                                                            for (var indexf in value["childfiles"]) {
                                                                                                                                fileArr.push({
                                                                                                                                    "fileName": value["childfiles"][indexf]["name"],
                                                                                                                                    "name": value["childfiles"][indexf]["name"],
                                                                                                                                    "matching_pattern": value["childfiles"][indexf]["matching_pattern"]
                                                                                                                                })
                                                                                                                            }
                                                                                                                        }
                                                                                                                    }
                                                                                                                }

                                                                                                            }

                                                                                                            return asyncCallback();
                                                                                                        }, function (err) {
                                                                                                            if (!err) {
                                                                                                                for (var index = 0; index < fileArr.length; index++) {
                                                                                                                    if (can_import) {
                                                                                                                        fileArr[index]["STATUS"] = "DOWNLOADED";
                                                                                                                    } else {
                                                                                                                        fileArr[index]["STATUS"] = "DOWNLOADED";
                                                                                                                    }

                                                                                                                }
                                                                                                                return seriesCallback();
                                                                                                            } else {
                                                                                                                console.log("=================error===========" + err)
                                                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "", "", "FAILURE", "FAILURE");
                                                                                                            }
                                                                                                        });
                                                                                                    } else {
                                                                                                        selected_files = [];
                                                                                                        return seriesCallback();
                                                                                                    }
                                                                                                });
                                                                                            } else if (exGatewaysResponse.gateway_type.toUpperCase() == "LOCAL") {
                                                                                                var read_path = exGatewaysResponse.read_path;
                                                                                                var write_path = exGatewaysResponse.write_path;
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Read Path ' + read_path, objLogInfo)
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Write Path ' + write_path, objLogInfo)
                                                                                                fs.readdir(read_path, function (err, files) {
                                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Files in read path are  ' + files, objLogInfo)

                                                                                                    try {
                                                                                                        for (var temp of files) {
                                                                                                            for (var child of childrens) {
                                                                                                                if (isValidMatchingFile(temp, child)) {
                                                                                                                    selected_files.push({
                                                                                                                        "fileName": temp,
                                                                                                                        "name": temp,
                                                                                                                        "type": "child"
                                                                                                                    })
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                    } catch (ex) {
                                                                                                    }
                                                                                                    async.forEachOf(selected_files, function (value, key, asyncCallback) {
                                                                                                        if (value != null) {
                                                                                                            if (value["name"] != null && value["name"] != "" && value['type'] == undefined) {
                                                                                                                fileArr.push({
                                                                                                                    "fileName": value["name"],
                                                                                                                    "name": value["name"],
                                                                                                                    "size": Math.ceil(fs.statSync(reqPath.join(read_path, value["name"])).size / 1024) + "KB",
                                                                                                                    "matching_pattern": value["matching_pattern"]
                                                                                                                })

                                                                                                                fs.createReadStream(reqPath.join(read_path, value["name"])).pipe(fs.createWriteStream(reqPath.join(storagePath, value["name"])));
                                                                                                            }

                                                                                                            if (value['type'] != undefined) {
                                                                                                                fs.createReadStream(reqPath.join(read_path, value["name"])).pipe(fs.createWriteStream(reqPath.join(storagePath, value["name"])));
                                                                                                            }
                                                                                                        }

                                                                                                        asyncCallback();
                                                                                                    }, function (err) {
                                                                                                        if (!err) {
                                                                                                            var dataArr = [];
                                                                                                            for (var index = 0; index < fileArr.length; index++) {
                                                                                                                var temp = {};
                                                                                                                if (can_import) {
                                                                                                                    fileArr[index]["STATUS"] = "DOWNLOADED";
                                                                                                                } else {
                                                                                                                    fileArr[index]["STATUS"] = "DOWNLOADED";
                                                                                                                }
                                                                                                            }
                                                                                                        }
                                                                                                        seriesCallback();
                                                                                                    });
                                                                                                })
                                                                                            } else {
                                                                                                seriesCallback();
                                                                                            }
                                                                                        },
                                                                                        function () {
                                                                                            var exchangeFileInfoRequest = {
                                                                                                "EXFFG_CODE": FFG_CODE,
                                                                                                "write_path": exGatewaysResponse.write_path,
                                                                                                "objLogInfo": objLogInfo,
                                                                                                "FILES": fileArr,
                                                                                                "EXFF_ID": 0,
                                                                                                "SERVICE_LOG_FOLDER_PATH": Service_Log_Folder_Path
                                                                                            };
                                                                                            exchangeFileInfoRequest.EXHF_ID_ARR = []
                                                                                            exchangeFileInfoRequest.gateway_config = exGatewaysResponse;
                                                                                            exchangeFileInfoRequest.tran_db_instance = tran_db_instance;
                                                                                            exchangeFileInfoRequest.dep_cas_instance = dep_cas_instance;
                                                                                            exchangeFileInfoRequest.clt_cas_instance = clt_cas_instance;
                                                                                            exchangeFileInfoRequest.session = objSessionInfo;
                                                                                            exchangeFileInfoRequest.objLogInfo = objLogInfo;
                                                                                            exchangeFileInfoRequest.DST_ID = Des_sys;
                                                                                            exchangeFileInfoRequest.EXG_CODE = GW_CODE;
                                                                                            exchangeFileInfoRequest.prct_id = prct_id;
                                                                                            exchangeFileInfoRequest.IS_FILE_FROM_CLIENT = IS_FILE_FROM_CLIENT;
                                                                                            exchangeFileInfoRequest.SESSION_ID = SESSION_ID;
                                                                                            exchangeFileInfoRequest["headers"] = mHeaders;
                                                                                            exchangeFileInfoRequest["Default_params"] = reqBody["Default_params"],
                                                                                                exchangeFileInfoRequest.SKIP_FTP_DOWNLOAD = SKIP_FTP_DOWNLOAD
                                                                                            for (var index = 0; index < selected_files.length; index++) {
                                                                                                var fileName = selected_files[index]["name"];
                                                                                                exchangeFileInfoRequest.EXHF_ID_ARR.push({
                                                                                                    "file_name": fileName,
                                                                                                    "exhf_id": selected_files[index]["hf_id"]
                                                                                                });
                                                                                                successFilesList.push(fileName); // Getting Success File List
                                                                                            }
                                                                                            for (var select of failedFiles) {
                                                                                                failedFilesList.push(select['name']); // Getting Failed File List
                                                                                            }
                                                                                            if (reqObj['continue_process'] == undefined) {
                                                                                                exchangeFileInfoRequest['continue_process'] = true;
                                                                                            } else {
                                                                                                exchangeFileInfoRequest['continue_process'] = reqObj['continue_process'];
                                                                                            }
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Can Continue Exchange Process ' + exchangeFileInfoRequest['continue_process'], objLogInfo)
                                                                                            if (can_import) {
                                                                                                exchangeFileInfoRequest.NEED_TRN_INSERT = true;
                                                                                            } else {
                                                                                                exchangeFileInfoRequest.NEED_TRN_INSERT = false;
                                                                                            }
                                                                                            exchangeFileInfoRequest.storagePath = storagePath;
                                                                                            exchangeFileInfoRequest.FromDownload = true

                                                                                            exchangeFileInfoRequest['SuccessFileList'] = successFilesList;
                                                                                            exchangeFileInfoRequest['FailedFileList'] = failedFilesList;
                                                                                            exchangeFileInfoRequest['prct_id'] = prct_id;
                                                                                            exchangeFileInfoRequest.EXG_PROCESS_NAME = 'DOWNLOAD';
                                                                                            exchangeFileInfoRequest.FFG_JSON = ffg_json;
                                                                                            exchangeFileInfoRequest.SERVICE_PARAMS = serviceParamRedisKeyValue;
                                                                                            var codeSnippetInputParams = {};
                                                                                            codeSnippetInputParams.SUCCESS_FILE_LIST = successFilesList;
                                                                                            codeSnippetInputParams.FAILED_FILE_LIST = failedFilesList;
                                                                                            codeSnippetInputParams.PRCT_ID = prct_id;
                                                                                            codeSnippetInputParams.CAN_IMPORT = can_import; // True or false based on Download only or Download and Update Process
                                                                                            codeSnippetInputParams.objLogInfo = objLogInfo;
                                                                                            codeSnippetInputParams.TRAN_DB_INSTANCE = exchangeFileInfoRequest.tran_db_instance;
                                                                                            codeSnippetInputParams.CLT_CAS_INSTANCE = exchangeFileInfoRequest.clt_cas_instance;
                                                                                            codeSnippetInputParams.DEP_CAS_INSTANCE = exchangeFileInfoRequest.dep_cas_instance;
                                                                                            codeSnippetInputParams.SESSION_INFO = exchangeFileInfoRequest.session;
                                                                                            exchangeFileInfoRequest.CODE_SNIPPET_INPUT_PARAMS = codeSnippetInputParams;

                                                                                            if (selected_files.length == 0) {
                                                                                                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, "delete from tmp_ex_header_files where prct_id = '" + prct_id + "'", objLogInfo, (result, err) => {
                                                                                                    // Calling Code Snippet with the Failed File List if there is no Success File List
                                                                                                    reqExchangeEngine.CallCodeSnippetByFFGCode(exchangeFileInfoRequest, function (codeSnippetResult, error) {
                                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100005', 'Download Failed....', '');
                                                                                                        var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                        RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.FILES = OriginalSelectedFiles;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                        reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100005', "Unable to connnect SFTP -- Download failed", "");
                                                                                                        });
                                                                                                    });
                                                                                                });
                                                                                            } else {
                                                                                                for (var original of OriginalSelectedFiles) {
                                                                                                    tempOriginalFiles.push(original.name)
                                                                                                }
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'updateExchangeFileInfo called ', objLogInfo);
                                                                                                reqExchangeHelper.updateExchangeFileInfo(exchangeFileInfoRequest, function (resExchangeFileInfo) {
                                                                                                    // Calling Code Snippet with the Failed File List and Success File List 
                                                                                                    if (resExchangeFileInfo.STATUS === "SUCCESS") {
                                                                                                        reqExchangeEngine.CallCodeSnippetByFFGCode(exchangeFileInfoRequest, function (codeSnippetResult, error) {
                                                                                                            var ftpConfig = JSON.parse(exGatewaysResponse.gateway_config);
                                                                                                            ftpConfig.keystoresftpInfo = keystoresftpInfo;
                                                                                                            if ((exGatewaysResponse.read_path).lastIndexOf('\\')) {
                                                                                                                exGatewaysResponse.read_path = (exGatewaysResponse.read_path).substring(0, (exGatewaysResponse.read_path).lastIndexOf('\\'));
                                                                                                            }
                                                                                                            var filesToRename = [];
                                                                                                            var moveFrom = exGatewaysResponse.read_path + '\\';
                                                                                                            var moveTo = exGatewaysResponse.read_path + "_processed" + "\\";
                                                                                                            for (var file of successFilesList) {
                                                                                                                var obj = {
                                                                                                                    "file_name": file,
                                                                                                                    "fromPath": moveFrom,
                                                                                                                    "toPath": moveTo
                                                                                                                }
                                                                                                                filesToRename.push(obj);
                                                                                                            }

                                                                                                            function CheckBeforeMovingFiles(params, CheckBeforeMovingFilesCB) {
                                                                                                                try {
                                                                                                                    var CheckBeforeMovingFilesResult = {};
                                                                                                                    if (SKIP_FTP_DOWNLOAD) {
                                                                                                                        CheckBeforeMovingFilesResult.STATUS = 'SUCCESS';
                                                                                                                        CheckBeforeMovingFilesCB(null, CheckBeforeMovingFilesResult);
                                                                                                                    } else {
                                                                                                                        ftpConfig.gateway_type = exGatewaysResponse.gateway_type;
                                                                                                                        ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo).then((responseChangeFiles) => {
                                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Change File Path - Processed Response - ' + JSON.stringify(responseChangeFiles), objLogInfo);
                                                                                                                            CheckBeforeMovingFilesResult.STATUS = 'SUCCESS';
                                                                                                                            CheckBeforeMovingFilesCB(null, CheckBeforeMovingFilesResult);
                                                                                                                        })
                                                                                                                            .catch((error) => {
                                                                                                                                CheckBeforeMovingFilesCB(error, null);
                                                                                                                            });
                                                                                                                    }

                                                                                                                } catch (error) {
                                                                                                                    CheckBeforeMovingFilesCB(error, null);
                                                                                                                }
                                                                                                            }

                                                                                                            // For Moving Downloaded Files to read_path+'_processed' Path
                                                                                                            CheckBeforeMovingFiles({}, function (CheckBeforeMovingFilesError, result) {
                                                                                                                if (result) {
                                                                                                                    var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.FILES = OriginalSelectedFiles;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                                    // Removing Files From the Redis DB 3
                                                                                                                    reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {

                                                                                                                        var AddFilesToRedisSessionReqObj = {};
                                                                                                                        AddFilesToRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                                        AddFilesToRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                                        AddFilesToRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                                        AddFilesToRedisSessionReqObj.FILES = filesToRename;
                                                                                                                        AddFilesToRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                                        AddFilesToRedisSessionReqObj.DB = 7;
                                                                                                                        AddFilesToRedisSessionReqObj.TTL = redisDb7TTL;
                                                                                                                        AddFilesToRedisSessionReqObj.PROCESS = 'From File Download Process';
                                                                                                                        // Always Maintaining the File Names with help of TTL as Tenant_setup parameter Within the Redis DB7 Session for Duplicate Validation Process
                                                                                                                        reqExchangeHelper.AddFilesToRedisSession(AddFilesToRedisSessionReqObj, function (error, result) {

                                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Can Import - ' + can_import, objLogInfo);
                                                                                                                            if (can_import) {
                                                                                                                                exchangeFileInfoRequest.objLogInfo = objLogInfo;
                                                                                                                                exchangeFileInfoRequest["originalUrl"] = OriginalUrl;
                                                                                                                                exchangeFileInfoRequest["FILE_INFO"] = resExchangeFileInfo;
                                                                                                                                importFiles(exchangeFileInfoRequest, function (response) {
                                                                                                                                    if (response.STATUS == "SUCCESS") {
                                                                                                                                        try {
                                                                                                                                            if (response.SUCCESS_DATA.SUCCESS_DATA != undefined) {
                                                                                                                                                response.SUCCESS_DATA = response.SUCCESS_DATA.SUCCESS_DATA
                                                                                                                                            }
                                                                                                                                        } catch (ex) { }
                                                                                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null, "SUCCESS", "SUCCESS");

                                                                                                                                    } else {
                                                                                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT, "FAILURE", "FAILURE");
                                                                                                                                    }
                                                                                                                                });
                                                                                                                            } else {
                                                                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, null, null, null, "SUCCESS", "SUCCESS");
                                                                                                                            }
                                                                                                                        });
                                                                                                                    });
                                                                                                                } else {
                                                                                                                    var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.FILES = OriginalSelectedFiles;
                                                                                                                    RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                                    reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Storage Path is not defined", CheckBeforeMovingFilesError);
                                                                                                                    });
                                                                                                                }
                                                                                                            });
                                                                                                        });
                                                                                                    } else {
                                                                                                        // Writing Recovery Files while getting Exceptions for Insert Process in Ex_header, Ex_header_files and Delete Process in TMP_EX_HEADER_FILES Table
                                                                                                        if (resExchangeFileInfo.SUCCESS_DATA) {
                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Writing Recovery Log Process Started', objLogInfo);
                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Need Recovery Log File For TMP_EX_HEADER_FILES DELETE Process - ' + !resExchangeFileInfo.SUCCESS_DATA.TMP_EX_HEADER_FILES_DELETE.STATUS, objLogInfo);
                                                                                                            // Common For All the Types of Download Mode
                                                                                                            // For TMP_EX_HEADER_FILES table Delete Process Failed
                                                                                                            if (!resExchangeFileInfo.SUCCESS_DATA.TMP_EX_HEADER_FILES_DELETE.STATUS) {
                                                                                                                reqExchangeHelper.WritePrctToNullServiceLogFile(mHeaders, prct_id, exchangeFileInfoRequest.SERVICE_LOG_FOLDER_PATH, 'DELETE_PRCT_ID', 'TMP_EX_HEADER_FILES', function () {
                                                                                                                });
                                                                                                            }

                                                                                                            // For LOGICAL [SKIP_FTP_DOWNLOAD] Download Mode Only 
                                                                                                            // Writing Recovery Log while Doing Insert Process which is Failed in EX_HEADER or EX_HEADER_FILES
                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Need Recovery Log File For EX_HEADER INSERT Process - ' + !resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_INSERT.STATUS, objLogInfo);
                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Need Recovery Log File For EX_HEADER_FILES INSERT Process - ' + !resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_FILES_INSERT.STATUS, objLogInfo);
                                                                                                            if (SKIP_FTP_DOWNLOAD && !IS_FILE_FROM_CLIENT) {
                                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'This is the LOGICAL DOWNLOAD MODE, Hence Started Writing Recovery Log File for EX_HEADER and EX_HEADER_FILES Insert Process Failed', objLogInfo);
                                                                                                                // For EX_HEADER table Insert Process Failed
                                                                                                                if (!resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_INSERT.STATUS) {
                                                                                                                    var folderPath = exchangeFileInfoRequest.SERVICE_LOG_FOLDER_PATH;
                                                                                                                    var recoveryData = {
                                                                                                                        EX_HEADER_INSERT_PROCESS: {
                                                                                                                            Table_Name: 'EX_HEADER',
                                                                                                                            Table_Data: resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_INSERT.DATA
                                                                                                                        }
                                                                                                                    };
                                                                                                                    var fileContent = JSON.stringify(recoveryData);
                                                                                                                    var fileName = reqInstanceHelper.GetServiceFileName(mHeaders);
                                                                                                                    reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent);
                                                                                                                }

                                                                                                                // For EX_HEADER_FILES table Insert Process Failed
                                                                                                                if (!resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_FILES_INSERT.STATUS) {
                                                                                                                    var folderPath = exchangeFileInfoRequest.SERVICE_LOG_FOLDER_PATH;
                                                                                                                    var recoveryData = {
                                                                                                                        EX_HEADER_FILES_INSERT_PROCESS: {
                                                                                                                            Table_Name: 'EX_HEADER_FILES',
                                                                                                                            Table_Data: resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_FILES_INSERT.DATA
                                                                                                                        }
                                                                                                                    };
                                                                                                                    var fileContent = JSON.stringify(recoveryData);
                                                                                                                    var fileName = reqInstanceHelper.GetServiceFileName(mHeaders);
                                                                                                                    reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent);
                                                                                                                }
                                                                                                            } else {
                                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'This is NOT the LOGICAL DOWNLOAD MODE, Hence Skipping Recovery Log File Writing Process for EX_HEADER and EX_HEADER_FILES Insert Process', objLogInfo);
                                                                                                                resExchangeFileInfo.SUCCESS_DATA.TMP_EX_HEADER_FILES_DELETE = {};
                                                                                                                resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_INSERT = {};
                                                                                                                resExchangeFileInfo.SUCCESS_DATA.EX_HEADER_FILES_INSERT = {};
                                                                                                            }
                                                                                                            var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                            RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.FILES = OriginalSelectedFiles;
                                                                                                            RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                            reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, resExchangeFileInfo.ERROR_CODE, resExchangeFileInfo.ERROR_MESSAGE, resExchangeFileInfo.ERROR_OBJECT, resExchangeFileInfo.PROCESS_STATUS, resExchangeFileInfo.INFO_MESSAGE);
                                                                                                            });
                                                                                                        }
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        }
                                                                                    ]);
                                                                                } else {
                                                                                    var tmpExHeaderFilesCond = {};
                                                                                    tmpExHeaderFilesCond.prct_id = prct_id;
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Invalid Storage Path - ' + prct_id, objLogInfo);
                                                                                    reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (result, error) {
                                                                                        if (error) {
                                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100006', 'Failed To Delete TMP_EX_HEADER_FILES Data...', '');
                                                                                        } else {
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                                                        }
                                                                                        // To make the file eligible for next thread
                                                                                        var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                        RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                        RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                        RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                        RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                                                        RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                        reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100002', 'Storage Path is not defined...', '');
                                                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100002', "Storage Path is not defined", "");
                                                                                        });
                                                                                    });
                                                                                }
                                                                            }
                                                                        });
                                                                    } else {
                                                                        var tmpExHeaderFilesCond = {};
                                                                        tmpExHeaderFilesCond.prct_id = prct_id;
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Invalid Storage Path - ' + prct_id, objLogInfo);
                                                                        reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (result, error) {
                                                                            if (error) {
                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100007', 'Failed To Delete TMP_EX_HEADER_FILES Data...', '');
                                                                            } else {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                                            }
                                                                            // To make the file eligible for next thread
                                                                            var RemoveFileNameFromRedisSessionReqObj = {};
                                                                            RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                            RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                            RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                            RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                                            RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                            reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100001', 'There is No data from ex_gateways...', '');
                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100001', "There is No data from ex_gateways...", error);
                                                                            });
                                                                        });
                                                                    }
                                                                }
                                                            });
                                                        } catch (error) {
                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'Error Code', 'Catch Error in GetProcessToken function', error);
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Catch Error in GetProcessToken()", error);
                                                        }

                                                    } else {
                                                        var tmpExHeaderFilesCond = {};
                                                        tmpExHeaderFilesCond.prct_id = prct_id;
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Deleting TMP_EX_HEADER_FILES Data based on PRCT_ID Due to the Invalid Storage Path - ' + prct_id, objLogInfo);
                                                        reqTranDBInstance.DeleteTranDB(tran_db_instance, 'TMP_EX_HEADER_FILES', tmpExHeaderFilesCond, objLogInfo, function (result, error) {
                                                            if (error) {
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100007', 'Failed To Delete TMP_EX_HEADER_FILES Data...', '');
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Data Deleted based on PRCT_ID  - ' + prct_id, objLogInfo);
                                                            }
                                                            // To make the file eligible for next thread
                                                            var RemoveFileNameFromRedisSessionReqObj = {};
                                                            RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                            RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                            RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                            RemoveFileNameFromRedisSessionReqObj.FILES = selected_files;
                                                            RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                            reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100010', 'There are no eligible files...', '');
                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100010', "There are no eligible files...", '');
                                                            });
                                                        });
                                                    }
                                                });
                                            } else {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100015', 'Error While Getting EXG_DOWNLOAD_MODE from Platform Setup...', res.Error);
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100015', 'Error While Getting EXG_DOWNLOAD_MODE from Platform Setup...', res.Error);
                                            }
                                        });
                                    }


                                    function fetchFilesForDownload(reqObj, appResponse, prct_id, callback) {
                                        reqObj.body['objLogInfoFromExg'] = objLogInfo;
                                        reqObj.body.selected_files = selected_files;
                                        reqObj.body.SERVICE_LOG_FOLDER_PATH = Service_Log_Folder_Path;
                                        reqObj.body['objLogInfoFromExg']['prct_id'] = prct_id;

                                        reqGetEligibleFileHelper.GetEliglbleFile(dep_cas_instance, clt_cas_instance, tran_db_instance, objLogInfo, objSessionInfo, reqObj, function (res) {
                                            if (res.status == "SUCCESS") {
                                                resObj = commonFile.prepareMethodResponse("SUCCESS", "", res.data, "", "", "", "", "");
                                                callback(resObj)
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, res.data + res.error, objLogInfo)
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, res.error_code, res.err_msg, res.error, "FAILURE", "FAILURE");
                                            }
                                        })

                                    }
                                }

                            });
                        });
                    });
                });
            });

            function importFiles(importFileObj, callback) {
                var resObj = "";
                var finalresarry = []
                var selected_files = importFileObj.FILES;
                async.series([
                    function (asyncCallback) {
                        importFileObj.UPDATE_EXG_FILE = false;
                        reqExchangeHelper.ImportFile(selected_files, importFileObj, function (responseData) {
                            if (responseData.STATUS === "SUCCESS") {
                                finalresarry = responseData;
                                return asyncCallback();
                            } else {
                                return callback(responseData);
                            }
                        })
                    }
                ], function (err) {
                    var fileNames = [];
                    for (var j = 0; j < selected_files.length; j++) {
                        fileNames.push(selected_files[j].name);
                    }
                    if (!importFileObj.FROM_UPDATE_FILES) {
                        resObj = commonFile.prepareMethodResponse("SUCCESS", "", finalresarry, null, null, null, "", "");
                        return callback(resObj);
                    } else {
                        if (importFileObj['continue_process'] == undefined) {
                            var query = "update ex_header_files set file_status = 'UPDATED' where file_name IN (select file_name from tmp_ex_header_files where prct_id = '" + importFileObj.objLogInfo.PROCESS_INFO.PRCT_ID + "')";
                            reqTranDBInstance.ExecuteSQLQuery(importFileObj.tran_db_instance, query, importFileObj.objLogInfo, function (result, error) {
                                if (error) {
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "Error while running Update query for ex_header_files Table in Exg Download process...", error, "", "");
                                    return callback(resObj);
                                } else {
                                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", finalresarry, null, null, null, "", "");
                                    return callback(resObj);
                                }
                            });
                        } else {
                            resObj = commonFile.prepareMethodResponse("SUCCESS", "", finalresarry, null, null, null, "", "");
                            return callback(resObj);
                        }
                    }
                });
            }


            function isValidMatchingFile(fileName, matchingPattern) {
                if (matchingPattern != "" && matchingPattern != undefined) {
                    return minimatch(fileName.toLowerCase(), matchingPattern.toLowerCase());
                } else {
                    return false;
                }
            }

        } catch (ex) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Exception occured", ex);
        }
    });
})

module.exports = router;