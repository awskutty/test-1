/**
 @Decsription      : To handle Recovery Log Operations
 @Eror Code         : ERR_RECOVERYLOG_0013
 */

// Require dependencies
var reqAsync = require('async');
var reqMoment = require('moment');
var reqInstanceHelper = require('../../common/InstanceHelper');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');
var reqTranDBInstance = require('../../instance/TranDBInstance');
var reqRedisInstance = require('../../instance/RedisInstance');
var reqProducer = require('../../common/Producer');

// global variables Initialization
var serviceName = 'RecoveryLog';

// This Function Can Be Used Only For API Process
function GetApiRecoveryFileInfo(pObjApiRecoveryInfo, pReqObj) {
    /* pObjApiRecovery Should Contains Below
    - API_RECOVERY_CODE 
    - HEADER 
     pReqObj Should Contains Below
    - objLogInfo */
    try {
        if (!pReqObj) {
            pReqObj = {};
        }
        var strApiRecoveryCode = pObjApiRecoveryInfo.API_RECOVERY_CODE;
        var strApiHeader = pObjApiRecoveryInfo.HEADER;
        var objLogInfo = pReqObj.objLogInfo || {};
        var svc_log_folder_path = (pObjApiRecoveryInfo && pObjApiRecoveryInfo.SERVICE_LOG_FOLDER_PATH) || 'service_logs/' + 'File_Download/' + strApiHeader.routingkey + '/';
        var arrApiRecoveryInfo = [
            {
                API_RECOVERY_CODE: 'EXG_FILE_DOWNLOAD_0001',
                PURPOSE: 'In File Download Process, To DELETE Data BY PRCT_ID Column in TMP_EX_HEADER_FILES Table...',
                PROCESS: 'DELETE',
                REASON: 'Due to DB Connection Error...',
                SERVICE_LOG_FOLDER_PATH: svc_log_folder_path,
                TABLE_NAME: 'TMP_EX_HEADER_FILES'
            }
        ];
        return arrApiRecoveryInfo[arrApiRecoveryInfo.map((ele) => { return ele.API_RECOVERY_CODE }).indexOf(strApiRecoveryCode)];
    } catch (error) {
        printError(serviceName, objLogInfo, 'ERR-REF-230054', 'Catch Error in GetApiRecoveryFileInfo()...', error);
        return {};
    }
}


/* Note : Recovery Codes Are Added Here Commonly For Review The Code In Future Without Any Difficulties and  */

// This Function Can Be Used Only For Background Process
function GetBgRecoveryFileInfo(pObjBgRecovery, pReqObj) {
    /* pObjBgRecovery Should Contains Below
    - BG_RECOVERY_CODE 
    - HEADER 
    
    Optional Params
    - SERVICE_LOG_FOLDER_PATH
  
     pReqObj Should Contains Below
    - objLogInfo 
    */
    try {
        if (!pReqObj) {
            pReqObj = {};
        }
        var strBgRecoveryCode = pObjBgRecovery.BG_RECOVERY_CODE;
        var strBgHeader = pObjBgRecovery.HEADER;
        var objLogInfo = pReqObj.objLogInfo || {};
        var svc_log_folder_path = (pObjBgRecovery && pObjBgRecovery.SERVICE_LOG_FOLDER_PATH) || 'service_logs/' + 'Audit_Process/' + strBgHeader.routingkey + '/';
        var arrBgRecoveryInfo = [
            {
                BG_RECOVERY_CODE: 'BG-AUDIT-RECOVERY-CODE-0001',
                PURPOSE: 'In Audit Data producer Process, To UPDATE LOCK_ID Column to Null or Empty in HST_TRAN_DATA Table...',
                PROCESS: 'UPDATE',
                REASON: 'Due to DB Connection Error...',
                SERVICE_LOG_FOLDER_PATH: svc_log_folder_path,
                TABLE_NAME: 'HST_TRAN_DATA'
            }
            , {
                BG_RECOVERY_CODE: 'BG-AUDIT-RECOVERY-CODE-0002',
                PURPOSE: 'In Audit Data producer Process, To DELETE the Record in HST_TRAN_DATA Table...',
                PROCESS: 'DELETE',
                REASON: 'Due to DB Connection Error...',
                SERVICE_LOG_FOLDER_PATH: svc_log_folder_path,
                TABLE_NAME: 'HST_TRAN_DATA'
            }
            , {
                BG_RECOVERY_CODE: 'BG-AUDIT-RECOVERY-CODE-0003',
                PURPOSE: 'In Audit Data producer Process, To UPDATE the Record in HST_TRAN_DATA Table...',
                PROCESS: 'UPDATE',
                REASON: 'Due to DB Connection Error...',
                SERVICE_LOG_FOLDER_PATH: svc_log_folder_path,
                TABLE_NAME: 'HST_TRAN_DATA'
            }
            , {
                BG_RECOVERY_CODE: 'BG-AUDIT-RECOVERY-CODE-0004',
                PURPOSE: 'In Audit Data producer Process, To UPDATE the Record in HST_TRAN_DATA Table...',
                PROCESS: 'UPDATE',
                REASON: 'Due to DB Connection Error...',
                SERVICE_LOG_FOLDER_PATH: svc_log_folder_path,
                TABLE_NAME: 'HST_TRAN_DATA'
            }
        ];
        return arrBgRecoveryInfo[arrBgRecoveryInfo.map((ele) => { return ele.BG_RECOVERY_CODE }).indexOf(strBgRecoveryCode)];
    } catch (error) {
        printError(serviceName, objLogInfo, 'ERR-REF-230055', 'Catch Error in GetBgRecoveryFileInfo()...', error);
        return {};
    }
}

