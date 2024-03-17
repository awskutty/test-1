/**
 * @Author          : RABEESH V,
 * @Api_Name        : /ExgDownloadAutomation,
 * @Description     : Import file from specified path
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqRecoveryLog = require('../../../../torus-references/log/recovery/RecoveryLog');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var serviceName = "ExgDownloadAutomation";

router.post('/ExgDownloadAutomation', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'EXG FILE DOWNLOAD AUTOMATION Begin', objLogInfo);
        objLogInfo.HANDLER_CODE = 'EXG_FILE_DOWNLOAD_AUTOMATION';
        objLogInfo.PROCESS = 'EXG_FILE_DOWNLOAD_AUTOMATION';
        objLogInfo.ACTION_DESC = 'ExgDownloadAutomation';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var reqObj = appRequest.body.PARAMS;
            reqObj.TENANT_ID = objSessionInfo.TENANT_ID;
            reqObj.CLIENT_ID = objSessionInfo.CLIENT_ID;
            reqObj.APP_ID = objSessionInfo.APP_ID;
            reqObj.HEADERS = objSessionInfo.mHeaders;
            var processRecoveryFileReqObj = {};
            var serviceLogFolderPath = '../../../torus-services/api/exchange/service_logs/download_Without_Update/' + reqObj.FFG_CODE + '/';
            processRecoveryFileReqObj.objLogInfo = objLogInfo;
            processRecoveryFileReqObj.header = mHeaders;
            processRecoveryFileReqObj.serviceLogFolderPath = serviceLogFolderPath;
            var hstMemoryTTL = reqObj.FILE_MEM_TTL_IN_MS || 1800000; //Milli Seconds...
            ClearHstMemory(hstMemoryTTL);
            ProcessRecoveryFile(processRecoveryFileReqObj, function (params) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                        reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                            // To Get FFG Json, Storage Path, FTP Configuration Details
                            reqObj.dep_cas_instance = dep_cas_instance;
                            reqObj.clt_cas_instance = clt_cas_instance;
                            reqObj.tran_db_instance = tran_db_instance;
                            reqObj.objLogInfo = objLogInfo;
                            reqObj.serviceLogFolderPath = serviceLogFolderPath;
                            reqObj.recoveryInfo = []; //Pushing All the Recovery File Data and File Will be Created While Sending Response To The Client....
                            reqObj.hstMemoryFileNames = []; // Clearing HST Memory Whille Sending Response To The Client...
                            reqExchangeHelper.PrepareExgFileDownloadParams(reqObj, function (preparedParams) {
                                console.log(preparedParams, "<-------------preparedParams------------>");
                                if (preparedParams.status == 'FAILURE') {
                                    reqRecoveryLog.CommonlyWriteRecoveryFile(reqObj.recoveryInfo, { objLogInfo });
                                    SendResponse(reqObj.hstMemoryFileNames, serviceName, appResponse, null, objLogInfo, '', preparedParams.info, preparedParams.error, "FAILURE", "FAILURE");
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Required Params For File Download is Prepared...', objLogInfo);
                                    reqInstanceHelper.PrintInfo(serviceName, 'File Download Process Begins...', objLogInfo);
                                    preparedParams.data.objLogInfo = objLogInfo;
                                    preparedParams.data.clientParams = reqObj;
                                    preparedParams.data.tran_db_instance = tran_db_instance;
                                    preparedParams.data.dep_cas_instance = dep_cas_instance;
                                    preparedParams.data.clt_cas_instance = clt_cas_instance;
                                    preparedParams.data.sessionInfo = objSessionInfo;
                                    preparedParams.data.headers = mHeaders;
                                    preparedParams.data.fileDownloadOnly = true;
                                    preparedParams.data.FromDownload = true;

                                    reqExchangeHelper.ExgFileDownloadWithRequiredParams(preparedParams.data, function (fileDownloadResp) {
                                        if (fileDownloadResp.status == 'FAILURE') {
                                            SendResponse(reqObj.hstMemoryFileNames, serviceName, appResponse, null, objLogInfo, '', fileDownloadResp.info, fileDownloadResp.error, 'FAILURE', 'FAILURE');
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'File Download Process Completed Successfully...', objLogInfo);
                                            SendResponse(reqObj.hstMemoryFileNames, serviceName, appResponse, 'File Downloaded Successfully...', objLogInfo, '', '', '', '', '');
                                        }
                                    });
                                }
                            });
                        });
                    });
                });
            });
        } catch (error) {
            SendResponse(reqObj.hstMemoryFileNames, serviceName, appResponse, null, objLogInfo, '', 'Catch Error in File Download Process...', error, 'FAILURE', '');
        }
    });


    function RemoveFilesFromHstMemory(hstMemoryFileNames, objLogInfo) {
        try {
            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count Before [size()] - ' + global.exgFileDownloadOnly.size(), objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count Before [keys()] - ' + global.exgFileDownloadOnly.keys(), objLogInfo);
            for (var file of hstMemoryFileNames) {
                if (global.exgFileDownloadOnly.get(file)) {
                    global.exgFileDownloadOnly.remove(file); // To make the file eligible for next thread
                }
            }
            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count Before [size()] - ' + global.exgFileDownloadOnly.size(), objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count Before [keys()] - ' + global.exgFileDownloadOnly.keys(), objLogInfo);
        } catch (error) {
            console.log(error, 'Catch Error in RemoveFilesFromHstMemory()');
        }
    }


    function SendResponse(hstMemoryFileNames, pServiceName, pAppResponse, pRespData, pLogInfo, pErrorCode, pErrorMesg, pNodeErrorObj, pProcessStatus, pInformation) {
        try {
            RemoveFilesFromHstMemory(hstMemoryFileNames, pLogInfo);
            return reqInstanceHelper.SendResponse(pServiceName, pAppResponse, pRespData, pLogInfo, pErrorCode, pErrorMesg, pNodeErrorObj, pProcessStatus, pInformation);
        } catch (error) {
            console.log(error, 'Catch Error in SendResponse()');
            return reqInstanceHelper.SendResponse(pServiceName, pAppResponse, pRespData, pLogInfo, pErrorCode, pErrorMesg, pNodeErrorObj, pProcessStatus, pInformation);
        }
    }


    function ClearHstMemory(pFILE_MEM_TTL_IN_MS) { // To Clear Old Items From Hashtable
        try {
            var globalHstFileNames = global.exgFileDownloadOnly.values();
            if (globalHstFileNames.length) {
                for (var a = 0; a < globalHstFileNames.length; a++) {
                    var key_value = global.exgFileDownloadOnly.get(globalHstFileNames[a].file_name);
                    if (key_value && Date.now() - key_value.initiated_time > pFILE_MEM_TTL_IN_MS) {
                        global.exgFileDownloadOnly.remove(globalHstFileNames[a].file_name);
                    }
                }
            }
        } catch (error) {
            console.log(error, 'Catch Error in ClearHstMemory()');
        }
    }

    function ProcessRecoveryFile(ProcessRecoveryFileObj, ProcessRecoveryFileObjCB) {
        /* ProcessRecoveryFileObj Should Contains Below

        - recoveryProcess
        - objLogInfo
        - header
        - serviceLogFolderPath
        */
        try {
            if (!global.Exg_File_Download_Only.recoveryProcess) {
                global.Exg_File_Download_Only.recoveryProcess = true;
                var serviceLogFolderPath = ProcessRecoveryFileObj.serviceLogFolderPath;
                var reqObj = {
                    Service_Log_Folder_Path: serviceLogFolderPath,
                    destination_folder_path: serviceLogFolderPath + 'processed/',
                    objLogInfo: ProcessRecoveryFileObj.objLogInfo,
                    header: ProcessRecoveryFileObj.header
                };
                reqRecoveryLog.CommonlyExecuteRecoveryFile(reqObj, function (params) {
                    global.Exg_File_Download_Only.recoveryProcess = false;
                    ProcessRecoveryFileObjCB();
                });
            } else {
                ProcessRecoveryFileObjCB();
            }
        } catch (error) {
            ProcessRecoveryFileObjCB();
        }
    }
});


module.exports = router;