/**
 * @Api_Name        : /ExgImportDownload,
 * @Description     : Import file from specified path
 * @Last_Error_Code : ERR-ELIGIBLEHELPER-1008
 */

// Require dependencies

var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqExchangeHelper = require('./ExchangeHelper');
var async = require('async');
var ftpHelper = require('./FTPHelper');
var serviceName = "GetEligibleFileHelper";
var fs = require('fs');
var path = require("path");
var reqAuditLog = require('../../../../../torus-references/log/audit/AuditLog');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');

var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}

/* // Global Variable Declaration 
global.ht_exg_ftp_file_names = new reqHashTable();
global.ht_exg_ftp_download_process = new reqHashTable(); // Checking for File Download Process in Progress or Not
global.Exg_Down_DB_Insert_Failed_prct_ID = []; // Array Contains - ['1','2'...] */
/* global.arr_exg_file_details = [];
Expected Data will be
prct_id = '1234',
date = '2019-12-13 08:40:22,343';
files = ['name_1.txt', 'name_2.txt'] */

function deleteTmpExHFFailedPrctID(DBSession, pObjLogInfo) {
    global.Exg_Down_DB_Insert_Failed_prct_ID = [];
    reqInstanceHelper.PrintInfo(serviceName, 'Pending Tmp EXHF Prct_ID Count - ' + global.Exg_Down_DB_Insert_Failed_prct_ID.length, pObjLogInfo);
    if (global.Exg_Down_DB_Insert_Failed_prct_ID.length) {
        var condObj = {
            PRCT_ID: global.Exg_Down_DB_Insert_Failed_prct_ID
        }
        reqTranDBInstance.DeleteTranDB(DBSession, 'TMP_EX_HEADER_FILES', condObj, pObjLogInfo, function (result, error) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-1040', 'Error While Deleting Tmp ExHF Table using prct_ID - ' + JSON.stringify(global.Exg_Down_DB_Insert_Failed_prct_ID), error);
                return;
            } else {
                global.Exg_Down_DB_Insert_Failed_prct_ID = [];
                reqInstanceHelper.PrintInfo(serviceName, 'Pending Tmp EXHF Prct_ID  Deleted Successfully and Prct_ID Count - ' + global.Exg_Down_DB_Insert_Failed_prct_ID.length, pObjLogInfo);
            }
        });
    }
}

function ClearHstMemory(pFILE_MEM_TTL_IN_MS, pProcess) { // To Clear Old Items From Hashtable

    if (pProcess == 'Download_In_Progress') {
        var key_value = global.ht_exg_ftp_download_process.get('FTP_DOWNLOAD_IN_PROGRESS');
        if ((Date.now() - key_value.initiated_time) > pFILE_MEM_TTL_IN_MS) {
            key_value.download_in_process = false;
            key_value.initiated_time = null;
            key_value.readable_time = null;
        }
    } else {
        var globalHstFileNames = global.ht_exg_ftp_file_names.values();
        if (globalHstFileNames.length) {
            try {
                for (var a = 0; a < globalHstFileNames.length; a++) {
                    try {
                        var key_value = global.ht_exg_ftp_file_names.get(globalHstFileNames[a].file_name);
                        if (key_value && Date.now() - key_value.initiated_time > pFILE_MEM_TTL_IN_MS) {
                            global.ht_exg_ftp_file_names.remove(globalHstFileNames[a].file_name);
                        }
                    } catch (error) {
                    }
                }
            } catch (error) {

            }
        }
    }
}