// Common Function To Write Recovery Log For Both API And NODE Services...
function CommonlyWriteRecoveryFile(pFileWriteInfo, pReqObj, commonRecoveryFileWriteCB) {
    /* pReqObj Should Contains Below
    - objLogInfo
  
    /* pFileWriteInfo Should Contains Below
    For Background Process
    - BG_RECOVERY_CODE
    - IS_BG_PROCESSS
      
    For API Process
    - API_RECOVERY_CODE
    - IS_API_PROCESS
    
    Optional Parameters are 
    - HEADER 
    - SERVICE_LOG_FOLDER_PATH
    - SERVICE_LOG_FILE_NAME
    - DB_UPDATE_DATA
    - DB_CONDITION_DATA,
    - commonRecoveryFileWriteCB
  
  
    Sample pFileWriteInfo
    [{
      BG_RECOVERY_CODE: 'BG-AUDIT-RECOVERY-CODE-0001',
      HEADER: pHeader,
      DB_UPDATE_DATA: {
          LOCK_ID: '',
      },
      DB_CONDITION_DATA: {
          LOCK_ID: lock_id,
          IS_PROCESSED: ''
      },
      IS_BG_PROCESSS: true,
      NODE_ERROR_OBJ : 'Node Error Message',
      STR_INFO : 'Your Message Will be here'
   }]
    */
    try {
        var objLogInfo = pReqObj.objLogInfo;
        if (!pFileWriteInfo || !pFileWriteInfo.length) {
            printError(serviceName, objLogInfo, 'ERR-REF-230049', 'Catch Error in commonRecoveryFileWrite()...', null);
            if (commonRecoveryFileWriteCB) {
                commonRecoveryFileWriteCB();
            }
        } else {
            var arrFileContent = [];
            var tempFolderPath = 'service_logs/Folder_Path_Not_Defined/';
            for (var a = 0; a < pFileWriteInfo.length; a++) {
                var objRecoveryInfo = (pFileWriteInfo[a].IS_API_PROCESS && GetApiRecoveryFileInfo(pFileWriteInfo[a], pReqObj)) || (pFileWriteInfo[a].IS_BG_PROCESSS && GetBgRecoveryFileInfo(pFileWriteInfo[a], pReqObj));
                var folderPath = (pFileWriteInfo[a] && pFileWriteInfo[a].SERVICE_LOG_FOLDER_PATH) || objRecoveryInfo.SERVICE_LOG_FOLDER_PATH || tempFolderPath;
                if (objRecoveryInfo.SERVICE_LOG_FOLDER_PATH) {
                    delete objRecoveryInfo.SERVICE_LOG_FOLDER_PATH;
                }
                if (pFileWriteInfo[a].DB_UPDATE_DATA) {
                    objRecoveryInfo.DB_UPDATE_DATA = pFileWriteInfo[a].DB_UPDATE_DATA;
                }
                if (pFileWriteInfo[a].DB_CONDITION_DATA) {
                    objRecoveryInfo.DB_CONDITION_DATA = pFileWriteInfo[a].DB_CONDITION_DATA;
                }
                if (pFileWriteInfo[a].NODE_ERROR_OBJ) {
                    objRecoveryInfo.NODE_ERROR_OBJ = pFileWriteInfo[a].NODE_ERROR_OBJ;
                }
                if (pFileWriteInfo[a].STR_INFO) {
                    objRecoveryInfo.MESSAGE = pFileWriteInfo[a].STR_INFO;
                }
                arrFileContent.push(objRecoveryInfo);
            }

            var fileContent = JSON.stringify(arrFileContent, null, '\t');
            if (pFileWriteInfo[0].HEADER) {
                pFileWriteInfo[0].HEADER.file_extension = (pFileWriteInfo[0] && pFileWriteInfo[0].FILE_EXTENSION) || '.json';
            }
            var fileName = (pFileWriteInfo[0] && pFileWriteInfo[0].SERVICE_LOG_FILE_NAME) || reqInstanceHelper.GetServiceFileName(pFileWriteInfo[0].HEADER);
            reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent);
            if (commonRecoveryFileWriteCB) {
                commonRecoveryFileWriteCB();
            }
        }
    } catch (error) {
        printError(serviceName, objLogInfo, 'ERR-REF-230046', 'Catch Error in commonRecoveryFileWrite()...', error);
        if (commonRecoveryFileWriteCB) {
            commonRecoveryFileWriteCB();
        }
    }
}

