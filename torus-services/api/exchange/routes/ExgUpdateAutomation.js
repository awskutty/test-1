/**
 * @Api_Name        : /ExgImportDownload,
 * @Description     : Import file from specified path,
 * @Last_Error_Code : ERR-EXC-1000
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqAuditLog = require(refPath + 'log/audit/AuditLog');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var ftpHelper = require('./helper/FTPHelper');
var serviceName = "EXGImportDownload";
var commonFile = require('./util/Common');
var reqGetEligibleFileHelper = require('./helper/GetEligibleFileHelper');
var minimatch = require(modPath + 'minimatch');
var fs = require('fs');
var path = require("path");

/* global.ht_exg_ftp_file_names = new reqHashTable();

// Global Variable Declaration 
global.ht_exg_ftp_download_process = new reqHashTable(); // Checking for File Download Process in Progress or Not
global.Exg_Down_DB_Insert_Failed_prct_ID = []; // Array Contains - ['1','2'...] */

router.post('/ExgUpdateAutomation', function (appRequest, appResponse) {
    var SESSION_ID = "";
    var objLogInfo = "";
    global.Exg_Update_Need_Prct_Null_Process = true; // Boolean to  write service log File or Not
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfoobj, objSessionInfo) {

        objLogInfo = objLogInfoobj;
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_UPDATE_AUTOMATION';
        objLogInfo.PROCESS = 'EXG_UPDATE_AUTOMATION';
        objLogInfo.ACTION_DESC = 'Import file';
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var reqBody = appRequest.body.PARAMS;
            var reqObj = reqBody;
            var OriginalUrl = appRequest.originalUrl;
            var TENANT_ID = objSessionInfo.TENANT_ID;
            reqObj['TENANT_ID'] = TENANT_ID;
            reqObj['tenant_id'] = TENANT_ID;
            var FFG_CODE = reqBody.FFG_CODE;
            var GW_CODE = reqBody.GW_CODE;
            var Des_sys = reqBody.Des_sys;
            reqBody.DST_ID = Des_sys;
            var SOURCE_S_ID = objSessionInfo.S_ID;
            var APP_ID = objSessionInfo.APP_ID;
            reqObj.EXG_CODE = GW_CODE;
            reqObj.SERVICE_LOG_FOLDER_PATH = '../../../torus-services/api/exchange/service_logs/update/' + FFG_CODE + '/';
            var storagePath = "";
            SESSION_ID = appRequest.body.SESSION_ID;
            var can_import = reqBody.CAN_IMPORT || reqBody.can_import || false;

            var OriginalSelectedFiles = [];

            var fileArr = [];
            var exchangeEntry = {

            };

            var objGatewayReq = {
                'CLIENT_ID': CLIENT_ID,
                'APP_ID': APP_ID,
                'TENANT_ID': TENANT_ID,
                'SOURCE_S_ID': SOURCE_S_ID,
                'DEST_S_ID': Des_sys
            };
            var selected_files = [];

            if (reqBody.Select_Mode == undefined) {
                reqBody.Select_Mode = "";
            }



            /* var FTP_Downld_Process = global.ht_exg_ftp_download_process.get('FTP_DOWNLOAD_IN_PROGRESS');
            if (FTP_Downld_Process && FTP_Downld_Process.download_in_process) {
                reqInstanceHelper.PrintInfo(serviceName, 'Files Download Process already in Process... ', objLogInfo);
                var FILE_DOWNLD_MEM_TTL = reqBody.FILE_MEM_TTL_IN_MS || 600000; // Milli Seconds || 10 mintues
                reqGetEligibleFileHelper.ClearHstMemory(FILE_DOWNLD_MEM_TTL, 'Download_In_Progress');
                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, "ERR-EXG-1078", "Files Download Process already in Process...", '');
            } */
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                        reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (err, prct_id) {
                            // selected_files = reqBody.Selected_items;
                            if (err) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'Error Code', 'Error in GetProcessToken function', err);
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Error in GetProcessToken()", err);
                            } else {
                                if (global.ht_exg_down_update_prct_to_null_process.get('HT_EXG_DOWN_UPDATE_PRCT_TO_NULL_PROCESS')) {
                                    GotoFileDownloadProcess();
                                } else {
                                    var Service_Log_Folder_Path = '../../../torus-services/api/exchange/service_logs/update/' + FFG_CODE + '/';
                                    var reqObjServiceLogFile = {};
                                    reqObjServiceLogFile.Service_Log_Folder_Path = Service_Log_Folder_Path;
                                    reqObjServiceLogFile.tran_db_instance = tran_db_instance;
                                    global.ht_exg_down_update_prct_to_null_process.put('HT_EXG_DOWN_UPDATE_PRCT_TO_NULL_PROCESS', true);
                                    reqInstanceHelper.CheckServiceLogFiles(reqObjServiceLogFile, objLogInfo, function (errorFiles) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'PRCT_ID To Null Process Count - ' + errorFiles.length, objLogInfo);
                                        if (errorFiles.length) {
                                            async.forEachOfSeries(errorFiles, function (objErrorFile, index, errorFileCB) {
                                                objErrorFile.file_path = Service_Log_Folder_Path + objErrorFile.file_name;
                                                reqInstanceHelper.ReadingServiceLogFile(objErrorFile, objLogInfo, function (actualFileContent) {
                                                    var file_renaming = (objErrorFile.file_name).split('_');
                                                    if (typeof actualFileContent == 'boolean') {
                                                        if (actualFileContent) {
                                                            reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (Service_Log_Folder_Path + 'PRC_' + file_renaming[1])
                                                                , function () {
                                                                    errorFileCB();
                                                                });
                                                        } else {
                                                            errorFileCB();
                                                        }
                                                    } else {
                                                        var condObj = {};
                                                        var updateColumn = {};
                                                        var PRCT_ID_PROCESS = actualFileContent.File_Down_Null_Prct_ID_Process || null;
                                                        if (PRCT_ID_PROCESS) {
                                                            condObj = PRCT_ID_PROCESS.condObj;
                                                            updateColumn = PRCT_ID_PROCESS.updateColumn;
                                                        }
                                                        var UPDATING_NULL_PRCT_ID = actualFileContent.NULL_PRCT_ID || null;
                                                        if (UPDATING_NULL_PRCT_ID) {
                                                            condObj = {
                                                                PRCT_ID: UPDATING_NULL_PRCT_ID,
                                                                FILE_STATUS: 'DOWNLOADED'
                                                            };
                                                            updateColumn = {
                                                                PRCT_ID: ''
                                                            };
                                                        }

                                                        if (!UPDATING_NULL_PRCT_ID && !PRCT_ID_PROCESS) {
                                                            errorFileCB();
                                                        }
                                                        reqTranDBInstance.UpdateTranDBWithAudit(tran_db_instance, 'EX_HEADER_FILES', updateColumn, condObj, objLogInfo, function (result, error) {
                                                            if (error) {
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120059', 'PRCT_ID update or making NULL in the EX_HEADER_FILES Table is Failed...', error);
                                                            } else {
                                                                reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (Service_Log_Folder_Path + 'PRC_' + file_renaming[1])
                                                                    , function () {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated PRCT_ID or making NULL in the EX_HEADER_FILES Table...', objLogInfo);
                                                                        errorFileCB();
                                                                    });
                                                            }
                                                        });
                                                    }
                                                });
                                            },
                                                function () {
                                                    global.ht_exg_down_update_prct_to_null_process.put('HT_EXG_DOWN_UPDATE_PRCT_TO_NULL_PROCESS', false);
                                                    GotoFileDownloadProcess();
                                                    // return reqInstanceHelper.SendResponse(serviceName, appResponse, 'Pending Files for Making PRCT_ID to Null Process Has Completed...', objLogInfo, '', '', '');
                                                })
                                        } else { // If There is no Error File For Process
                                            global.ht_exg_down_update_prct_to_null_process.put('HT_EXG_DOWN_UPDATE_PRCT_TO_NULL_PROCESS', false);
                                            GotoFileDownloadProcess();
                                        }
                                    });
                                }


                                function GotoFileDownloadProcess() {
                                    var isStaticTran = false; // Boolean Check for Static Elgible Tran Added or Not...
                                    fetchFilesForDownload(appRequest.body, appResponse, prct_id, function (response) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'request object ' + JSON.stringify(reqBody), objLogInfo);
                                        selected_files = response.rows || [];
                                        var ffg_json = "";
                                        if (!selected_files.length) { // Added Static Eligible Tran to make a Dummy call to Windows Service for Processing Recovery Log
                                            isStaticTran = true;
                                            selected_files = [{
                                                name: 'static_file_name.xml',
                                                matching_pattern: "*.xml",
                                                exh_id: 0,
                                                exhf_id: 0,
                                                STATUS: "DOWNLOADED"
                                            }];
                                        }
                                        reqInstanceHelper.PrintInfo(serviceName, 'Selected_FILES COUNT ' + selected_files.length, objLogInfo);
                                        if (selected_files != undefined && selected_files != "" && selected_files.length > 0) {
                                            try {
                                                objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                                reqObj.session = objSessionInfo;
                                                reqObj.clt_cas_instance = clt_cas_instance;
                                                reqObj.dep_cas_instance = dep_cas_instance;
                                                var childrens = [];
                                                var exchangeFileInfoRequest = {
                                                    "EXFFG_CODE": FFG_CODE,
                                                    "objLogInfo": objLogInfo,
                                                    "FILES": selected_files,
                                                    "EXFF_ID": 0,
                                                    "SERVICE_LOG_FOLDER_PATH": '../../../torus-services/api/exchange/service_logs/update/' + FFG_CODE + '/'
                                                };
                                                exchangeFileInfoRequest.EXHF_ID_ARR = [];
                                                exchangeFileInfoRequest.tran_db_instance = tran_db_instance;
                                                exchangeFileInfoRequest.dep_cas_instance = dep_cas_instance;
                                                exchangeFileInfoRequest.clt_cas_instance = clt_cas_instance;
                                                exchangeFileInfoRequest.session = objSessionInfo;
                                                exchangeFileInfoRequest.objLogInfo = objLogInfo;
                                                exchangeFileInfoRequest.DST_ID = Des_sys;
                                                exchangeFileInfoRequest.EXG_CODE = GW_CODE;
                                                exchangeFileInfoRequest.prct_id = prct_id;
                                                exchangeFileInfoRequest.SESSION_ID = SESSION_ID;
                                                exchangeFileInfoRequest["Default_params"] = reqBody["Default_params"];
                                                for (var index = 0; index < selected_files.length; index++) {
                                                    selected_files[index].fileName = selected_files[index].name
                                                    exchangeFileInfoRequest.EXHF_ID_ARR.push({
                                                        "file_name": selected_files[index]["name"],
                                                        "exhf_id": selected_files[index]["exhf_id"]
                                                    });
                                                }
                                                if (reqObj.From_Update) {
                                                    exchangeFileInfoRequest.FROM_UPDATE_FILES = true;
                                                }
                                                if (reqObj['continue_process'] == undefined) {
                                                    exchangeFileInfoRequest['continue_process'] = true;
                                                } else {
                                                    exchangeFileInfoRequest['continue_process'] = reqObj['continue_process'];
                                                }
                                                reqInstanceHelper.PrintInfo(serviceName, 'Can Continue Exchange Process ' + exchangeFileInfoRequest['continue_process'], objLogInfo);
                                                if (can_import) {
                                                    exchangeFileInfoRequest.NEED_TRN_INSERT = true;
                                                } else {
                                                    exchangeFileInfoRequest.NEED_TRN_INSERT = false;
                                                }
                                                exchangeFileInfoRequest.storagePath = storagePath;
                                                // exchangeFileInfoRequest.storagePath = 'D:\\';
                                                exchangeFileInfoRequest.FromDownload = true;
                                                var exh_id = selected_files[0].exh_id;
                                                reqInstanceHelper.PrintInfo(serviceName, 'Can Import - ' + can_import, objLogInfo);
                                                if (can_import) {
                                                    var resExchangeFileInfo = {
                                                        ERROR_CODE: '',
                                                        ERROR_MESSAGE: '',
                                                        ERROR_OBJECT: '',
                                                        INFO_MESSAGE: '',
                                                        PROCESS_STATUS: '',
                                                        STATUS: "SUCCESS",
                                                        SUCCESS_DATA: {
                                                            EXH_ID: exh_id,
                                                            EXHF_ID_ARR: exchangeFileInfoRequest.EXHF_ID_ARR,
                                                        }
                                                    }
                                                    exchangeFileInfoRequest.objLogInfo = objLogInfo;
                                                    exchangeFileInfoRequest["headers"] = mHeaders;
                                                    exchangeFileInfoRequest["originalUrl"] = OriginalUrl;
                                                    exchangeFileInfoRequest["FILE_INFO"] = resExchangeFileInfo;
                                                    exchangeFileInfoRequest.isStaticTran = isStaticTran;
                                                    importFiles(exchangeFileInfoRequest, function (response) {
                                                        if (response.STATUS == "SUCCESS") {
                                                            try {
                                                                if (response.SUCCESS_DATA.SUCCESS_DATA != undefined) {
                                                                    response.SUCCESS_DATA = response.SUCCESS_DATA.SUCCESS_DATA;
                                                                }
                                                            } catch (ex) {

                                                            }
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null, "SUCCESS", "SUCCESS");
                                                        } else {
                                                            if (!isStaticTran && global.Exg_Update_Need_Prct_Null_Process) {
                                                                reqExchangeHelper.WritePrctToNullServiceLogFile(mHeaders, prct_id, exchangeFileInfoRequest.SERVICE_LOG_FOLDER_PATH, 'NULL_PRCT_ID', null, function (params) {
                                                                });
                                                            }
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT, "FAILURE", "FAILURE");
                                                        }
                                                    });
                                                } else {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, null, null, null, "SUCCESS", "SUCCESS");
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'Error Code', 'Catch Error in GetProcessToken function', error);
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Catch Error in GetProcessToken()", error);
                                            }
                                        } else {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, null, null, null, "SUCCESS", "SUCCESS");
                                        }
                                    });
                                }
                            }

                            // Common Method to write a service log file for making prct_id to null
                            function CallingServiceLogFile(pHeaders, pPrct_id, pSERVICE_LOG_FOLDER_PATH) {
                                // Writing Service log file
                                var condObj = {
                                    'PRCT_ID': pPrct_id
                                };
                                var updateColumn = {
                                    'PRCT_ID': ''
                                };
                                var objProcessedFile = {
                                    File_Down_Null_Prct_ID_Process: {
                                        condObj, updateColumn
                                    }
                                };
                                var folderPath = pSERVICE_LOG_FOLDER_PATH;
                                var fileContent = JSON.stringify(objProcessedFile);
                                var fileName = reqInstanceHelper.GetServiceFileName(pHeaders);
                                reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent, function (result) {
                                });
                            }


                            function fetchFilesForDownload(reqObj, appResponse, prct_id, callback) {
                                try {
                                    // var UpdateQry = "UPDATE  EX_HEADER_FILES SET PRCT_ID= '" + prct_id + "' WHERE FILE_NAME IN (SELECT DISTINCT(EHF.FILE_NAME) FILE_NAME FROM EX_HEADER_FILES EHF JOIN EX_HEADER EH ON EH.EXH_ID = EHF.EXH_ID WHERE EHF.FILE_STATUS = 'DOWNLOADED'";
                                    var UpdateQry = "UPDATE  EX_HEADER_FILES SET PRCT_ID= '" + prct_id + "' WHERE FILE_NAME IN (SELECT DISTINCT(EHF.FILE_NAME) FILE_NAME FROM EX_HEADER_FILES EHF JOIN EX_HEADER EH ON EH.EXH_ID = EHF.EXH_ID WHERE EHF.FILE_STATUS = 'DOWNLOADED' and EH.EXFFG_CODE = '" + FFG_CODE + "'";
                                    var tran_limit_count = reqObj.upload_file_limit_count || 50;
                                    // var tran_limit_count = reqObj.upload_file_limit_count || 1;
                                    if (tran_db_instance.DBConn.DBType.toLowerCase() == 'oracledb') {
                                        UpdateQry = UpdateQry + ' AND ROWNUM <= ' + tran_limit_count + ") and   FILE_STATUS = 'DOWNLOADED'";
                                    } else { // For Postgress DB
                                        UpdateQry = UpdateQry + ' LIMIT ' + tran_limit_count + ") and   FILE_STATUS = 'DOWNLOADED'";
                                    }
                                    reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, UpdateQry, objLogInfo, (res, err) => {
                                        if (err) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'Error Code', 'Error occured while fetch eligible file', err);
                                        } else {
                                            var selectqry = "SELECT FILE_NAME as name, EXH_ID, EXHF_ID FROM EX_HEADER_FILES WHERE PRCT_ID= '" + prct_id + "'";
                                            reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, selectqry, objLogInfo, function (result, err) {
                                                try {
                                                    if (err) {
                                                        reqExchangeHelper.WritePrctToNullServiceLogFile(mHeaders, prct_id, reqObj.PARAMS.SERVICE_LOG_FOLDER_PATH, 'NULL_PRCT_ID', null, function () {
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, "", "Error occured while fetch data from header files ", err);
                                                        });
                                                    } else {
                                                        callback(result);
                                                    }
                                                } catch (error) {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, "", "Exception occured", error);
                                                }
                                            });
                                        }
                                    });
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FAILURE', objLogInfo, "", "Exception occured", error);
                                }
                            }
                        });
                    });
                });
            });

            function importFiles(importFileObj, callback) {
                var selected_files = importFileObj.FILES;
                reqExchangeHelper.ImportFile(selected_files, importFileObj, function (responseData) {
                    importFileObj.UPDATE_EXG_FILE = false;
                    return callback(responseData);
                });
            }
        } catch (ex) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "", "Exception occured", ex);
        }
    });

});



module.exports = router;