function GetEliglbleFile(dep_cas_instance, clt_cas_instance, tran_db_instance, objLogInfo, objSessionInfo, requestdata, pcallback) {
    try {
        deleteTmpExHFFailedPrctID(tran_db_instance, objLogInfo);
        var headers = requestdata.headers;
        var FILE_COUNT_LIMIT = requestdata.body.PARAMS.FILE_COUNT_LIMIT || 50;
        var FILE_MEM_TTL = requestdata.body.PARAMS.FILE_MEM_TTL_IN_MS || 1800000; // Milli Seconds
        ClearHstMemory(FILE_MEM_TTL, null);
        var prct_id = '';
        var from_scheduler = false;
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var reqBody = requestdata.body;
        var SKIP_FTP_DOWNLOAD = reqBody.SKIP_FTP_DOWNLOAD;
        var IS_FILE_FROM_CLIENT = reqBody.IS_FILE_FROM_CLIENT;
        var skipFileMovingProcess = false; // [updated on 11th Feb 2022] Need to Move files to the duplicate folder // Skipping the File Moving Process because it will be handled with the help of ExgDeleteFTPFiles API
        // if (IS_FILE_FROM_CLIENT) { // Skipping the Duplicate File Moving Process for the Client Side Download Only [There is No Src File Path]
        //     reqInstanceHelper.PrintInfo(serviceName, 'Skipping the Duplicate File Moving Process for the Client Side Download Only [There is No Src File Path]', objLogInfo);
        //     skipFileMovingProcess = true;
        // }
        reqInstanceHelper.PrintInfo(serviceName, 'objLogInfoFromExg - ' + reqBody.objLogInfoFromExg || false, objLogInfo);
        if (reqBody.objLogInfoFromExg) {
            reqInstanceHelper.PrintInfo(serviceName, 'Called GetEligibleFileForDownload', objLogInfo);
            from_scheduler = true;
            objLogInfo = reqBody.objLogInfoFromExg;
            prct_id = reqBody.objLogInfoFromExg['prct_id'];
        }
        reqInstanceHelper.PrintInfo(serviceName, 'FILE_COUNT_LIMIT From Scheduler - ' + FILE_COUNT_LIMIT, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'From_scheduler - ' + from_scheduler, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'PRCT_ID From ExgImportDownload - ' + reqBody.objLogInfoFromExg.prct_id, objLogInfo);

        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        // objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        // objLogInfo.PROCESS = 'EXG_FILE_CREATION-GetEligibleFileForDownload';
        // objLogInfo.ACTION_DESC = 'GetEligibleFileForDownload';

        var reqObj = reqBody;
        var TENANT_ID = objSessionInfo.TENANT_ID;
        reqObj.TENANT_ID = TENANT_ID;
        reqObj.tenant_id = TENANT_ID;
        var FFG_CODE = reqBody.PARAMS.FFG_CODE;
        var GW_CODE = reqBody.PARAMS.GW_CODE;
        var Des_sys = reqBody.PARAMS.Des_sys;
        reqBody.DST_ID = Des_sys;
        var SOURCE_S_ID = objSessionInfo.S_ID;
        var APP_ID = objSessionInfo.APP_ID;
        var objGatewayReq = {
            'CLIENT_ID': CLIENT_ID,
            'APP_ID': APP_ID,
            'TENANT_ID': TENANT_ID,
            'SOURCE_S_ID': SOURCE_S_ID,
            'DEST_S_ID': Des_sys
        }
        getOrCreateProcessToken(tran_db_instance, objLogInfo, prct_id).then((prct_id_new) => {
            try {
                prct_id = prct_id_new;
                reqInstanceHelper.PrintInfo(serviceName, 'PRCT ID IS ' + prct_id, objLogInfo);
                objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                reqObj.session = objSessionInfo;
                reqObj.clt_cas_instance = clt_cas_instance;
                var objRequest = {};
                objRequest["dep_cas_instance"] = dep_cas_instance;
                objRequest["EXFFG_CODE"] = FFG_CODE;
                objRequest["session"] = {};
                objRequest["session"]["APP_ID"] = APP_ID;
                objRequest["objLogInfo"] = objLogInfo;
                objRequest['tenant_id'] = objSessionInfo['TENANT_ID'];
                objRequest['TENANT_ID'] = objSessionInfo['TENANT_ID'];
                objRequest["clt_cas_instance"] = clt_cas_instance
                reqInstanceHelper.PrintInfo(serviceName, 'EXFFG_CODE - ' + objRequest.EXFFG_CODE + ' APP_ID - ' + objRequest["session"]["APP_ID"], objLogInfo);
                reqExchangeHelper.getExchangeFileFormatGroups(objRequest, function (callbackFFGroup) {
                    if (callbackFFGroup.STATUS == "SUCCESS") {
                        var SUCCESS_DATA = callbackFFGroup.SUCCESS_DATA;
                        var ffg_json = "";
                        if (SUCCESS_DATA.length > 0) {
                            ffg_json = JSON.parse(SUCCESS_DATA[0]["ffg_json"]) || "";
                        }
                        var exGatewayCond = {
                            'exg_code': GW_CODE,
                            'client_id': objSessionInfo.CLIENT_ID,
                            'app_id': objSessionInfo.APP_ID
                        };
                        if (isLatestPlatformVersion) {
                            reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters...', objLogInfo);
                            exGatewayCond.TENANT_ID = objSessionInfo.TENANT_ID;
                        }
                        reqExchangeHelper.GetExGatewayDetails(dep_cas_instance, exGatewayCond, objLogInfo, function (error, result) {
                            // reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_gateways', [], exGatewayCond, objLogInfo, function (error, result) {
                            if (error) {
                                SendErrorResponse('Error while getting data from ex_gateways', error, "ERR-EXG-1000");
                            } else {
                                if (result.rows.length > 0) {
                                    var exGatewaysResponse = result.rows[0];
                                    var gatewayType = exGatewaysResponse.gateway_type;

                                    if (gatewayType === "FTP" || gatewayType === "SFTP") {
                                        var ftpConfig = JSON.parse(exGatewaysResponse.gateway_config);
                                        ftpConfig.FOLDERPATH = exGatewaysResponse.read_path;
                                        ftpConfig.log_info = objLogInfo;
                                        ftpConfig.skipFileMovingProcess = skipFileMovingProcess; // To Skip the File Moving process
                                        ftpConfig.gateway_type = gatewayType;
                                        objRequest["gateway_type"] = gatewayType
                                        objRequest["cert_location_type"] = ftpConfig.cert_location_type
                                        objRequest["TENANT_ID"] = objLogInfo.TENANT_ID;
                                        reqExchangeHelper.GetPrivateKeyStoreFTPInfo(objRequest, objLogInfo, async function (error, arrKeyStoreFTPInfo) {
                                            try {
                                                var keystoresftpInfo = "";
                                                if (arrKeyStoreFTPInfo && arrKeyStoreFTPInfo.length) {
                                                    const element = arrKeyStoreFTPInfo[0];
                                                    try {
                                                        if (element.category == 'EXG_PKI_STORE') {
                                                            var encdata = element['setup_json'];
                                                            var DecryptedSetupJson = await reqFXDBInstance.GetDecryptedData(clt_cas_instance, encdata, objLogInfo);
                                                            keystoresftpInfo = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(DecryptedSetupJson)])[0]; // JSON.parse(element['setup_json'])['VALUE'];
                                                            console.log('keystore - ' + JSON.stringify(keystoresftpInfo));
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ELIGIBLEHELPER_1002', 'Catch Error While parsing Data from Tenant Setup Json...', error);
                                                    }
                                                }
                                                ftpConfig.keystoresftpInfo = keystoresftpInfo || "";
                                                var exchangeFileInfoRequest = "";
                                                var FtpFiles = "";
                                                var removedSlashReadPath = '';
                                                var selected_files_from_screen = reqBody.selected_files;
                                                async.series([
                                                    function (asyncSeriesCallBack) {
                                                        removedSlashReadPath = ftpConfig.FOLDERPATH;
                                                        removedSlashReadPath = ftpHelper.RemoveSlashCharFrmString(removedSlashReadPath);
                                                        if (selected_files_from_screen && selected_files_from_screen.length) {
                                                            var data = [];
                                                            for (var index = 0; index < selected_files_from_screen.length; index++) {
                                                                if ((selected_files_from_screen)[index] === undefined) {
                                                                    break;
                                                                } else {
                                                                    var ObjFile = selected_files_from_screen[index];
                                                                    ObjFile['STATUS'] = 'NOT DOWNLOADED';
                                                                    data.push(ObjFile);
                                                                }
                                                            }
                                                            FtpFiles = data;
                                                            asyncSeriesCallBack();
                                                        } else {
                                                            ftpHelper.getFileList(ftpConfig, function (callbackFtpFiles) {
                                                                if (callbackFtpFiles.STATUS === "SUCCESS") {
                                                                    var tempdata = callbackFtpFiles.DATA;
                                                                    FtpFiles = reqExchangeHelper.CheckMatchingPattern(tempdata, ffg_json, objSessionInfo, objLogInfo).validFiles;

                                                                    if (FtpFiles.length === 0) {
                                                                        SendSuccessResponse([], "No Files In FTP")
                                                                    }
                                                                    else {
                                                                        return asyncSeriesCallBack();
                                                                    }
                                                                } else {
                                                                    SendErrorResponse('error occured', callbackFtpFiles.MESSAGE, "ERR-EXG-1008");
                                                                }
                                                            });
                                                        }
                                                    },
                                                    function (asyncSeriesCallBack) {
                                                        // Comparing Current Eligible Files with Redis Sessions 3[Temporary Files],7 [All FTP Files]
                                                        var FilterFTPFilesByRedisSessionReqObj = {};
                                                        FilterFTPFilesByRedisSessionReqObj.file_count_limit = selected_files_from_screen.length ? null : FILE_COUNT_LIMIT;
                                                        FilterFTPFilesByRedisSessionReqObj.ftp_files = FtpFiles;
                                                        FilterFTPFilesByRedisSessionReqObj.objLogInfo = objLogInfo;
                                                        FilterFTPFilesByRedisSessionReqObj.ffg_code = FFG_CODE;
                                                        FilterFTPFilesByRedisSessionReqObj.app_id = APP_ID;
                                                        FilterFTPFilesByRedisSessionReqObj.tenant_id = TENANT_ID;
                                                        FilterFTPFilesByRedisSession(FilterFTPFilesByRedisSessionReqObj, function (error, FilterFTPFilesByRedisSessionCB) {
                                                            if (error) {
                                                                return SendErrorResponse('Getting Error While Filtering FTP Files By Using Redis Session...', error, "ERR-EXG-10080");
                                                            } else {
                                                                FtpFiles = FilterFTPFilesByRedisSessionCB;
                                                                return asyncSeriesCallBack();
                                                            }
                                                        });
                                                    },
                                                    function (asyncSeriesCallBack) {
                                                        if (SKIP_FTP_DOWNLOAD) { // Based on exg_download_mode in TENANT_SETUP
                                                            var newFtpDownloadFolder = '//Download//' + TENANT_ID + '//' + APP_ID + '//' + FFG_CODE + '//';
                                                            // To Create Sub Folders If Folder Does not exist in FTP
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Creating Ftp Folder - ' + newFtpDownloadFolder, objLogInfo);
                                                            ftpHelper.createFolder(newFtpDownloadFolder, ftpConfig, objLogInfo)
                                                                .finally(asyncSeriesCallBack)
                                                        } else {
                                                            // removedSlashReadPath = removedSlashReadPath + '_duplicate';
                                                            // removedSlashReadPath = removedSlashReadPath + '_processed';
                                                            asyncSeriesCallBack();
                                                        }
                                                    },
                                                    function (asyncSeriesCallBack) {
                                                        if (!FtpFiles.length) {
                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ELIGIBLEHELPER-1004', 'There are no files for the duplicate verification process...', error);
                                                            return SendSuccessResponse([], 'There are no files for the duplicate verification process...');
                                                        }
                                                        var successFiles = [];
                                                        // var file_count_limit = 500; // dynamic
                                                        var file_count_success = 0; // dynamic
                                                        // reqRedisInstance.GetRedisConnection(function (error, redis_instance) {
                                                        reqRedisInstance.GetRedisConnectionwithIndex(3, function (error, redis_instance) {
                                                            if (error) {
                                                                SendErrorResponse('Error While Getting Redis Connection with Index - 2', error, "ERR-EXG-2008");
                                                            }
                                                            else {
                                                                var redisKey = '';
                                                                var redisKeyValue = {};
                                                                var ttl = '300'; // 5 Minutes in Seconds
                                                                async.forEachOfSeries(FtpFiles, function (FTPFileInfo, i, CB) {
                                                                    try {
                                                                        redisKey = TENANT_ID + '_' + APP_ID + '_' + FFG_CODE + '_' + FTPFileInfo.name;
                                                                        redisKeyValue.FILE_NAME = redisKey;
                                                                        redisKeyValue.DATE_AND_TIME = new Date().toLocaleString();
                                                                        var objFileDetails = {};
                                                                        objFileDetails.file_name = redisKey;
                                                                        objFileDetails.initiated_time = Date.now();
                                                                        objFileDetails.readable_time = new Date().toLocaleString();

                                                                        RedisSetNx(redis_instance, redisKey, JSON.stringify(objFileDetails), ttl, function () {
                                                                            successFiles.push(FTPFileInfo);
                                                                            CB();
                                                                        })

                                                                        // await client.set(redisKey, JSON.stringify(objFileDetails), { EX: ttl, NX: true });
                                                                        // successFiles.push(FTPFileInfo);
                                                                        // CB();

                                                                        // redis_instance.set(redisKey, JSON.stringify(objFileDetails), 'NX', 'EX', ttl, function (error, result) {
                                                                        //     if (result) {
                                                                        //         // redis_instance.set(redisKey, JSON.stringify(redisKeyValue), 'EX', ttl);
                                                                        //         successFiles.push(FTPFileInfo);
                                                                        //         CB();
                                                                        //     } else {
                                                                        //         CB();
                                                                        //     }
                                                                        // });

                                                                    } catch (error) {
                                                                        CB();
                                                                    }
                                                                }, function (error, result) {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count For Current Thread - ' + successFiles.length, objLogInfo);
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files For Current Thread - ' + JSON.stringify(successFiles), objLogInfo);
                                                                    FtpFiles = successFiles;
                                                                    asyncSeriesCallBack();
                                                                });

                                                            }
                                                        });
                                                    },
                                                    function (asyncSeriesCallBack) {
                                                        exchangeFileInfoRequest = {
                                                            "EXFFG_CODE": FFG_CODE,
                                                            "write_path": exGatewaysResponse.write_path,
                                                            "objLogInfo": objLogInfo,
                                                            "FILES": FtpFiles,
                                                            "EXFF_ID": 0
                                                        };
                                                        exchangeFileInfoRequest.gateway_config = exGatewaysResponse;
                                                        exchangeFileInfoRequest.tran_db_instance = tran_db_instance;
                                                        exchangeFileInfoRequest.session = objSessionInfo;
                                                        exchangeFileInfoRequest.objLogInfo = objLogInfo;
                                                        exchangeFileInfoRequest.DST_ID = Des_sys;
                                                        var files = exchangeFileInfoRequest.FILES;
                                                        var tempFiles = [];
                                                        reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Insert Process Started with PRCT_ID - ' + objLogInfo.PROCESS_INFO.PRCT_ID, objLogInfo);
                                                        for (var i = 0; i < files.length; i++) {
                                                            if (files[i].childfiles && files[i].childfiles.length) {
                                                                for (var j = 0; j < files[i].childfiles.length; j++) {
                                                                    var tempObj = {
                                                                        "file_name": files[i].childfiles[j]["name"],
                                                                        "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                                        "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo),
                                                                        "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID,
                                                                        "status": "INPROGRESS",
                                                                        "exg_code": exGatewaysResponse.exg_code
                                                                    }
                                                                    tempFiles.push(tempObj);
                                                                }
                                                            } else {
                                                                var tempObj = {
                                                                    "file_name": files[i]["name"],
                                                                    "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                                    "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo),
                                                                    "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID,
                                                                    "status": "INPROGRESS",
                                                                    "exg_code": exGatewaysResponse.exg_code
                                                                }
                                                                tempFiles.push(tempObj);
                                                            }
                                                        }
                                                        var prct_id = objLogInfo.PROCESS_INFO.PRCT_ID;

                                                        // INSERT INTO "TMP_EX_HEADER_FILES"
                                                        reqTranDBInstance.InsertBulkTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", tempFiles, objLogInfo, null, function (result, error) {
                                                            if (error) {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Removing File Names from Redis Session Due to TMP_EX_HEADER_FILES Insert Process Failed...', objLogInfo);
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Temp Table Insert Error - ' + error.stack, objLogInfo);
                                                                var RemoveFileNameFromRedisSessionReqObj = {};
                                                                RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                RemoveFileNameFromRedisSessionReqObj.FILES = files;
                                                                RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                    SendErrorResponse("Error occured insert bulk TMP_EX_HEADER_FILES ", error, 'ERR-ELIGIBLEHELPER-1000');
                                                                });
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Insert Process Completed Successfully...', objLogInfo);
                                                                if (tempFiles[tempFiles.length - 1] == ",") {
                                                                    tempFiles = tempFiles.slice(0, -1);
                                                                }
                                                                var newPlatformFilters = " and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "'";
                                                                var query = "select ehf.exhf_id,ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED' or file_status = 'UPDATE_FAILED' or file_status = 'PARSING_FAILED' or file_status = 'FILE_UPDATION_INPROGRESS') and exffg_code= '" + FFG_CODE + "' and tmp.prct_id= '" + prct_id + "'";
                                                                if (isLatestPlatformVersion) {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'APP_ID and TENANT_ID filters are Added in the Query..', objLogInfo);
                                                                    query = query + newPlatformFilters;
                                                                }
                                                                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                                    if (error) {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Removing File Names from Redis Session Due to EX_HEADER_FILES Duplicate Verification Process Failed...', objLogInfo);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'EX_HEADER_FILES Duplicate Verification Process Error - ' + error.stack, objLogInfo);
                                                                        var RemoveFileNameFromRedisSessionReqObj = {};
                                                                        RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                        RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                        RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                        RemoveFileNameFromRedisSessionReqObj.FILES = files;
                                                                        RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                        reqExchangeHelper.AddTmpExHFInsertFailedPrctID(prct_id);
                                                                        reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                            // Writing Service Log File To Delete Tmp Table Data
                                                                            reqExchangeHelper.WritePrctToNullServiceLogFile(requestdata.headers, prct_id, reqObj.SERVICE_LOG_FOLDER_PATH, 'DELETE_PRCT_ID', 'TMP_EX_HEADER_FILES', function () {
                                                                                return SendErrorResponse("EX_HEADER_FILES Duplicate Verification Query Failed...", error, 'ERR-ELIGIBLEHELPER-1002');
                                                                            });
                                                                        });
                                                                    } else {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicate File Verification Process Completed Successfully...', objLogInfo);
                                                                        var dupFilesFromExhf = result.rows;
                                                                        var filesTemp = [];
                                                                        var hf_arr = []
                                                                        for (var f = 0; f < dupFilesFromExhf.length; f++) {
                                                                            filesTemp.push(dupFilesFromExhf[f]["file_name"])
                                                                            hf_arr.push({
                                                                                name: dupFilesFromExhf[f]["file_name"],
                                                                                hf_id: dupFilesFromExhf[f]["exhf_id"]
                                                                            })
                                                                        }
                                                                        var tempfileArr = [];
                                                                        for (var tempfileObj of tempFiles) {
                                                                            tempfileArr.push(tempfileObj['file_name']);
                                                                        }
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from FTP - ' + tempfileArr.length, objLogInfo);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from QUERY - ' + filesTemp.length, objLogInfo);

                                                                        var remainingFiles = [];
                                                                        remainingFiles = tempfileArr.diff(filesTemp);
                                                                        var filesToRename = [];
                                                                        var arrTotalDupFileList = [];
                                                                        //Adding Duplicated File Names
                                                                        arrTotalDupFileList = arrTotalDupFileList.concat(filesTemp);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicated Count - ' + arrTotalDupFileList.length, objLogInfo);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Removing Duplicates from  - ' + JSON.stringify(arrTotalDupFileList), objLogInfo);
                                                                        arrTotalDupFileList = removeDuplElm(arrTotalDupFileList);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Distinct Duplicated Count - ' + arrTotalDupFileList.length, objLogInfo);
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Distinct Duplicated Files - ' + JSON.stringify(arrTotalDupFileList), objLogInfo);
                                                                        if (arrTotalDupFileList.length) {
                                                                            var moveFrom = removedSlashReadPath + '\\';
                                                                            var moveTo = removedSlashReadPath + "_duplicate" + "\\";
                                                                            // var moveTo = removedSlashReadPath + "_processed" + "\\";


                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Creating Duplicate Folder in FTP - ' + moveTo, objLogInfo);
                                                                            ftpHelper.createFolder(moveTo, ftpConfig, objLogInfo)
                                                                                .then(() => {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Removing Duplicated File Names from Redis Session Memory...', objLogInfo);
                                                                                    for (var file of arrTotalDupFileList) {
                                                                                        try {
                                                                                            var obj = {
                                                                                                "file_name": file,
                                                                                                "fromPath": moveFrom,
                                                                                                "toPath": moveTo
                                                                                            }
                                                                                            filesToRename.push(obj);
                                                                                        } catch (error) {
                                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-1032', 'Exception thrown while removing filename - ' + FFG_CODE + '_' + file + ' from global.ht_exg_ftp_file_names..', error);
                                                                                        }
                                                                                    }
                                                                                    if (!remainingFiles.length) {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Deleting Duplicated Entries from TMP_EX_HEADER_FILES for Prct_ID - ' + prct_id, objLogInfo);
                                                                                        var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "'";
                                                                                        reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                                                            if (error) {
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Removing File Names from Redis session Due to TMP_EX_HEADER_FILES Delete Process Failed......', objLogInfo);
                                                                                                var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                RemoveFileNameFromRedisSessionReqObj.FILES = files;
                                                                                                RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                reqExchangeHelper.AddTmpExHFInsertFailedPrctID(prct_id);
                                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-1032', 'TMP_EX_HEADER_FILES Delete Process Failed...', error);
                                                                                                reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                    // Writing Service Log File To Delete Tmp Table Data
                                                                                                    reqExchangeHelper.WritePrctToNullServiceLogFile(requestdata.headers, prct_id, reqObj.SERVICE_LOG_FOLDER_PATH, 'DELETE_PRCT_ID', 'TMP_EX_HEADER_FILES', function () {
                                                                                                        return SendErrorResponse("TMP_EX_HEADER_FILES Delete Process Failed...", error, 'ERR-EXG-1032');
                                                                                                    });
                                                                                                });
                                                                                            }
                                                                                            else {
                                                                                                // For Moving Downloaded Files to read_path+'_processed' Path
                                                                                                ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo)
                                                                                                    .then(() => {
                                                                                                        var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                        RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.FILES = filesToRename;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                        reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                            preparingResponseData();
                                                                                                        });
                                                                                                    }).catch((err) => {
                                                                                                        var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                        RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.FILES = files;
                                                                                                        RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                        reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                            SendErrorResponse("Files moving to _processed folder failed", err, 'ERR-EXG-1012');
                                                                                                        });
                                                                                                    })
                                                                                            }
                                                                                        });
                                                                                    } else {
                                                                                        // For Moving Downloaded Files to read_path+'_duplicate' Path
                                                                                        ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo)
                                                                                            .then(() => {
                                                                                                var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                RemoveFileNameFromRedisSessionReqObj.FILES = filesToRename;
                                                                                                RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                    preparingResponseData();
                                                                                                });
                                                                                            }).catch((err) => {
                                                                                                var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                                RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                                RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                                RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                                RemoveFileNameFromRedisSessionReqObj.FILES = files;
                                                                                                RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                                                reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                                    SendErrorResponse("Files moving to _processed folder failed", err, 'ERR-EXG-1012');
                                                                                                });
                                                                                            })
                                                                                    }
                                                                                })
                                                                                .catch((err) => {
                                                                                    reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                        SendErrorResponse("Error while creating Duplicate folder in FTP", err, 'ERR-ELIGIBLEHELPER-1008');
                                                                                    });
                                                                                })


                                                                        } else {
                                                                            preparingResponseData();
                                                                        }
                                                                    }

                                                                    function preparingResponseData() {
                                                                        try {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Remaining Files Count - ' + remainingFiles.length, objLogInfo);
                                                                            var resData = [];
                                                                            for (var i in files) {
                                                                                for (var j in remainingFiles) {
                                                                                    if (files[i].childfiles && files[i].childfiles.length > 0) {
                                                                                        for (var indexf in files[i].childfiles) {
                                                                                            if (remainingFiles[j] != "" && remainingFiles[j] == files[i].childfiles[indexf]["name"]) {
                                                                                                files[i].childfiles[indexf]["STATUS"] = "NOT DOWNLOADED"
                                                                                                resData.push(files[i]);
                                                                                            }
                                                                                            if (remainingFiles[j] != "" && remainingFiles[j] == files[i]["name"]) {
                                                                                                files[i]["STATUS"] = "NOT DOWNLOADED"
                                                                                                resData.push(files[i]);
                                                                                            }
                                                                                        }
                                                                                    } else {
                                                                                        if (remainingFiles[j] != "" && remainingFiles[j] == files[i]["name"]) {
                                                                                            files[i]["STATUS"] = "NOT DOWNLOADED"
                                                                                            resData.push(files[i]);
                                                                                        }
                                                                                    }

                                                                                }
                                                                            }

                                                                            for (var i = 0; i < resData.length; i++) {
                                                                                for (var j = 0; j < hf_arr.length; j++) {
                                                                                    if (resData[i]["name"] == hf_arr[j]["file_name"]) {
                                                                                        resData[i]["hf_id"] = hf_arr[j]["hf_id"]
                                                                                    }
                                                                                }
                                                                            }
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count ' + resData.length, objLogInfo);
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Not Calling delete TMP_EX_HEADER_FILES', objLogInfo);
                                                                            SendSuccessResponse(resData);

                                                                        } catch (catchError) {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Removing File Names from Hash Table Memory Due to Preparing Eligible File List Process Failed...', objLogInfo);
                                                                            var RemoveFileNameFromRedisSessionReqObj = {};
                                                                            RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                            RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                            RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                            RemoveFileNameFromRedisSessionReqObj.FILES = files;
                                                                            RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = FFG_CODE;
                                                                            reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, function (error, result) {
                                                                                SendErrorResponse('Error in preparing eligible file list', catchError, 'ERR-EXG-1033');
                                                                            });
                                                                        }

                                                                    }
                                                                });
                                                            }
                                                        })
                                                    }
                                                ])
                                            } catch (ex) {
                                                SendErrorResponse("Exception occured get ex gateway callback", ex, 'ERR-EXG-1013');
                                            }

                                        })
                                    } else if (exGatewaysResponse.gateway_type === "Local" || exGatewaysResponse.gateway_type === "LOCAL") {
                                        var read_path = exGatewaysResponse.read_path;
                                        var write_path = exGatewaysResponse.write_path;

                                        reqObj['tenant_id'] = objSessionInfo['TENANT_ID'];
                                        reqObj['TENANT_ID'] = objSessionInfo['TENANT_ID'];

                                        reqExchangeHelper.Getstoragepath(reqObj, function (storagePath) {

                                            //read_path = "D:\\exchange\\read\\";
                                            fs.readdir(read_path, function (err, files) {
                                                if (err) {
                                                    SendErrorResponse("Error while transferring files from read path to local", err, 'ERR-EXG-1014');
                                                }
                                                var fileArr = []
                                                var tempFiles = [];
                                                for (var x = 0; x < files.length; x++) {
                                                    tempFiles.push({
                                                        "name": files[x]
                                                    })
                                                }

                                                files = reqExchangeHelper.CheckMatchingPattern(tempFiles, ffg_json, objSessionInfo, objLogInfo).validFiles;
                                                async.forEachOf(files, function (value, key, asyncCallback) {
                                                    fileArr.push({
                                                        "name": value["name"],
                                                        "size": Math.ceil(fs.statSync(path.join(read_path, value["name"])).size / 1024) + "KB",
                                                        "matching_pattern": value["matching_pattern"],
                                                        "fileName": value["name"],
                                                    })
                                                    asyncCallback();
                                                }, function (err) {
                                                    if (!err) {
                                                        var files = fileArr;
                                                        var tempFiles = [];
                                                        for (var i in files) {
                                                            var tempObj = {
                                                                "file_name": files[i]["name"],
                                                                "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                                "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo)
                                                            }
                                                            tempFiles.push(tempObj);
                                                        }
                                                        reqTranDBInstance.InsertBulkTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", tempFiles, objLogInfo, null, function (result, error) {
                                                            if (error) {
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                                            } else {
                                                                if (tempFiles[tempFiles.length - 1] == ",") {
                                                                    tempFiles = tempFiles.slice(0, -1);
                                                                }
                                                                if (typeof (tempFiles) != "object") {
                                                                    tempFiles = tempFiles.split(",");
                                                                }

                                                                var query = "select ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED' or file_status= 'PARSING_FAILED' or file_status = 'FILE_UPDATION_INPROGRESS') and exffg_code= '" + FFG_CODE + "' "
                                                                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                                    var filesFromTbl = result.rows;

                                                                    var filesTemp = [];
                                                                    for (var f in filesFromTbl) {
                                                                        filesTemp.push(filesFromTbl[f]["file_name"])
                                                                    }

                                                                    var tempfileArr = [];
                                                                    for (var tempfileObj of tempFiles) {
                                                                        tempfileArr.push(tempfileObj['file_name']);
                                                                    }
                                                                    var remainingFiles = tempfileArr.diff(filesTemp);
                                                                    var resData = [];

                                                                    for (var i = 0; i < files.length; i++) {
                                                                        for (var j = 0; j < remainingFiles.length; j++) {
                                                                            if (remainingFiles[j] != "" && remainingFiles[j] == files[i]["name"]) {
                                                                                files[i]["STATUS"] = "NOT DOWNLOADED"
                                                                                resData.push(files[i]);
                                                                            }
                                                                        }
                                                                    }
                                                                    var deleteobj = {
                                                                        "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID
                                                                    }
                                                                    reqTranDBInstance.DeleteTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", deleteobj, objLogInfo, function (result, error) {
                                                                        if (error) {
                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                        } else {
                                                                            if (result == "SUCCESS") {
                                                                                SendSuccessResponse(resData)
                                                                            }
                                                                        }
                                                                    })
                                                                });
                                                            }
                                                        })
                                                    } else {
                                                        SendErrorResponse("Error occured async for each", err, 'ERR-EXG-1015');
                                                    }
                                                })
                                            });
                                        });
                                    } else {
                                        SendErrorResponse("Error while transferring files from read path to local", 'Error occured', 'ERR-EXG-1002');
                                    }
                                } else {
                                    SendErrorResponse("No Gateway Information Found ", 'Gate way not found', 'ERR-EXG-1003');
                                }
                            }
                        })

                    } else {
                        SendErrorResponse(callbackFFGroup.ERROR_MESSAGE, callbackFFGroup.ERROR_OBJECT, 'ERR-EXG-1004');
                    }
                });

            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Catch Error in GetProcessToken() function', error);
                SendErrorResponse("Exception occured ", error, 'ERR-EXG-1016');
            }
        }).catch((err) => {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Catch Error in GetProcessToken() function', err);
            SendErrorResponse("Exception occured getOrCreateProcessToken", err, 'ERR-EXG-1017');
        })

        function SendSuccessResponse(result) {
            print_info("Funtion - SendSuccessResponse method called")
            print_info("Sending Success Response")
            var resObj = {};
            resObj.status = 'SUCCESS';
            resObj.data = result;
            pcallback(resObj)
        }

        function SendErrorResponse(message, ex, errCode) {
            print_info("Funtion - SendErrorResponse method called")
            print_info("Sending Failure Response")
            var resObj = {};
            resObj.status = 'FAILURE';
            resObj.err_msg = message;
            resObj.error = ex;
            resObj.error_code = errCode
            pcallback(resObj)
        }

        function print_info(pStr_mesg) {
            reqInstanceHelper.PrintInfo(serviceName, pStr_mesg, objLogInfo);
        }

        function getOrCreateProcessToken(tran_db_instance, objLogInfo, prct_id) {
            return new Promise((resolve, reject) => {
                if (!prct_id) {
                    reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (err, prct_id_new) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(prct_id_new);
                        }
                    })
                } else {
                    resolve(prct_id);
                }
            })
        }
    } catch (error) {
        SendErrorResponse("Exception occured GetEliglbleFile", error, 'ERR-EXG-1019');
    }

}