// Common Function To Executing Recovery File Content For Both API And NODE Services...
function CommonlyExecuteRecoveryFile(pReqObj, CommonlyExecuteRecoveryFileCB) {
    /* pReqObj Should Contains Below
    
    - Service_Log_Folder_Path
    - objLogInfo
    - header
    - destination_folder_path [Optional]
    */
    try {
        var objLogInfo = pReqObj.objLogInfo;
        var destination_folder_path = pReqObj.destination_folder_path;
        if (!pReqObj && !Object.keys(pReqObj).length) {
            svcfileExecutionResult.status = false;
            svcfileExecutionResult.errorObj = error;
            printError(serviceName, objLogInfo, 'ERR-REF-230048', 'There is no Valid Data for CommonlyExecuteRecoveryFile()...', null);
            return ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
        } else {
            reqInstanceHelper.CheckServiceLogFiles(pReqObj, objLogInfo, function (serviceRecoveryFiles) {
                printInfo(serviceName, 'Service Recovery File Count - ' + serviceRecoveryFiles.length, objLogInfo);
                if (serviceRecoveryFiles.length) {
                    var Service_Log_Folder_Path = pReqObj.Service_Log_Folder_Path;
                    reqAsync.forEachOfSeries(serviceRecoveryFiles, function (objErrorFile, index, errorFileCB) {
                        objErrorFile.file_path = Service_Log_Folder_Path + objErrorFile.file_name;
                        reqInstanceHelper.ReadingServiceLogFile(objErrorFile, objLogInfo, function (arrActualFileContent) {
                            var file_renaming = (objErrorFile.file_name).split('_');
                            var src_file_path = objErrorFile.file_path;
                            var destination_file_path = (pReqObj && pReqObj.destination_folder_path + 'PRC_' + file_renaming[1]) || Service_Log_Folder_Path + 'PRC_' + file_renaming[1];
                            if (typeof arrActualFileContent == 'boolean') {
                                if (arrActualFileContent) {
                                    RenameServiceLogFile(src_file_path, destination_file_path
                                        , function () {
                                            errorFileCB();
                                        });
                                } else {
                                    errorFileCB();
                                }
                            } else {
                                if (!arrActualFileContent.length) {
                                    errorFileCB();
                                } else {
                                    var needToRename = false;
                                    reqAsync.forEachOfSeries(arrActualFileContent, function (objActualFileContent, index, objActualFileContentCB) {
                                        var reqObj = {
                                            file_data: objActualFileContent, // Array
                                            objLogInfo,
                                            header: pReqObj.header
                                        };
                                        ExcuteServiceRecoveryContent(reqObj, function (serviceRecoveryResult) {
                                            if (serviceRecoveryResult.status) {
                                                needToRename = true;
                                            }
                                            objActualFileContentCB();
                                        });
                                    },
                                        function () {
                                            var reqObj = {
                                                src_file_path,
                                                destination_folder_path,
                                                objLogInfo
                                            };
                                            if (!needToRename) {
                                                errorFileCB();
                                            } else {
                                                reqInstanceHelper.RenameServiceLogFile(reqObj, destination_file_path
                                                    , function () {
                                                        errorFileCB();
                                                    });
                                            }
                                        });
                                }
                            }
                        });
                    },
                        function () {
                            CommonlyExecuteRecoveryFileCB();
                        });
                } else { // If There is no Error File For Process
                    CommonlyExecuteRecoveryFileCB();
                }
            });
        }
    } catch (error) {
        printError(serviceName, objLogInfo, 'ERR-REF-230047', 'Catch Error in CommonlyExecuteRecoveryFile()...', error);
        CommonlyExecuteRecoveryFileCB();
    }

}



function ExcuteServiceRecoveryContent(pReqObj, ExcuteServiceRecoveryContentCB) {
    /* pReqObj Should Contains Below
   
  - file_data [Data Type - Array]
  - objLogInfo
  - header
  */
    try {
        var svcfileExecutionResult = {};
        var objLogInfo = pReqObj.objLogInfo || {};
        if (!pReqObj && !Object.keys(pReqObj).length) {
            svcfileExecutionResult.status = false;
            svcfileExecutionResult.errorObj = error;
            printError(serviceName, objLogInfo, 'ERR-REF-230045', 'There is no Valid Data...', null);
            return ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
        } else {
            var actualFileContent = pReqObj.file_data;
            var table_name = actualFileContent.TABLE_NAME;
            var db_update_data = actualFileContent.DB_UPDATE_DATA;
            var db_condition_data = actualFileContent.DB_CONDITION_DATA;
            reqTranDBInstance.GetTranDBConn(pReqObj.header, false, function (tran_db_instance) {
                if (db_update_data) {
                    reqTranDBInstance.UpdateTranDB(tran_db_instance, table_name, db_update_data, db_condition_data, objLogInfo, function (result, error) {
                        if (error) {
                            svcfileExecutionResult.status = false;
                            svcfileExecutionResult.errorObj = error;
                            printError(serviceName, objLogInfo, 'ERR-REF-230044', 'Error in Updating Process...', error);
                            ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
                        } else {
                            svcfileExecutionResult.status = true;
                            svcfileExecutionResult.errorObj = '';
                            printInfo(serviceName, 'Update Process Successfully Completed...', objLogInfo);
                            ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
                        }
                    });
                } else {
                    reqTranDBInstance.DeleteTranDB(tran_db_instance, table_name, db_condition_data, objLogInfo, function (result, error) {
                        if (error) {
                            svcfileExecutionResult.status = false;
                            svcfileExecutionResult.errorObj = error;
                            printError(serviceName, objLogInfo, 'ERR-REF-230042', 'Error in Deleting Process...', error);
                            ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
                        } else {
                            svcfileExecutionResult.status = true;
                            svcfileExecutionResult.errorObj = '';
                            printInfo(serviceName, 'Delete Process Successfully Completed...', objLogInfo);
                            ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
                        }
                    });
                }
            });
        }
    } catch (error) {
        svcfileExecutionResult.status = false;
        svcfileExecutionResult.errorObj = error;
        printError(serviceName, objLogInfo, 'ERR-REF-230043', 'Catch Error in ExcuteServiceRecoveryContent()...', error);
        ExcuteServiceRecoveryContentCB(svcfileExecutionResult);
    }
}


function printError(pServiceName, pObjLogInfo, pErrorCode, pErrorMesg, pNodeError) {
    reqInstanceHelper.PrintError(pServiceName, pObjLogInfo, pErrorCode, pErrorMesg, pNodeError);
}