Array.prototype.diff = function (a) {
    return this.filter(function (i) {
        return a.indexOf(i) < 0;
    });
};


function removeDuplElm(fullArray) {
    fullArray = fullArray.filter(function (elem, pos) {
        return fullArray.indexOf(elem) == pos;
    })
    return fullArray;
}


function FilterFTPFilesByRedisSession(FilterFTPFilesByRedisSessionReqObj, FilterFTPFilesByRedisSessionCB) {
    try {
        /* FilterFTPFilesByRedisSessionReqObj Should contains
        - ftp_files
        - ffg_code
        - objLogInfo
        - app_id
        - tenant_id
        - file_count_limit */
        var FilteredFTPFiles = [];
        var redisKey = '';
        var objLogInfo = FilterFTPFilesByRedisSessionReqObj.objLogInfo;
        var ftp_files = FilterFTPFilesByRedisSessionReqObj.ftp_files;
        var ffg_code = FilterFTPFilesByRedisSessionReqObj.ffg_code;
        var app_id = FilterFTPFilesByRedisSessionReqObj.app_id;
        var tenant_id = FilterFTPFilesByRedisSessionReqObj.tenant_id;
        var file_count_limit = FilterFTPFilesByRedisSessionReqObj.file_count_limit;
        reqRedisInstance.GetRedisConnectionwithIndex(3, function (error, redis_instance_3) {
            reqRedisInstance.GetRedisConnectionwithIndex(7, function (error, redis_instance_7) {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ELIGIBLEHELPER-1005', 'Error while Getting Redis Connection....', error);
                    return FilterFTPFilesByRedisSessionCB(error, FilteredFTPFiles);
                } else {
                    async.forEachOfSeries(ftp_files, function (FTPFileInfo, i, CB) {
                        try {
                            redisKey = tenant_id + '_' + app_id + '_' + ffg_code + '_' + FTPFileInfo.name;
                            // var result = await redis_instance_7.exists(redisKey)
                            RediskeyExists(redis_instance_7, redisKey, function (result, error) {
                                // redis_instance_7.exists(redisKey, function (error, result) {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ELIGIBLEHELPER-1006', 'Error while Checking Exchange file name as redis key in DB3....', error);
                                    return FilterFTPFilesByRedisSessionCB(error, FilteredFTPFiles);
                                } else {
                                    if (!result) {
                                        RediskeyExists(redis_instance_3, redisKey, function (result, error) {
                                            // redis_instance_3.exists(redisKey, function (error, result) {
                                            // result = await redis_instance_3.exists(redisKey)
                                            if (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-ELIGIBLEHELPER-1007', 'Error while Checking Exchange file name as redis key in DB7....', error);
                                                return FilterFTPFilesByRedisSessionCB(error, FilteredFTPFiles);
                                            } else {
                                                if (!result) {
                                                    if (!file_count_limit) {
                                                        // Files From Screen
                                                        FilteredFTPFiles.push(FTPFileInfo);
                                                        CB();
                                                    } else if (file_count_limit > FilteredFTPFiles.length) {
                                                        // Select Mode as ALL
                                                        FilteredFTPFiles.push(FTPFileInfo);
                                                        CB();
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Filtered Eligible Files Count From Redis Session based on File Limit Count Param - ' + FilteredFTPFiles.length, objLogInfo);
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Filtered Eligible Files Count From Redis Session based on File Limit Count Param - ' + JSON.stringify(FilteredFTPFiles), objLogInfo);
                                                        return FilterFTPFilesByRedisSessionCB(null, FilteredFTPFiles);
                                                    }
                                                } else {
                                                    CB();
                                                }
                                            }
                                        });

                                    } else {
                                        CB();
                                    }
                                }
                            });
                        } catch (error) {
                            CB();
                        }
                    }, function (error, result) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count From Redis Session - ' + FilteredFTPFiles.length, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count From Redis Session - ' + JSON.stringify(FilteredFTPFiles), objLogInfo);
                        return FilterFTPFilesByRedisSessionCB(null, FilteredFTPFiles);
                    });
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, null, 'ERR-EXG-100090', 'Catch Error in FilterFTPFilesByRedisSession()...', error);
        return FilterFTPFilesByRedisSessionCB(error, FilteredFTPFiles);
    }

}
async function RedisSetNx(redisSession, pkey, objFileDetails, ttl, callback) {
    try {
        await client.set(redisKey, objFileDetails, { EX: ttl, NX: true });
        callback("SUCCESS")
    } catch (error) {
        callback("FAILURE - " + error)
    }
}

async function RediskeyExists(redisSession, pkey, callback) {
    try {
        console.log('Redis Key ' + pkey)
        var result = await redisSession.exists(pkey);
        if (result) {
            console.log('available');
        } else {
            console.log('Not available');
        }
        callback(result)

    } catch (error) {
        callback("FAILURE - " + error)
    }
}

module.exports = {
    GetEliglbleFile: GetEliglbleFile,
    ClearHstMemory: ClearHstMemory
}