function printInfo(pServiceName, pStrInfo, pObjLogInfo) {
    reqInstanceHelper.PrintInfo(pServiceName, pStrInfo, pObjLogInfo);
}



function HandleConsumerFailures(params, HandleConsumerFailuresCB) {
    try {
        /*  should contains
        - objLogInfo
          - HST_DATA
          - ERROR_OBJ
          - ERROR_CODE
          - ERROR_MSG
          - TOPIC_OFFSET
          - TOPIC_PARTITION
          - FAILURE_TOPIC_NAME
          - SERVICE_LOG_PATH
          - TRAN_DB_INSTANCE
          - TABLE_NAME
           */
        var objLogInfo = params.objLogInfo;
        var tran_db_instance = params.TRAN_DB_INSTANCE;
        var tableName = params.TABLE_NAME;
        var serviceLogPath = params.SERVICE_LOG_PATH;
        var eligibleData = params.HST_DATA || {};
        var headers = params.HEADERS || {};
        var consumerName = '';

        var comments = {
            ERROR_OBJ: params.ERROR_OBJ,
            ERROR_CODE: params.ERROR_CODE,
            ERROR_MSG: params.ERROR_MSG,
            TOPIC_OFFSET: params.TOPIC_OFFSET,
            TOPIC_PARTITION: params.TOPIC_PARTITION,
        };
        eligibleData.comments = JSON.stringify(comments);
        var topicName = params.FAILURE_TOPIC_NAME;
        // Producing into Kafka Topia
        reqProducer.ProduceMessage(topicName, eligibleData, null, function () {
            printInfo(serviceName, 'Creating Recovery Log Process Started for a Path - ' + serviceLogPath, objLogInfo);
            // Creating Recovery Log File
            var GetServiceFileNameReqObj = {
                file_extension: '.json'
            }
            var fileName = reqInstanceHelper.GetServiceFileName(GetServiceFileNameReqObj);
            reqInstanceHelper.WriteServiceLog(serviceLogPath, fileName, JSON.stringify(eligibleData, null, '\t'), function (result) {
                if (!result.status) {
                    printError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0001', 'Failed to Create Recovery Log File in the path - ' + serviceLogPath, result.error);
                } else {
                    printInfo(serviceName, 'Recovery Log File created in the path - ' + serviceLogPath, objLogInfo);
                }

                // Inserting Eligible Data into TRAN DB
                printInfo(serviceName, 'Insert Process Started for a Table - ' + tableName, objLogInfo);
                if (tableName == 'HST_TRAN_DATA') {
                    consumerName = 'TRAN_VERSION_DETAIL_CONSUMER';
                    if ('id' in eligibleData) {
                        delete eligibleData.id;
                    }
                } else if (tableName == 'HST_FX_TABLE_DATA') {
                    consumerName = 'FX_TRAN_CONSUMER';
                    if ('hftd_id' in eligibleData) {
                        delete eligibleData.hftd_id;
                    }
                } else if (tableName == 'HST_TRN_ATTACHMENTS') {
                    consumerName = 'ATTACHMENT_CONSUMER';
                    if ('hta_id' in eligibleData) {
                        delete eligibleData.hta_id;
                    }
                }
                /*  if ('created_by' in eligibleData) {
                     eligibleData.created_by = consumerName;
                 }
                 if ('created_date' in eligibleData) {
                     eligibleData.created_date = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo);
                 } */
                if ('is_processed' in eligibleData) {
                    eligibleData.is_processed = 'Y';
                }
                if ('process_count' in eligibleData) {
                    eligibleData.process_count = 2;
                }

                if ('lock_id' in eligibleData) {
                    delete eligibleData.lock_id;
                }
                if ('modified_date' in eligibleData) {
                    delete eligibleData.modified_date;
                }
                reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, tableName, [eligibleData], objLogInfo, function (result, error) {
                    if (error) {
                        printError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0002', 'Error While Inserting Data into Table - ' + tableName, error);
                        printInfo(serviceName, 'Error While Inserting Data into Table - ' + tableName, objLogInfo);
                        HandleConsumerFailuresCB(error, null);
                    } else {
                        printInfo(serviceName, 'Successfully Inserted Data into Table - ' + tableName, objLogInfo);
                        HandleConsumerFailuresCB(null, 'SUCCESS');
                    }
                })
            });
        });

    } catch (error) {
        printError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0003', 'Catch Error in HandleConsumerFailuresCB()', error);
        HandleConsumerFailuresCB(error, null);
    }
}

// Handling Producer failures [DB Delete/Update Process only and it will be called in app.js]
function HandleProducerFailures(params, objLogInfo, HandleProducerFailuresCB) {
    try {
        var serviceLogPath = reqInstanceHelper.GetServiceInfo(process.title, '').service_folder_path;
        var recoveryLogPath = serviceLogPath + 'recovery/to_be_processed/';
        var processedRecoveryLogPath = serviceLogPath + 'recovery/processed/';
        var interval = 20 * 1000; // 20 seconds
        var ProcessRecoveryLogFilesObj = { RECOVERY_LOG_PATH: recoveryLogPath, PROCESSED_RECOVERY_LOG_PATH: processedRecoveryLogPath };
        // ProcessRecoveryLogFiles(ProcessRecoveryLogFilesObj, objLogInfo, function () { }); // For Development
        setInterval(function () {
            ProcessRecoveryLogFiles(ProcessRecoveryLogFilesObj, objLogInfo, function () { });
        }, interval);
    } catch (error) {

    }
}


function ProcessRecoveryLogFiles(params, objLogInfo, ProcessRecoveryLogFilesCB) {
    try {
        var CheckServiceLogFilesObj = {};
        CheckServiceLogFilesObj.Service_Log_Folder_Path = params.RECOVERY_LOG_PATH;
        var processedServiceLogFolder = params.PROCESSED_RECOVERY_LOG_PATH;
        reqInstanceHelper.CheckServiceLogFiles(CheckServiceLogFilesObj, objLogInfo, function (errorFiles) {
            if (errorFiles.length) {
                reqInstanceHelper.PrintInfo(serviceName, 'Recovery Files Count - ' + errorFiles.length, objLogInfo);
                // Checking Whether Recovery File Process is already in progress by using Redis Setnx Method
                var CheckRecoveryProcessInProgressReqObj = {
                    REDIS_DB_INDEX: 8
                    , REDIS_KEY_NAME: process.title.toUpperCase() + '_RECOVERY_AGENT'
                    , REDIS_KEY_TTL: 600 // 10 minutes in seconds
                }
                CheckRecoveryProcessInProgress(CheckRecoveryProcessInProgressReqObj, objLogInfo, function (error, result) {
                    // result - Recover Process - if IN_PROGRESS, then true else false
                    if (error || result) { // Not allowed to Process the Recovery Log Files
                        ProcessRecoveryLogFilesCB();
                    } else {
                        reqAsync.forEachOfSeries(errorFiles, function (objErrorFile, index, errorFileCB) {
                            objErrorFile.file_path = params.RECOVERY_LOG_PATH + objErrorFile.file_name;
                            reqInstanceHelper.ReadingServiceLogFile(objErrorFile, objLogInfo, function (actualFileContent) {
                                var file_renaming = (objErrorFile.file_name).split('_');
                                var Table_Name = null;
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
                                        reqAsync.waterfall([function (GET_TRANDB_CONNECTIONCB) {
                                            var errMsg = '';
                                            var routingkey = actualFileContent.ROUTINGKEY || null;
                                            if (!routingkey) {
                                                return GET_TRANDB_CONNECTIONCB('No routingkey');
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Getting trandb connection', objLogInfo);
                                                reqTranDBInstance.GetTranDBConn({ routingkey: routingkey }, false, function (tran_db_instance) {
                                                    if (!tran_db_instance) {
                                                        errMsg = 'Error while getting trandb connection';
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0013', errMsg, '');
                                                        return GET_TRANDB_CONNECTIONCB(errMsg);
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully got db connection', objLogInfo);
                                                        return GET_TRANDB_CONNECTIONCB(null, tran_db_instance);
                                                    }
                                                });
                                            }
                                        }
                                            , function (tran_db_instance, DB_UPDATE_PROCESSCB) {
                                                var ACTION = actualFileContent.ACTION || null;
                                                if (!ACTION || ACTION != 'DB_UPDATE') {
                                                    return DB_UPDATE_PROCESSCB(null, tran_db_instance);
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'DB update process started', objLogInfo);
                                                    var condObj = actualFileContent.CONDITION_OBJ;
                                                    var updateObj = actualFileContent.UPDATE_OBJ;
                                                    reqTranDBInstance.UpdateTranDBWithAudit(tran_db_instance, actualFileContent.TABLE_NAME, updateObj, condObj, objLogInfo, function (result, error) {
                                                        if (error) {
                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0010', 'Error while performing db update operation', error);
                                                            return DB_UPDATE_PROCESSCB(error);
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Successfully updated', objLogInfo);
                                                            reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1])
                                                                , function () {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'File Renamed Successfully', objLogInfo);
                                                                    return DB_UPDATE_PROCESSCB(null, tran_db_instance);
                                                                });
                                                        }
                                                    });
                                                }
                                            }
                                            , function (tran_db_instance, DB_DELETE_PROCESSCB) {
                                                var ACTION = actualFileContent.ACTION || null;
                                                Table_Name = actualFileContent.TABLE_NAME || null;
                                                if (!ACTION || ACTION != 'DB_DELETE') {
                                                    return DB_DELETE_PROCESSCB();
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'DB delete process started', objLogInfo);
                                                    var condObj = actualFileContent.CONDITION_OBJ;
                                                    reqTranDBInstance.DeleteTranDB(tran_db_instance, Table_Name, condObj, objLogInfo, function (result, error) {
                                                        if (error) {
                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0011', 'Error while deleting a record', error);
                                                            return DB_DELETE_PROCESSCB(error);
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Successfully deleted', objLogInfo);
                                                            reqInstanceHelper.RenameServiceLogFile(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1])
                                                                , function () {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'File Renamed Successfully', objLogInfo);
                                                                    return DB_DELETE_PROCESSCB();
                                                                });
                                                        }
                                                    });
                                                }
                                            }
                                        ]
                                            , function (err, results) {
                                                errorFileCB();
                                            });
                                    }
                                });
                            });
                        },
                            function () {
                                var redisKey = CheckRecoveryProcessInProgressReqObj.REDIS_KEY_NAME;
                                // After Processing the Recovery Log Files, Deleting the  Redis key from Redis DB3
                                reqInstanceHelper.PrintInfo(serviceName, 'Recovery Log Files Processed Successfully and Going to Delete the Redis Key From Redis', objLogInfo);
                                reqRedisInstance.GetRedisConnectionwithIndex(CheckRecoveryProcessInProgressReqObj.REDIS_DB_INDEX, function (error, redis_instance) {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0012', 'Error While Getting Redis Connection with Index - ' + CheckRecoveryProcessInProgressReqObj.REDIS_DB_INDEX, error);
                                        ProcessRecoveryLogFilesCB();
                                    }
                                    else {
                                        // Deleting the Redis key
                                        redis_instance.del(redisKey, function (error, result) {
                                            if (result) {
                                                reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Redis Key is Deleted from the Redis...', objLogInfo);
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Error While Deleting Redis Key - ' + error, objLogInfo);
                                            }
                                            ProcessRecoveryLogFilesCB();
                                        });
                                    }
                                });
                            });
                    }
                });
            } else { // If There is no Error File For Process
                ProcessRecoveryLogFilesCB();
            }
        });
    } catch (error) {
        ProcessRecoveryLogFilesCB();
    }
}


// Checking Whether Recovery File Process is already in progress by using Redis Setnx Method
function CheckRecoveryProcessInProgress(params, objLogInfo, CheckRecoveryProcessInProgressCB) {
    try {
        /*Should Contains
         - REDIS_DB_INDEX
         - REDIS_KEY_NAME
         - REDIS_KEY_TTL
        */
        reqInstanceHelper.PrintInfo(serviceName, 'Checking Whether the Recovery Process already in Progress or Not in Reids', objLogInfo);
        reqRedisInstance.GetRedisConnectionwithIndex(params.REDIS_DB_INDEX, function (error, redis_instance) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0004', 'Error While Getting Redis Connection with Index - ' + params.REDIS_DB_INDEX, error);
                CheckRecoveryProcessInProgressCB(error, null) // Skipping the Recovery File Process Due to the Redis DB3 Connection Error
            }
            else {
                var dateFormatString = 'DD-MMM-YYYY hh:mm:ss A';
                var redisKeyName = params.REDIS_KEY_NAME;
                var redisKeyValue = {};
                var redisKeyTTL = params.REDIS_KEY_TTL;
                redisKeyValue.PROCESS = redisKeyName;
                redisKeyValue.DATE_AND_TIME = reqDateFormatter.ConvertDate(new Date(), '', '', dateFormatString);
                redis_instance.set(redisKeyName, JSON.stringify(redisKeyValue), 'NX', 'EX', redisKeyTTL, function (error, result) {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0005', 'Error While Using Redis Setnx Method with Index - ' + params.REDIS_DB_INDEX, error);
                        CheckRecoveryProcessInProgressCB(error, null) // Skipping the Recovery File Process Due to the Redis Setnx Error
                    }
                    else if (result) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Starting Recovery File Process', objLogInfo);
                        CheckRecoveryProcessInProgressCB(null, false) // Starting the Recovery Log Process
                    } else {

                        // Already the Recovery Log Process in Progress Case
                        reqInstanceHelper.PrintInfo(serviceName, 'Recovery File Process is already in Progress', objLogInfo);
                        // If the Redis Key is existing for long time then need to clear from the Redis
                        redis_instance.get(redisKeyName, function (error, downloadRecoveryProcessKeyValue) {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0006', 'Error While Getting key Details  from  Redis Get Method with Index - ' + params.REDIS_DB_INDEX, error);
                                CheckRecoveryProcessInProgressCB(error, true);
                            } else {
                                if (downloadRecoveryProcessKeyValue) {
                                    try {
                                        downloadRecoveryProcessKeyValue = JSON.parse(downloadRecoveryProcessKeyValue);
                                        var startTime = downloadRecoveryProcessKeyValue.DATE_AND_TIME;
                                        var calculatedTime = reqMoment(startTime, dateFormatString).add(redisKeyTTL, 'seconds').format(dateFormatString);
                                        var currentTime = reqDateFormatter.ConvertDate(new Date(), '', '', dateFormatString);
                                        reqInstanceHelper.PrintInfo(serviceName, 'Time Difference - ' + (new Date(currentTime).getTime() - new Date(calculatedTime).getTime()), objLogInfo);
                                        if (new Date(currentTime).getTime() > new Date(calculatedTime).getTime()) {
                                            // Need to Delete the Redis Key
                                            redis_instance.del(redisKeyName, function (error, result) {
                                                if (result) {
                                                    reqInstanceHelper.PrintInfo(serviceName, redisKeyName + ' is Deleted from the Redis...', objLogInfo);
                                                } else {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0007', 'Error While Deleting Redis Key', error);
                                                }
                                                CheckRecoveryProcessInProgressCB(null, true);
                                            });
                                        } else {
                                            CheckRecoveryProcessInProgressCB(null, true);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0008', 'Catch Error While Verifying the Redis Key Timing', error);
                                        CheckRecoveryProcessInProgressCB(null, true);
                                    }
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Redis Key - ' + redisKeyName + ' is not existed', objLogInfo);
                                    CheckRecoveryProcessInProgressCB(null, true);
                                }
                            }
                        });
                    }
                });
            }
        });

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_RECOVERYLOG_0009', 'Catch Error in CheckRecoveryProcessInProgress()', error);
        CheckRecoveryProcessInProgressCB(error, null) // Skipping the Recovery File Process Due to the Catch Error
    }
}

module.exports = {
    GetApiRecoveryFileInfo: GetApiRecoveryFileInfo,
    GetBgRecoveryFileInfo: GetBgRecoveryFileInfo,
    CommonlyWriteRecoveryFile: CommonlyWriteRecoveryFile,
    CommonlyExecuteRecoveryFile: CommonlyExecuteRecoveryFile,
    HandleConsumerFailures: HandleConsumerFailures,
    HandleProducerFailures: HandleProducerFailures
};
/********* End of File *************/