/**
 * @Description     : Helper file for exchange import/export
 * @Last_Error_Code : ERR-EXG-120084
 * @HardCoded_Path_For_Develpment : storagePath = "D:\\exchange\\storage\\",read_path = "D:\\exchange\\upload\\"
 * 
 */

// Require dependencies
var dir_path = '../../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqSvchelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqRedisInstance = require('../../../../../torus-references/instance/RedisInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var commonFile = require('../util/Common.js');
var async = require(modPath + 'async');
var reqDBInstance = require(refPath + 'instance/DBInstance');
var request = require(modPath + 'request');
var momentInstance = require(modPath + 'moment');
var minimatch = require(modPath + 'minimatch');
var reqExchangeEngine = require('./ExchangeEngine');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var ftpHelper = require('../helper/FTPHelper');
var reqAuditLog = require(refPath + 'log/audit/AuditLog');
var fs = require('fs');
var path = require('path');
const { json } = require('body-parser');
var serviceName = "Exchange Helper";
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}

function ExgFileDownloadWithRequiredParams(pFileDownldReqObj, exgFileDownloadWithRequiredParamsCB) {
    try {
        /* pFileDownldReqObj Should Contains Belowed params
           - fileDownloadOnly - FTP File Download and Update File Status as Downloaded Only
           - FromDownload - if True Insert the FTP Read path in EX_HEADER FILE_PATH column && else - FTP Write Path
           - clientParams
           - ffgJson
           - prct_id
           - exStoragePathResult
           - ftpTypeStoragePathObj
           - StoragePathType
           - exGatewaysResult 
           - objLogInfo 
           - ex_service_log_folder_path
           - tran_db_instance 
           - clt_cas_instance 
           - dep_cas_instance 
           - patternMatchedFiles 
           - prct_id  [Will Come While Calling From Screen]
           */
        reqExchangeEngine = require('./ExchangeEngine');
        var fileDownloadStatus = {
            status: '',
            error: '',
            info: '',
            error_code: '',
            data: {}
        };
        var clientParams = pFileDownldReqObj.clientParams;
        var objLogInfo = pFileDownldReqObj.objLogInfo;
        var ffgJson = pFileDownldReqObj.ffgJson;
        var exStoragePath = pFileDownldReqObj.exStoragePathResult;
        var ftpTypeStoragePathObj = pFileDownldReqObj.ftpTypeStoragePathObj;
        var StoragePathType = pFileDownldReqObj.StoragePathType;
        var exGateways = pFileDownldReqObj.exGatewaysResult;
        var patternMatchedFiles = pFileDownldReqObj.patternMatchedFiles;
        if (!patternMatchedFiles.length) {
            reqInstanceHelper.PrintInfo(serviceName, 'There is No Patter Matched File List For Download Process...', objLogInfo);
            fileDownloadStatus.status = 'FAILURE';
            fileDownloadStatus.info = 'There is No Patter Matched File List For Download Process...';
            exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
        } else {
            if (exGateways.gateway_type == "FTP") {
                // exStoragePath = "D:\\exchange\\storage\\";
                var newFileDownloadPathPrefix = 'Download//' + clientParams.TENANT_ID + '//' + clientParams.APP_ID + '//' + clientParams.FFG_CODE;
                reqInstanceHelper.PrintInfo(serviceName, 'Storage Path From DB - ' + exStoragePath, objLogInfo);
                exStoragePath = exStoragePath + newFileDownloadPathPrefix;
                reqInstanceHelper.PrintInfo(serviceName, 'Creating Folder in Local If not Exist - ' + exStoragePath, objLogInfo);
                var DynamicFolderCreationReqObj = {};
                DynamicFolderCreationReqObj.destination_folder_path = exStoragePath;
                DynamicFolderCreationReqObj.objLogInfo = objLogInfo;
                reqInstanceHelper.DynamicFolderCreation(DynamicFolderCreationReqObj);
                exStoragePath = exStoragePath + '//';
                reqInstanceHelper.PrintInfo(serviceName, 'After Adding TENANT_ID,APP_ID,FFG_CODE to the Storage Path - ' + exStoragePath, objLogInfo);

                var ftpConfig = JSON.parse(exGateways.gateway_config);
                ftpConfig.read_path = exGateways.read_path;
                ftpConfig.FOLDERPATH = exGateways.read_path;
                ftpConfig.storagePath = exStoragePath;
                ftpConfig.log_info = objLogInfo;
                ftpConfig.FFG_CODE = clientParams.FFG_CODE;
                if (StoragePathType && StoragePathType == 'FTP' && ftpTypeStoragePathObj && Object.keys(ftpTypeStoragePathObj).length) { // To check whether Setup json has any data or not..
                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - FTP Storage ', objLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'FTP Info For Database Storage Path - ' + JSON.stringify(ftpTypeStoragePathObj), objLogInfo);
                    ftpConfig.ftpTypeStoragePathInfo = ftpTypeStoragePathObj;
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - Local Storage ', objLogInfo);
                    ftpTypeStoragePathObj = {};
                }
                ftpHelper.downloadFromFTP(patternMatchedFiles, ftpConfig, '', function (response) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Download from ftp ' + JSON.stringify(response), objLogInfo);
                    if (response.STATUS == "SUCCESS") {
                        var fileStatusFromFtp = response.SUCCESS_DATA;
                        patternMatchedFiles = fileStatusFromFtp['SuccessFiles'];
                        var failedFilesList = fileStatusFromFtp['FailedFiles'];
                        //  Need to UpdatexFile Info Pending
                        var exgFileInfoReqObj = {};
                        exgFileInfoReqObj.EXFFG_CODE = clientParams.FFG_CODE;
                        exgFileInfoReqObj.write_path = exGateways.write_path;
                        exgFileInfoReqObj.objLogInfo = objLogInfo;
                        exgFileInfoReqObj.FILES = patternMatchedFiles;
                        exgFileInfoReqObj.EXFF_ID = 0;
                        exgFileInfoReqObj.prct_id = pFileDownldReqObj.prct_id;
                        exgFileInfoReqObj.SERVICE_LOG_FOLDER_PATH = '../../../torus-services/api/exchange/service_logs/download/' + clientParams.FFG_CODE + '/';
                        exgFileInfoReqObj.gateway_config = exGateways;
                        exgFileInfoReqObj.tran_db_instance = pFileDownldReqObj.tran_db_instance;
                        exgFileInfoReqObj.session = pFileDownldReqObj.sessionInfo;
                        exgFileInfoReqObj.objLogInfo = objLogInfo;
                        exgFileInfoReqObj.DST_ID = clientParams.Des_sys;
                        exgFileInfoReqObj.EXG_CODE = clientParams.GW_CODE;
                        exgFileInfoReqObj.fileDownloadOnly = pFileDownldReqObj.fileDownloadOnly || false;
                        exgFileInfoReqObj.FromDownload = pFileDownldReqObj.FromDownload || false;
                        var successFileNames = [];
                        exgFileInfoReqObj.headers = pFileDownldReqObj.headers;
                        for (var a = 0; a < patternMatchedFiles.length; a++) {
                            patternMatchedFiles[a].STATUS = 'DOWNLOADED';
                            var fileName = patternMatchedFiles[a].name;
                            if (fileName) {
                                successFileNames.push(fileName);
                            }
                        }
                        reqInstanceHelper.PrintInfo(serviceName, 'Updating Exchange File Informations...', objLogInfo);
                        updateExchangeFileInfo(exgFileInfoReqObj, function (exgFileInfoResp) {
                            if (exgFileInfoResp.STATUS === "SUCCESS") {
                                var callCodeSnippetParams = {};
                                callCodeSnippetParams.EXG_PROCESS_NAME = 'DOWNLOAD';
                                callCodeSnippetParams.FFG_JSON = ffgJson;
                                var codeSnippetInputParams = {};
                                codeSnippetInputParams.SUCCESS_FILE_LIST = successFileNames;
                                codeSnippetInputParams.objLogInfo = objLogInfo;
                                codeSnippetInputParams.FAILED_FILE_LIST = failedFilesList;
                                codeSnippetInputParams.PRCT_ID = pFileDownldReqObj.prct_id;
                                codeSnippetInputParams.TRAN_DB_INSTANCE = pFileDownldReqObj.tran_db_instance;
                                codeSnippetInputParams.CLT_CAS_INSTANCE = pFileDownldReqObj.clt_cas_instance;
                                codeSnippetInputParams.DEP_CAS_INSTANCE = pFileDownldReqObj.dep_cas_instance;
                                codeSnippetInputParams.SESSION_INFO = pFileDownldReqObj.sessionInfo;
                                callCodeSnippetParams.CODE_SNIPPET_INPUT_PARAMS = codeSnippetInputParams;
                                reqExchangeEngine.CallCodeSnippetByFFGCode(callCodeSnippetParams, function (codeSnippetResult, error) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated Exchange File Informations...', objLogInfo);
                                    if ((exGateways.read_path).lastIndexOf('\\')) {
                                        exGateways.read_path = (exGateways.read_path).substring(0, (exGateways.read_path).lastIndexOf('\\'));
                                    };
                                    var filesToRename = [];
                                    var moveFrom = exGateways.read_path + '\\';
                                    var moveTo = exGateways.read_path + "_processed" + "\\";
                                    for (var file of successFileNames) {
                                        var obj = {
                                            "file_name": file,
                                            "fromPath": moveFrom,
                                            "toPath": moveTo
                                        };
                                        filesToRename.push(obj);
                                    }
                                    // For Moving Donwloaded Files to read_path+'_processed' Path
                                    ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo)
                                        .then((responseChangeFiles) => {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Moving FTP Files Result - ' + JSON.stringify(responseChangeFiles), objLogInfo);
                                            fileDownloadStatus.status = 'SUCESS';
                                            fileDownloadStatus.info = 'FTP Files Moiving Process Completed...';
                                            exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
                                        })
                                        .catch((error) => {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Error While Moving FTP Files... Error - ' + error, objLogInfo);
                                            fileDownloadStatus.status = 'FAILURE';
                                            fileDownloadStatus.info = 'FTP Files Moiving Process Failed...';
                                            exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
                                        });
                                });
                            }
                            else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Failed To Update Exchange File Informations...', objLogInfo);
                                fileDownloadStatus.status = 'FAILURE';
                                fileDownloadStatus.error = exgFileInfoResp.ERROR_OBJECT;
                                fileDownloadStatus.info = exgFileInfoResp.ERROR_MESSAGE;
                                fileDownloadStatus.error_code = exgFileInfoResp.ERROR_CODE;
                                exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
                            }
                        });
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'FTP Download Process Failed...', objLogInfo);
                        fileDownloadStatus.status = 'FAILURE';
                        fileDownloadStatus.info = 'FTP Download Process Failed...';
                        exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
                    }
                });
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'Gateway Setup Type is Not FTP...', objLogInfo);
                fileDownloadStatus.status = 'FAILURE';
                fileDownloadStatus.info = 'Gateway Setup Type is Not FTP...';
                exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Catch Error in ExgFileDownloadWithRequiredParams()...  Error - ' + error, objLogInfo);
        fileDownloadStatus.status = 'FAILURE';
        fileDownloadStatus.error = error;
        fileDownloadStatus.info = 'Catch Error in ExgFileDownloadWithRequiredParams()...';
        exgFileDownloadWithRequiredParamsCB(fileDownloadStatus);
    }
}


function PrepareExgFileDownloadParams(pPrepareFileDownldReqObj, prepareExgFileDownloadParamsCB) {
    try {
        /* pPrepareFileDownldReqObj Should Contains Belowed params
           - GW_CODE
           - FFG_CODE
           - CLIENT_ID
           - TENANT_ID
           - APP_ID 
           - HEADERS
           - EX_SERVICE_LOG_FOLDER_PATH
           - objLogInfo 
           - dep_cas_instance 
           - clt_cas_instance 
           - tran_db_instance 
           - serviceLogFolderPath 
           - recoveryInfo 
           - hstMemoryFileNames 

           */

        var prepareParamStatus = {
            status: '',
            error: '',
            info: '',
            data: {}
        };
        var allResult = {};
        var fileCountLimit = pPrepareFileDownldReqObj.FILE_COUNT_LIMIT;
        var serviceLogFolderPath = pPrepareFileDownldReqObj.serviceLogFolderPath;
        var hstMemoryFileNames = pPrepareFileDownldReqObj.hstMemoryFileNames;
        var recoveryInfo = pPrepareFileDownldReqObj.recoveryInfo;
        var clientID = pPrepareFileDownldReqObj.CLIENT_ID;
        var tenantID = pPrepareFileDownldReqObj.TENANT_ID;
        var appID = pPrepareFileDownldReqObj.APP_ID;
        var gatewayCode = pPrepareFileDownldReqObj.GW_CODE;
        var ffgCode = pPrepareFileDownldReqObj.FFG_CODE;
        var objLogInfo = pPrepareFileDownldReqObj.objLogInfo;
        var headers = pPrepareFileDownldReqObj.HEADERS;
        var modeType = pPrepareFileDownldReqObj.Select_Mode;
        var Selected_items = pPrepareFileDownldReqObj.Selected_items || [];
        var dep_cas_instance = pPrepareFileDownldReqObj.dep_cas_instance || null;
        var clt_cas_instance = pPrepareFileDownldReqObj.clt_cas_instance || null;
        var tran_db_instance = pPrepareFileDownldReqObj.tran_db_instance || null;

        if (!Selected_items.length && modeType == 'SELECTED') {
            reqInstanceHelper.PrintInfo(serviceName, 'There is No File List For Download Process...', objLogInfo);
            prepareParamStatus.status = 'FAILURE';
            prepareParamStatus.info = 'There is No File List For Download Process...';
            prepareExgFileDownloadParamsCB(prepareParamStatus);
        } else {
            var exGatewayCond = {
                'exg_code': gatewayCode,
                'client_id': clientID,
                'app_id': appID
            };
            if (isLatestPlatformVersion) {
                exGatewayCond.TENANT_ID = tenantID;
            }
            reqInstanceHelper.PrintInfo(serviceName, 'Getting Data From EX_GATEWAYS Table...', objLogInfo);
            // reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_gateways', [], exGatewayCond, objLogInfo, function (error, result) {

            GetExGatewayDetails(dep_cas_instance, exGatewayCond, objLogInfo, function (error, result) {
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Error While Querying EX_GATEWAYS Table... Error - ' + error, objLogInfo);
                    prepareParamStatus.status = 'FAILURE';
                    prepareParamStatus.error = error;
                    prepareParamStatus.info = 'Error While Querying EX_GATEWAYS Table...';
                    prepareExgFileDownloadParamsCB(prepareParamStatus);
                } else {
                    if (!result.rows.length) {
                        reqInstanceHelper.PrintInfo(serviceName, 'There is No Data Found From EX_GATEWAYS Table...', objLogInfo);
                        prepareParamStatus.status = 'FAILURE';
                        prepareParamStatus.info = 'There is No Data Found From EX_GATEWAYS Table...';
                        prepareExgFileDownloadParamsCB(prepareParamStatus);
                    }
                    else {
                        allResult.exGatewaysResult = result.rows[0];
                        reqInstanceHelper.PrintInfo(serviceName, 'Getting Data From EX_FILE_FORMAT_GROUPS Table...', objLogInfo);
                        var objRequest = {};
                        objRequest.dep_cas_instance = dep_cas_instance;
                        objRequest.EXFFG_CODE = ffgCode;
                        objRequest.session = {};
                        objRequest.session.APP_ID = appID;
                        objRequest.session.CLIENT_ID = clientID;
                        objRequest.objLogInfo = objLogInfo;

                        getExchangeFileFormatGroups(objRequest, function (callbackFFGroup) {
                            if (callbackFFGroup.STATUS !== "SUCCESS") {
                                reqInstanceHelper.PrintInfo(serviceName, 'Error While Querying EX_FILE_FORMAT_GROUPS Table... Error - ' + callbackFFGroup.ERROR_OBJECT, objLogInfo);
                                prepareParamStatus.status = 'FAILURE';
                                prepareParamStatus.error = callbackFFGroup.ERROR_OBJECT;
                                prepareExgFileDownloadParamsCB(prepareParamStatus);
                            }
                            else {
                                var SUCCESS_DATA = callbackFFGroup.SUCCESS_DATA;
                                var ffgJson = "";
                                if (!SUCCESS_DATA.length) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Data Found From EX_FILE_FORMAT_GROUPS Table...', objLogInfo);
                                    prepareParamStatus.status = 'FAILURE';
                                    prepareParamStatus.info = 'There is No Data Found From EX_FILE_FORMAT_GROUPS Table...';
                                    prepareExgFileDownloadParamsCB(prepareParamStatus);
                                } else {
                                    ffgJson = JSON.parse(SUCCESS_DATA[0]["ffg_json"]) || "";
                                    allResult.ffgJson = ffgJson;
                                    reqInstanceHelper.PrintInfo(serviceName, 'Getting Storage Path From EX_STORAGE_PATH Category In TENANT_SETUP Table...', objLogInfo);
                                    objRequest.tenant_id = tenantID;
                                    objRequest.clt_cas_instance = clt_cas_instance;
                                    var arrTenantSetupCategory = ['EXG_STORAGE_PATH', 'EXG_STORAGE_PATH_TYPE', 'EXG_STORAGE_PATH_FTP_INFO'];
                                    var tenantSetupCondObj = {
                                        'client_id': clientID,
                                        'tenant_id': tenantID,
                                        'category': arrTenantSetupCategory
                                    };
                                    reqFXDBInstance.GetTableFromFXDB(clt_cas_instance, 'tenant_setup', [], tenantSetupCondObj, objLogInfo, function (tenant_setup_error, result) {
                                        if (tenant_setup_error) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Data From Tenant Setup based category...', objLogInfo);
                                            prepareParamStatus.status = 'FAILURE';
                                            prepareParamStatus.info = 'Storage Path is Empty...';
                                            prepareExgFileDownloadParamsCB(prepareParamStatus);
                                        } else {
                                            var ftpTypeStoragePathObj = {};
                                            var StoragePathType = '';
                                            var storagePath = '';
                                            for (var v = 0; v < result.rows.length; v++) {
                                                const element = result.rows[v];
                                                try {
                                                    if (element.category == 'EXG_STORAGE_PATH') {
                                                        // setup_json looks like {"NAME":"EXG_STORAGE_PATH","VALUE":"//home//torus//vph//"}
                                                        storagePath = JSON.parse(element['setup_json'])['VALUE'];
                                                    } else if (element.category == 'EXG_STORAGE_PATH_TYPE') {
                                                        // setup_json looks like { "NAME": "EXG_STORAGE_PATH_TYPE", "VALUE": "FTP" }
                                                        StoragePathType = JSON.parse(element['setup_json'])['VALUE'];
                                                    } else {
                                                        // setup_json looks like {"IP":"192.168.2.203","PORT":"21","USERNAME":"dharani","PASSWORD":"Factory147"}
                                                        ftpTypeStoragePathObj = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(element['setup_json'])])[0];
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXGIMPORTDOWNLOAD-100013', 'Catch Error While parsing Data from Tenant Setup Json...', error);
                                                }
                                            }
                                            if (!storagePath) {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Storage Path is Empty...', objLogInfo);
                                                prepareParamStatus.status = 'FAILURE';
                                                prepareParamStatus.info = 'Storage Path is Empty...';
                                                prepareExgFileDownloadParamsCB(prepareParamStatus);
                                            } else {
                                                allResult.exStoragePathResult = storagePath;
                                                allResult.StoragePathType = StoragePathType;
                                                allResult.ftpTypeStoragePathObj = ftpTypeStoragePathObj;
                                                reqInstanceHelper.PrintInfo(serviceName, 'Storage Path - ' + storagePath, objLogInfo);
                                                reqInstanceHelper.PrintInfo(serviceName, 'Mode Type - ' + modeType, objLogInfo);
                                                var prepareFileListReqObj = {
                                                    objLogInfo,
                                                    ffgJson,
                                                    ffgCode,
                                                    Selected_items,
                                                    exGateway: allResult.exGatewaysResult,
                                                    modeType,
                                                    tran_db_instance,
                                                    objLogInfo,
                                                    serviceLogFolderPath,
                                                    recoveryInfo,
                                                    fileCountLimit,
                                                    hstMemoryFileNames,
                                                    HEADERS: headers
                                                };
                                                PreparingExgFileList(prepareFileListReqObj, function (error, patternMatchedFiles) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'File List Preparation Process Finished...', objLogInfo);
                                                    if (error) {
                                                        prepareParamStatus.status = 'FAILURE';
                                                        prepareParamStatus.info = 'Error While Preparing Pattern Matched Files...';
                                                        prepareParamStatus.error = error;
                                                        allResult.patternMatchedFiles = [];
                                                    } else {
                                                        prepareParamStatus.status = 'SUCCESS';
                                                        prepareParamStatus.info = 'Pattern Matched Files Prepared Successfully...';
                                                        allResult.prct_id = prepareFileListReqObj.prct_id;
                                                        allResult.patternMatchedFiles = patternMatchedFiles;
                                                        prepareParamStatus.data = allResult;
                                                    }
                                                    /*  Callback Result Will Be
                                                     prepareParamStatus = {
                                                         status : 'SUCCESS' || 'FAILURE',
                                                         info : 'Information About Aboved Status',
                                                         error : 'Node error Obj Will Be Here For Accurate Error',
                                                         data  : {
                                                             ffgJson : 'ffgJson',
                                                             prct_id : 'prct_id',
                                                             exStoragePathResult : 'File Download Storage Path Name',
                                                             exGatewaysResult : 'Gateway Info Like FTP Configuration Details Etc...',
                                                             patternMatchedFiles : 'Filtered File List Will Be Here in Same Array Format'
                                                         }
                                                     }; */
                                                    prepareExgFileDownloadParamsCB(prepareParamStatus);
                                                });
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            });
        }
    } catch (error) {
        console.log(error, 'Error');
        reqInstanceHelper.PrintInfo(serviceName, 'Catch Error in prepareExgFileDownloadParams()... Error - ' + error, objLogInfo);
        prepareParamStatus.status = 'FAILURE';
        prepareParamStatus.error = error;
        prepareParamStatus.info = 'Catch Error in prepareExgFileDownloadParams()...';
        prepareExgFileDownloadParamsCB(prepareParamStatus);
    }
}


function PreparingExgFileList(pFileListReqObj, PreparingExgFileListCB) {
    try {
        /*  pFileListReqObj contains
            - objLogInfo
            - tran_db_instance
            - ffgJson
            - ffgCode
            - HEADERS
            - exGateway
            - Selected_items 
            - modeType 
            - serviceLogFolderPath 
            - recoveryInfo 
            - hstMemoryFileNames 
            - fileCountLimit 
            */
        var fileCountLimit = pFileListReqObj.fileCountLimit;
        var objLogInfo = pFileListReqObj.objLogInfo;
        var ffgJson = pFileListReqObj.ffgJson;
        var ffgCode = pFileListReqObj.ffgCode;
        var exGateway = pFileListReqObj.exGateway;
        var modeType = pFileListReqObj.modeType;
        var headers = pFileListReqObj.HEADERS;
        var fileFromScreen = pFileListReqObj.Selected_items || [];

        // To Create "_processed" Folder If Folder Does not exist in FTP 
        var ftpConfig = JSON.parse(exGateway.gateway_config);
        CreateFTPFolder(exGateway, ftpConfig, function () {
            if (modeType == 'SELECTED') {
                reqInstanceHelper.PrintInfo(serviceName, 'API Request From Screen...', objLogInfo);
                if (fileFromScreen.length) {
                    reqInstanceHelper.PrintInfo(serviceName, 'Files From Screen Count - ' + fileFromScreen.length, objLogInfo);
                    fileFromScreen = CheckMatchingPattern(fileFromScreen, ffgJson, {}, objLogInfo).validFiles;
                    if (fileFromScreen.length) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Pattern Matched Files Count From Screen - ' + fileFromScreen.length, objLogInfo);
                        reqAuditLog.GetProcessToken(pFileListReqObj.tran_db_instance, objLogInfo, function (error, prct_id) {
                            if (error) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Prct_ID from PRCT_TOKENS Table...Error - ' + error, objLogInfo);
                                PreparingExgFileListCB(error, []);
                            } else {
                                pFileListReqObj.prct_id = prct_id;
                                var duplicateCheckingReqObj = {};
                                duplicateCheckingReqObj.prct_id = prct_id;
                                duplicateCheckingReqObj.filesForVerification = fileFromScreen;
                                duplicateCheckingReqObj.objLogInfo = objLogInfo;
                                duplicateCheckingReqObj.exGateway = exGateway;
                                duplicateCheckingReqObj.ffgCode = ffgCode;
                                duplicateCheckingReqObj.HEADERS = headers;
                                duplicateCheckingReqObj.tran_db_instance = pFileListReqObj.tran_db_instance;
                                reqInstanceHelper.PrintInfo(serviceName, 'Duplicate Verification Process Begins For Files From Screen...', objLogInfo);
                                DuplicateFileVerification(duplicateCheckingReqObj, function (error, eligibleFiles) {
                                    if (error) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Error In Duplicate Verification Process For Files From Screen...Error - ' + error, objLogInfo);
                                        PreparingExgFileListCB(error, []);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicate Verification Process Successfully Completed For Files From Screen...', objLogInfo);
                                        PreparingExgFileListCB('', eligibleFiles);
                                    }
                                });
                            }
                        });
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'There Is No Pattern Matched File List From Screen...', objLogInfo);
                        PreparingExgFileListCB('', []);
                    }
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'There Is No File List From Screen...', objLogInfo);
                    PreparingExgFileListCB('', []);
                }
            }
            else if (modeType == 'ALL') {
                reqInstanceHelper.PrintInfo(serviceName, 'API Request From Scheduler...', objLogInfo);
                if (exGateway.gateway_type == "FTP") {
                    ftpConfig.read_path = exGateway.read_path;
                    ftpConfig.FOLDERPATH = exGateway.read_path;
                    ftpConfig.log_info = objLogInfo;

                    ftpHelper.getFileList(ftpConfig, function (callbackFtpFiles) {
                        if (callbackFtpFiles.STATUS == "SUCCESS") {
                            /*  File List Outpt Will be
                             callbackFtpFiles.DATA = [{
                                 date: '2020 - 02 - 13T14: 56: 00.000Z',
                                 name: "MT_103_Rabeesh_V.xml",
                                 size: '1016',
                                 type: "-"
                             }] */
                            var filesFromFTP = callbackFtpFiles.DATA;
                            reqInstanceHelper.PrintInfo(serviceName, 'FTP File List Count - ' + filesFromFTP.length, objLogInfo);
                            var FTPFileLimit = fileCountLimit || 50;
                            if (fileCountLimit) {
                                reqInstanceHelper.PrintInfo(serviceName, 'FTP File Limit Count From Param - ' + fileCountLimit, objLogInfo);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Using Default FTP File Limit Count - ' + FTPFileLimit, objLogInfo);
                            }
                            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count Before [size()] - ' + global.exgFileDownloadOnly.size(), objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count Before [keys()] - ' + global.exgFileDownloadOnly.keys(), objLogInfo);
                            var FTPLimitedCountFiles = [];
                            for (var i = 0; i < filesFromFTP.length; i++) {
                                var fileNameForHst = ffgCode + '_' + filesFromFTP[i].name;
                                if (fileNameForHst && !global.exgFileDownloadOnly.get(fileNameForHst)) {
                                    var objFileDetails = {};
                                    objFileDetails.file_name = fileNameForHst;
                                    objFileDetails.initiated_time = Date.now();
                                    objFileDetails.readable_time = new Date().toLocaleString();
                                    global.exgFileDownloadOnly.put(fileNameForHst, objFileDetails);
                                    pFileListReqObj.hstMemoryFileNames.push(fileNameForHst);
                                    FTPLimitedCountFiles.push(filesFromFTP[i]);
                                }
                                if (FTPFileLimit == i) {
                                    break;
                                }
                            }
                            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count After [size()] - ' + global.exgFileDownloadOnly.size(), objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'File Download Only Hash Table File Names Count After [keys()] - ' + global.exgFileDownloadOnly.keys(), objLogInfo);
                            filesFromFTP = FTPLimitedCountFiles;
                            reqInstanceHelper.PrintInfo(serviceName, 'Matching And Filtering The FTP File List With The File Pattern...', objLogInfo);
                            filesFromFTP = CheckMatchingPattern(filesFromFTP, ffgJson, {}, objLogInfo).validFiles;
                            if (filesFromFTP.length) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Pattern Matched FTP Files Count - ' + filesFromFTP.length, objLogInfo);
                                reqAuditLog.GetProcessToken(pFileListReqObj.tran_db_instance, objLogInfo, function (error, prct_id) {
                                    if (error) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting Prct_ID from PRCT_TOKENS Table...Error - ' + error, objLogInfo);
                                        PreparingExgFileListCB(error, []);
                                    } else {
                                        pFileListReqObj.prct_id = prct_id;
                                        var duplicateCheckingReqObj = {};
                                        duplicateCheckingReqObj.prct_id = prct_id;
                                        duplicateCheckingReqObj.filesForVerification = filesFromFTP;
                                        duplicateCheckingReqObj.objLogInfo = objLogInfo;
                                        duplicateCheckingReqObj.exGateway = exGateway;
                                        duplicateCheckingReqObj.HEADERS = headers;
                                        duplicateCheckingReqObj.ffgCode = pFileListReqObj.ffgCode;
                                        duplicateCheckingReqObj.serviceLogFolderPath = pFileListReqObj.serviceLogFolderPath;
                                        duplicateCheckingReqObj.recoveryInfo = pFileListReqObj.recoveryInfo;
                                        duplicateCheckingReqObj.tran_db_instance = pFileListReqObj.tran_db_instance;
                                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicate Verification Process Begins For Files From FTP...', objLogInfo);
                                        DuplicateFileVerification(duplicateCheckingReqObj, function (error, eligibleFiles) {
                                            if (error) {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Error In Duplicate Verification Process For Files From FTP...Error - ' + error, objLogInfo);
                                                PreparingExgFileListCB(error, []);
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Duplicate Verification Process Successfully Completed For Files From FTP...', objLogInfo);
                                                PreparingExgFileListCB('', eligibleFiles);
                                            }
                                        });
                                    }
                                });
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'There Is No Pattern Matched File List From FTP File List...', objLogInfo);
                                PreparingExgFileListCB('', []);
                            }

                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Error While Getting File List From FTP...', objLogInfo);
                            PreparingExgFileListCB('Error While Getting File List From FTP...', []);
                        }
                    });
                }
                else {
                    reqInstanceHelper.PrintInfo(serviceName, 'Gateway Is Not FTP...', objLogInfo);
                    PreparingExgFileListCB('Gateway Is Not FTP...', []);
                    PreparingExgFileListCB('Gateway Is Not FTP...', []);
                }
            }
            else {
                reqInstanceHelper.PrintInfo(serviceName, 'Mode Type Is Not Defined...', objLogInfo);
                PreparingExgFileListCB('Mode Type Is Not Defined...', []);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Catch Error in PreparingExgFileList() - Error - ' + error, objLogInfo);
        PreparingExgFileListCB(error, []);
    }

}


function DuplicateFileVerification(pDuplicateCheckingReqObj, DuplicateFileVerificationCB) {
    try {
        /* pDuplicateCheckingReqObj Should Contains
         - tran_db_instance 
         - objLogInfo 
         - prct_id 
         - ffgCode 
         - filesForVerification 
         - exGateway 
         - HEADERS 
         - serviceLogFolderPath 
         - recoveryInfo 
         
         */

        var serviceLogFolderPath = pDuplicateCheckingReqObj.serviceLogFolderPath;
        var exGateway = pDuplicateCheckingReqObj.exGateway;
        var filesForVerification = pDuplicateCheckingReqObj.filesForVerification;
        var tran_db_instance = pDuplicateCheckingReqObj.tran_db_instance;
        var objLogInfo = pDuplicateCheckingReqObj.objLogInfo;
        var prct_id = pDuplicateCheckingReqObj.prct_id;
        var FFG_CODE = pDuplicateCheckingReqObj.ffgCode;
        var headers = pDuplicateCheckingReqObj.HEADERS;
        var tempExhfTableFiles = [];
        var VerificationFileNames = [];
        var recoveryCondObj = {
            prct_id
        };
        for (var i = 0; i < filesForVerification.length; i++) {
            VerificationFileNames.push(filesForVerification[i]["name"]);
            var tempExhfTableFileInfo = {};
            tempExhfTableFileInfo.file_name = filesForVerification[i]["name"];
            tempExhfTableFileInfo.CREATED_BY = objLogInfo.LOGIN_NAME;
            tempExhfTableFileInfo.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo);
            tempExhfTableFileInfo.prct_id = prct_id;
            tempExhfTableFileInfo.status = 'INPROGRESS';
            tempExhfTableFileInfo.exg_code = exGateway.exg_code;
            tempExhfTableFiles.push(tempExhfTableFileInfo);
        }
        reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Insert Starts ...', objLogInfo);
        reqTranDBInstance.InsertBulkTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", tempExhfTableFiles, objLogInfo, null, function (result, error) {
            if (error) {
                DuplicateFileVerificationCB(error, []);
            }
            else {
                reqInstanceHelper.PrintInfo(serviceName, 'Executing Duplicate Verification Query...', objLogInfo);
                var query = "select ehf.exhf_id,ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED' or file_status = 'UPDATE_FAILED' or file_status = 'PARSING_FAILED' or file_status = 'FILE_UPDATION_INPROGRESS') and exffg_code= '" + FFG_CODE + "' and tmp.prct_id= '" + prct_id + "'  ";
                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                    if (error) {
                        pDuplicateCheckingReqObj.recoveryInfo.push({
                            API_RECOVERY_CODE: 'EXG_FILE_DOWNLOAD_0001',
                            // HEADER: mHeaders,
                            DB_CONDITION_DATA: recoveryCondObj,
                            IS_API_PROCESS: true,
                            NODE_ERROR_OBJ: error,
                            SERVICE_LOG_FOLDER_PATH: serviceLogFolderPath
                        });
                        DuplicateFileVerificationCB(error, []);
                    } else {
                        var dupFilesFromExhf = result.rows;
                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicate Verification Files Count - ' + filesForVerification.length, objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicated Files Count From Table - ' + dupFilesFromExhf.length, objLogInfo);
                        var dupFileNames = [];
                        var eligibleFiles = [];
                        for (var g = 0; g < dupFilesFromExhf.length; g++) {
                            var fileName = dupFilesFromExhf[g]["file_name"];
                            if (fileName && VerificationFileNames.indexOf(fileName) !== -1) {
                                // For Moving Duplicated Files To Processed FTP Folder
                                dupFileNames.push(fileName);
                            }
                        }
                        // Removing Duplicated File Name If exists
                        dupFileNames = dupFileNames.filter(function (elem, pos) {
                            return dupFileNames.indexOf(elem) == pos;
                        });
                        var moveDupFilesReqObj = {};
                        moveDupFilesReqObj.dupFileNames = dupFileNames;
                        moveDupFilesReqObj.objLogInfo = objLogInfo;
                        moveDupFilesReqObj.exGateway = exGateway;
                        MoveDuplicatedFiles(moveDupFilesReqObj, function () {
                            for (var f = 0; f < filesForVerification.length; f++) {
                                var fileName = filesForVerification[f]["name"];
                                if (fileName && dupFileNames.indexOf(fileName) == -1) {
                                    // These Files are Eligible For Download Process
                                    eligibleFiles.push(filesForVerification[f]);
                                }
                            }
                            reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count - ' + eligibleFiles.length, objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Deleting Entries from TMP_EX_HEADER_FILES for Prct_ID - ' + prct_id, objLogInfo);
                            var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "'";
                            reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                if (error) {
                                    pDuplicateCheckingReqObj.recoveryInfo.push({
                                        API_RECOVERY_CODE: 'EXG_FILE_DOWNLOAD_0001',
                                        // HEADER: mHeaders,
                                        DB_CONDITION_DATA: recoveryCondObj,
                                        IS_API_PROCESS: true,
                                        NODE_ERROR_OBJ: error,
                                        SERVICE_LOG_FOLDER_PATH: serviceLogFolderPath
                                    });
                                    DuplicateFileVerificationCB(error, []);
                                } else {
                                    DuplicateFileVerificationCB('', eligibleFiles);
                                }
                            });
                        });
                    }
                });
            }
        });
    } catch (error) {
        DuplicateFileVerificationCB(error, []);
    }
}


function MoveDuplicatedFiles(moveDupFilesReqObj, MoveDuplicatedFilesCB) {
    /* moveDupFilesReqObj Should Contains
       - exGateway
       - objLogInfo
       - dupFileNames
       */
    try {
        var dupFileNames = moveDupFilesReqObj.dupFileNames || [];
        if (!dupFileNames.length) {
            MoveDuplicatedFilesCB('There in No Duplicated File List...', 'FAILURE');
        } else {
            var removedSlashReadPath = moveDupFilesReqObj.exGateway.read_path;
            var ftpConfig = JSON.parse(moveDupFilesReqObj.exGateway.gateway_config);
            ftpConfig.log_info = objLogInfo;
            var objLogInfo = moveDupFilesReqObj.objLogInfo;
            removedSlashReadPath = ftpHelper.RemoveSlashCharFrmString(removedSlashReadPath);
            reqInstanceHelper.PrintInfo(serviceName, 'Moving Files To This FTP Folder - ' + removedSlashReadPath, objLogInfo);
            var filesToRename = [];
            var moveFrom = removedSlashReadPath + '\\';
            // var moveTo = removedSlashReadPath + "_duplicate" + "\\";
            var moveTo = removedSlashReadPath + "_processed" + "\\";
            for (var file of dupFileNames) {
                var obj = {
                    "file_name": file,
                    "fromPath": moveFrom,
                    "toPath": moveTo
                };
                filesToRename.push(obj);
            }
            ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo)
                .then(() => {
                    MoveDuplicatedFilesCB('Duplicated File List Moved Successfully...', 'SUCCESS');
                })
                .catch((error) => {
                    MoveDuplicatedFilesCB('Catch Error While Moving Duplicated Files...Error - ' + error, 'FAILURE');
                });
        }
    } catch (error) {
        MoveDuplicatedFilesCB('Catch Error in MoveDuplicatedFiles()...Error - ' + error, 'FAILURE');
    }
}



function exportFile(exportFileReqObj, originalRequest, callBackExportFile) {
    reqExchangeEngine = require('./ExchangeEngine');
    var resObj = "";
    var objLogInfo = exportFileReqObj.objLogInfo;
    var headers = exportFileReqObj.mHeaders;
    var tran_db_instance = exportFileReqObj.tran_db_instance;
    var dep_cas_instance = exportFileReqObj.dep_cas_instance;
    var selectedData = [];

    var dynamicMethod = function () { };
    reqInstanceHelper.PrintInfo(serviceName, 'Write Method Type ' + exportFileReqObj.WRITE_METHOD, {});

    dynamicMethod = getExportRequestData;

    reqInstanceHelper.PrintInfo(serviceName, 'Getting gateway setup details', {});
    getGateWaySetup(exportFileReqObj, function (callbackgatewaySetup) {
        reqInstanceHelper.PrintInfo(serviceName, 'Gateway setup details ends', {});
        var gatewayobject = callbackgatewaySetup.SUCCESS_DATA;

        var gateway_config = gatewayobject.gateway_config || "";
        var read_path = gatewayobject.read_path || "";
        var write_path = gatewayobject.write_path || "";
        var changeStatus = [];

        exportFileReqObj.gateway_config = gatewayobject;
        exportFileReqObj.objLogInfo = objLogInfo;

        dynamicMethod(exportFileReqObj, originalRequest, function (resRequestData) {

            if (resRequestData.STATUS === "SUCCESS") {
                //resRequestData.SUCCESS_DATA.PATH = write_path;
                resRequestData.SUCCESS_DATA.storagePath = exportFileReqObj.storagePath;
                reqInstanceHelper.PrintInfo(serviceName, "Exchange engine processing starts", objLogInfo);
                resRequestData.SUCCESS_DATA["WRITE_METHOD"] = exportFileReqObj.WRITE_METHOD;
                resRequestData.SUCCESS_DATA["gateway_config"] = callbackgatewaySetup;
                resRequestData.SUCCESS_DATA["SESSION"] = exportFileReqObj.session;
                resRequestData.SUCCESS_DATA["headers"] = originalRequest["headers"];
                resRequestData.SUCCESS_DATA["GATEWAY_SETUP"] = callbackgatewaySetup;
                resRequestData.SUCCESS_DATA['objLogInfo'] = objLogInfo;
                resRequestData.SUCCESS_DATA["originalRequest"] = originalRequest;
                resRequestData.SUCCESS_DATA["EVENT_PARAMS"] = exportFileReqObj.event_args;
                resRequestData.SUCCESS_DATA["HL_CHAINCODE"] = exportFileReqObj.HL_CHAINCODE || "";
                resRequestData.SUCCESS_DATA["HL_CHAINCODE_FUNCTION"] = exportFileReqObj.HL_CHAINCODE_FUNCTION || "";
                resRequestData.SUCCESS_DATA["HL_SETUP"] = exportFileReqObj.HL_SETUP || "";
                resRequestData.SUCCESS_DATA["clt_cas_instance"] = exportFileReqObj.clt_cas_instance;
                resRequestData.SUCCESS_DATA["dep_cas_instance"] = dep_cas_instance;
                resRequestData.SUCCESS_DATA["tran_db_instance"] = tran_db_instance;
                resRequestData.SUCCESS_DATA["exg_additional_params"] = exportFileReqObj.EXG_ADDITIONAL_PARAMS;

                console.log("Before Exchange Engine");
                reqExchangeEngine.ExchangeEngine(resRequestData.SUCCESS_DATA, function (response) {
                    reqInstanceHelper.PrintInfo(serviceName, "Exchange engine processing ends", objLogInfo);
                    if (response.STATUS === "SUCCESS") {
                        try {
                            var recordData = response.SUCCESS_DATA.adapterObj.FILE_FORMAT_OBJ.RECORD_FORMATS[0];
                        } catch (ex) {
                        }
                        var primary_col;
                        async.series([
                            function (asyncCallBackUpdate) {
                                var resObj = {};
                                reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'dt_info', [], {
                                    'dt_code': exportFileReqObj.DT_CODE,
                                    'app_id': exportFileReqObj.session.APP_ID
                                }, objLogInfo, function callbacksearchuser(error, result) {
                                    if (error) {
                                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120006", "Error while executing getGateWaySetup method", error, "", "");
                                        callBackExportFile(resObj);
                                    } else {
                                        if (result.rows.length > 0) {
                                            try {
                                                for (var dataTemp of JSON.parse(result.rows[0]['relation_json'])) {
                                                    primary_col = dataTemp['PRIMARY_COLUMN'].toLowerCase();
                                                    if (recordData.cs_group && recordData.cs_group[0]) {
                                                        var objcsGroup = recordData.cs_group[0];
                                                        if (dataTemp.DTT_CODE == objcsGroup.DTT_Code) {
                                                            if (objcsGroup['cs_status'] && objcsGroup['cs_process_status']) {
                                                                dataTemp['cs_status'] = objcsGroup['cs_status'];
                                                                dataTemp['cs_process_status'] = objcsGroup['cs_process_status'];
                                                                changeStatus.push(dataTemp);
                                                            }
                                                        }
                                                    }
                                                }
                                                asyncCallBackUpdate();
                                            } catch (ex) {
                                                console.log("===EXCEPTION IN CHANGE STATUS====");
                                                console.log(ex);
                                                asyncCallBackUpdate();
                                            }
                                        } else {
                                            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120006", "Error while executing getGateWaySetup method", error, "", "");
                                            callBackExportFile(resObj);
                                        }
                                    }
                                });
                            },
                            function (asyncCallBackUpdate) {
                                async.forEachOfSeries(changeStatus, function (value, key, callbackAsyncForEach) {

                                    var dt_info = value;
                                    var target_table = dt_info['TARGET_TABLE'];
                                    primary_col = dt_info['PRIMARY_COLUMN'];
                                    var prct_id = objLogInfo.PROCESS_INFO.PRCT_ID;
                                    selectedData = exportFileReqObj.orignalSelectedData;
                                    var cs_status = dt_info['cs_status'];
                                    var cs_process_status = dt_info['cs_process_status'];
                                    var arr = [];
                                    for (var i = 0; i < selectedData.length; i++) {
                                        // ex_headerfileupdate.push(ex_files_arr[i].EXHF_ID)
                                        var primaryData = selectedData[i][primary_col] || selectedData[i][primary_col.toLowerCase()];

                                        if (primaryData) {
                                            var obj = {
                                                "file_id": primaryData,
                                                "prct_id": prct_id + "_temp",
                                                "CREATED_BY": objLogInfo.USER_ID,
                                                "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo)
                                            };
                                            arr.push(obj);
                                        }
                                    }

                                    if (arr.length == 0) {
                                        callbackAsyncForEach();
                                    } else {
                                        reqTranDBInstance.InsertBulkTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", arr, objLogInfo, null, function (result, error) {
                                            if (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120084', 'Error while insert into TMP_EX_HEADER_FILES Table', error);
                                                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120084", "Error while insert into TMP_EX_HEADER_FILES Table", error, "", "");
                                                callBackExportFile(resObj);
                                            } else {
                                                var query = "update " + target_table + " set status = '" + cs_status + "',process_status = '" + cs_process_status + "',modified_by = '" + objLogInfo.LOGIN_NAME + "', modified_date = '" + reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo) + "' where " + primary_col + " IN (select CAST(file_id AS INT) from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "')";
                                                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                    if (error) {
                                                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                                        callBackExportFile(resObj);
                                                    } else {

                                                        var query = "update transaction_set set status =  '" + cs_status + "',process_status = '" + cs_process_status + "',modified_by = '" + objLogInfo.LOGIN_NAME + "', modified_date = '" + reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo) + "' where  trn_id IN (select CAST(file_id AS INT) from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "') and dt_code = '" + exportFileReqObj.DT_CODE + "' and dtt_code = '" + exportFileReqObj.DTT_CODE + "'";
                                                        reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                            if (error) {
                                                                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                                                callBackExportFile(resObj);
                                                            } else {

                                                                var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "'";
                                                                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                                    if (error) {
                                                                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                                                        callBackExportFile(resObj);
                                                                    } else {
                                                                        reqTranDBInstance.Commit(tran_db_instance, true, function () {
                                                                            callbackAsyncForEach();
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    }

                                                });
                                            }
                                        });
                                    }
                                }, function (err) {
                                    asyncCallBackUpdate();
                                });

                            }
                        ], function (err) {
                            if (!err) {
                                if (response.STATUS === "SUCCESS" && exportFileReqObj.WRITE_METHOD !== "INSTANCE" && response.SUCCESS_MESSAGE != 'STATIC') {
                                    //  var fileObj = response.SUCCESS_DATA.adapterObj.FILE_FORMAT_OBJ;
                                    var fileObj = response.SUCCESS_DATA.files;

                                    var EXFF_ID = response.SUCCESS_DATA.adapterObj.FILE_FORMAT_OBJ["EXFF_ID"] || "";
                                    var files = [];
                                    if (Array.isArray(fileObj)) {
                                        for (var i = 0; i < fileObj.length; i++) {
                                            files.push({
                                                "name": fileObj[i],
                                                "STATUS": "CREATED",
                                                "EXFF_ID": EXFF_ID
                                            });
                                        }
                                    } else {
                                        var files = [{
                                            "name": fileObj.FILE_NAME,
                                            "STATUS": "CREATED",
                                            "EXFF_ID": EXFF_ID
                                        }];
                                    }
                                    exportFileReqObj.FILES = files;
                                    exportFileReqObj["save_tran"] = response.SUCCESS_DATA.adapterObj.ORG_DATA || [];
                                    exportFileReqObj["NEED_TRN_INSERT"] = true;
                                    exportFileReqObj["PRIMARY_COLUMN"] = primary_col;

                                    var newExportFileReqObj = exportFileReqObj;
                                    newExportFileReqObj['objLogInfo'] = objLogInfo;
                                    newExportFileReqObj["gateway_config"] = gateway_config;
                                    newExportFileReqObj['tran_db_instance'] = tran_db_instance;
                                    reqInstanceHelper.PrintInfo(serviceName, "----------File entry detail-----------", {});
                                    reqInstanceHelper.PrintInfo(serviceName, JSON.stringify(files), {});
                                    reqInstanceHelper.PrintInfo(serviceName, "Updating exchange file info tables", {});
                                    updateExchangeFileInfo(newExportFileReqObj, function (finalResponse) {
                                        reqInstanceHelper.PrintInfo(serviceName, "Updating exchange file info tables ends", {});
                                        reqInstanceHelper.PrintInfo(serviceName, "Final Response after updating ", {});
                                        reqInstanceHelper.PrintInfo(serviceName, JSON.stringify(finalResponse), {});
                                        callBackExportFile(finalResponse);
                                    });
                                } else if (response.STATUS === "SUCCESS" && exportFileReqObj.WRITE_METHOD == "INSTANCE" && response.SUCCESS_MESSAGE != 'STATIC') {
                                    callBackExportFile(response);
                                } else if (response.SUCCESS_MESSAGE == 'STATIC' && response.STATUS === "SUCCESS") {
                                    console.log("-------CALLED STATIC AT -----" + new Date());
                                    console.log("----------STATIC RESPONSE----" + JSON.stringify(response));
                                    if (response.SUCCESS_DATA != undefined && response.SUCCESS_DATA.SUCCESS_DATA.length > 0) {
                                        var callbackres = response.SUCCESS_DATA.SUCCESS_DATA;
                                        var tempData = [];
                                        for (var x = 0; x < callbackres.length; x++) {
                                            if (callbackres[x].file_status == "FAILURE") {
                                                callbackres[x].STATUS = "UPDATE_FAILED";
                                            }
                                            callbackres[x]["FileName"] = callbackres[x]["name"];
                                            callbackres[x]["Error"] = callbackres[x]["error_description"];
                                            callbackres[x]["FILE_COUNT"] = {
                                                TOTAL_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_TOTAL_COUNT,
                                                SUCCESS_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_SUCCESS_COUNT,
                                                FAILURE_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_FAILURE_COUNT,

                                            };
                                            for (var i = 0; i < callbackres[x]["TS"].length; i++) {
                                                callbackres[x]["ts_id"] = callbackres[x]["TS"][i]["ts_id"];
                                                callbackres[x]["trn_id"] = callbackres[x]["TS"][i]["trn_id"];
                                            }
                                            tempData.push({
                                                "FileName": callbackres[x]["name"],
                                                "SaveTranResult": {
                                                    "STATUS": "SUCCESS",
                                                    "SUCCESS_DATA": {
                                                        "service_status": "SUCCESS",
                                                        "data": {
                                                            "LAST_INSERT": callbackres[x]["TS"]
                                                        }
                                                    }
                                                }
                                            });
                                        }
                                        exportFileReqObj["save_tran"] = tempData;
                                        exportFileReqObj["NEED_TRN_INSERT"] = true;
                                        exportFileReqObj["FILES"] = callbackres;
                                        if (exportFileReqObj.gateway_config == undefined) {
                                            exportFileReqObj["gateway_config"] = {};
                                            exportFileReqObj["gateway_config"] = gatewayobject;
                                        }
                                        if (exportFileReqObj.objLogInfo == undefined) {
                                            exportFileReqObj.objLogInfo = objLogInfo;
                                        }
                                        exportFileReqObj.tran_db_instance = tran_db_instance;
                                        updateExchangeFileInfo(exportFileReqObj, function (finalResponse) {
                                            callBackExportFile(finalResponse);
                                        });
                                    } else {
                                        callBackExportFile(response);
                                    }
                                } else {
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120002", response.ERROR_MESSAGE, "", "", "");
                                    callBackExportFile(resObj);
                                }
                            }
                        });
                    } else {
                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120002", response.ERROR_MESSAGE, "", "", "");
                        callBackExportFile(resObj);
                    }
                });
            } else {
                callBackExportFile(resRequestData);
            }
        });
    });
}

function importFile(importFileReqObj, originalRequest, callBackImportFile) {
    reqExchangeEngine = require('./ExchangeEngine');
    var resObj = "";
    var finalResponse = '';
    var objLogInfo = originalRequest.objLogInfo || {};
    reqInstanceHelper.PrintInfo(serviceName, "Calling Gateway Setup", objLogInfo);
    getGateWaySetup(originalRequest, function (callbackgatewaySetup) {
        if (callbackgatewaySetup.STATUS != 'SUCCESS') {
            finalResponse = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-90928", "Error in Gateway setup Query....", "", "FAILURE", "Error in Gateway setup Query....");
            return callBackImportFile(finalResponse);
        }
        reqInstanceHelper.PrintInfo(serviceName, "Gateway Setup Obtained", objLogInfo);
        var gatewayobject = callbackgatewaySetup.SUCCESS_DATA;
        var gateway_config = gatewayobject.gateway_config || "";
        var read_path = gatewayobject.read_path || "";
        var write_path = gatewayobject.write_path || "";
        originalRequest.gateway_config = gatewayobject;
        reqInstanceHelper.PrintInfo(serviceName, "Gateway Get Storage Path", objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, "Fetching File Format Group Details", objLogInfo);
        getExchangeFileFormatGroups(originalRequest, function (exchangeFileFomatGroupResponse) {
            reqInstanceHelper.PrintInfo(serviceName, "File Format Group Details Fetched", objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, "File Format Group Details status is " + exchangeFileFomatGroupResponse.STATUS, objLogInfo);
            if (exchangeFileFomatGroupResponse.STATUS === "SUCCESS") {
                reqInstanceHelper.PrintInfo(serviceName, "Formulating file names", objLogInfo);
                var data = exchangeFileFomatGroupResponse.SUCCESS_DATA;
                if (data.length > 0) {
                    var ffg_json = commonFile.parseJSON(data[0]["ffg_json"]);
                    var process = "IMPORT";
                    var exgEngineObj = {};
                    exgEngineObj.process = process;
                    exgEngineObj.ruleObj = ffg_json;
                    exgEngineObj.importFileReqObj = importFileReqObj;
                    exgEngineObj.originalRequest = originalRequest;
                    exgEngineObj.FILE_INFO = originalRequest["FILE_INFO"];
                    exgEngineObj.GATEWAY_SETUP = callbackgatewaySetup;
                    exgEngineObj["DEFAULT_PARAMS"] = originalRequest["Default_params"];
                    exgEngineObj['objLogInfo'] = objLogInfo;
                    var files = [];
                    importFileReqObj = importFileReqObj.filter(function (n) {
                        return n != null;
                    });
                    files = CheckMatchingPattern(importFileReqObj, ffg_json, originalRequest.session, objLogInfo).validFiles;
                    if (!originalRequest.isStaticTran && files.length == 0) {
                        finalResponse = commonFile.prepareMethodResponse("FAILURE", "", "", "EXG-", "File donot match with matching pattern", "", "FAILURE", "File donot match with matching pattern");
                        return callBackImportFile(finalResponse);
                    }
                    exgEngineObj.importFileReqObj = exgEngineObj.importFileReqObj.filter(function (n) {
                        return n != null;
                    });
                    exgEngineObj["headers"] = originalRequest["headers"];
                    var ffgtype = ffg_json.FILE_FORMATS[0]["TYPE"];
                    var project_name = ffg_json.FILE_FORMATS[0]["PROJECT_NAME"] || ffg_json.FILE_FORMATS[0]["project_name"] || "";
                    var project_code = ffg_json.FILE_FORMATS[0]["PROJECT_CODE"] || ffg_json.FILE_FORMATS[0]["project_code"] || "";
                    // For Download Compatibility Start
                    var ffgProjects = ffg_json.FILE_FORMATS[0]["PROJECTS"] || [];
                    // Getting Code Snippet Name - New Case
                    for (var u = 0; u < ffgProjects.length; u++) {
                        var codesnippetInfo = ffgProjects[0];
                        if (codesnippetInfo.PROJECT_CASE == 'CREATE_OR_UPDATE') {
                            project_name = codesnippetInfo.PROJECT_NAME;
                            project_code = codesnippetInfo.PROJECT_CODE;
                            break;
                        }
                    }
                    // For Download Compatibility End

                    if (ffgtype != 'D' && project_name != "") {
                        exgEngineObj["PROJECT_CODE"] = project_code;
                        exgEngineObj["PROJECT_NAME"] = project_name;
                        exgEngineObj["is_custom_code_applicable"] = true;
                    } else {
                        exgEngineObj["is_custom_code_applicable"] = false;
                    }

                    if (originalRequest['continue_process'] == undefined) {
                        originalRequest['continue_process'] = true;
                    }
                    var continue_process = originalRequest['continue_process'];
                    exgEngineObj['continue_process'] = continue_process;
                    var tran_db_instance = originalRequest.tran_db_instance;
                    reqInstanceHelper.PrintInfo(serviceName, "Calling Exchange Engine", objLogInfo);
                    global.Exg_Download_Need_Prct_Null_Process = false;
                    global.Exg_Download_Need_Prct_Null_Process_1 = false;
                    global.Exg_Download_Need_Prct_Null_Process_2 = false;
                    global.Exg_Download_Need_Prct_Null_Process_3 = false;
                    global.Exg_Download_Need_Prct_Null_Process_4 = false;
                    global.Exg_Update_Need_Prct_Null_Process = false;
                    reqExchangeEngine.ExchangeEngine(exgEngineObj, function (response) {
                        /* response = {
                            "STATUS": "SUCCESS", "SUCCESS_MESSAGE": "STATIC",
                            "SUCCESS_DATA": [
                                {
                                    "name": "MT_103_800_Rabeeshv.xml", "STATUS": "DOWNLOADED", "EXHF_ID": "301508",
                                    "EXFF_ID": "", "file_status": "SUCCESS", "error_description": "",
                                    "USER_ID": "TPH_U_154", "ERROR_TYPE": "", "ERROR_MSG": "",
                                    "MODULE_NAME": "RTGS", "PRCT_ID": "447351", "TRN_ID": "", "TRN_STATUS": "",
                                    "TS": [{}]
                                }], "ERROR_CODE": "1000", "ERROR_MESSAGE": "HELLO", "ERROR_OBJECT": "",
                            "PROCESS_STATUS": "FAILURE", "INFO_MESSAGE": {
                                "FILE_TOTAL_COUNT": 1,
                                "FILE_SUCCESS_COUNT": 1, "FILE_FAILURE_COUNT": 0
                            }, "CONTINUE_PROCESS": false
                        }; */
                        if (exgEngineObj["is_custom_code_applicable"]) {
                            if (typeof response.SUCCESS_DATA.SUCCESS_DATA === 'string') {
                                try {
                                    response.SUCCESS_DATA.SUCCESS_DATA = JSON.parse(response.SUCCESS_DATA.SUCCESS_DATA);
                                } catch (ex) {
                                    return callBackImportFile(response);
                                }
                            }
                            try {
                                continue_process = response.CONTINUE_PROCESS || false;
                                var callbackres = response.SUCCESS_DATA.SUCCESS_DATA;
                                var tempData = [];
                                var files = [];
                                for (var x = 0; x < callbackres.length; x++) {
                                    try {
                                        if (callbackres[x].file_status == "FAILURE") {
                                            callbackres[x].STATUS = "UPDATE_FAILED";
                                        } else {
                                            callbackres[x].STATUS = "UPDATED";
                                        }
                                        callbackres[x]["FileName"] = callbackres[x]["name"];
                                        callbackres[x]["Error"] = callbackres[x]["error_description"];
                                        callbackres[x]["FILE_COUNT"] = {
                                            TOTAL_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_TOTAL_COUNT,
                                            SUCCESS_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_SUCCESS_COUNT,
                                            FAILURE_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_FAILURE_COUNT,
                                        };
                                        if (callbackres[x]["TS"]) {
                                            for (var i = 0; i < callbackres[x]["TS"].length; i++) {
                                                callbackres[x]["ts_id"] = callbackres[x]["TS"][i]["ts_id"];
                                                callbackres[x]["trn_id"] = callbackres[x]["TS"][i]["trn_id"];
                                            }
                                        }
                                        tempData.push({
                                            "FileName": callbackres[x]["name"],
                                            "Error": callbackres[x]["error_description"],
                                            "SaveTranResult": {
                                                "STATUS": callbackres[x].file_status,
                                                "SUCCESS_DATA": {
                                                    "service_status": callbackres[x].file_status,
                                                    "data": {
                                                        "LAST_INSERT": callbackres[x]["TS"]
                                                    }
                                                },
                                                "FILE_COUNT": {
                                                    TOTAL_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_TOTAL_COUNT,
                                                    SUCCESS_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_SUCCESS_COUNT,
                                                    FAILURE_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_FAILURE_COUNT,
                                                }
                                            }
                                        });

                                        files.push({
                                            "name": callbackres[x]["name"],
                                            "exhf_id": parseInt(callbackres[x]["EXHF_ID"]),
                                            "file_status": callbackres[x]["STATUS"]
                                        });

                                    } catch (ex) {

                                    }
                                }
                                if (exgEngineObj.FILE_INFO && exgEngineObj.FILE_INFO.SUCCESS_DATA && exgEngineObj.FILE_INFO.SUCCESS_DATA.EXHF_ID_ARR) {
                                    for (var dat of exgEngineObj.FILE_INFO.SUCCESS_DATA.EXHF_ID_ARR) {
                                        for (var file of files) {
                                            if (dat['file_name'] == file["name"]) {
                                                file["exhf_id"] = dat["exhf_id"];
                                            }
                                        }
                                    }
                                }
                                originalRequest["save_tran"] = callbackres;
                                originalRequest["NEED_TRN_INSERT"] = true;
                                originalRequest["FILES"] = files;
                                originalRequest["tran_db_instance"] = tran_db_instance;
                                if (response.SUCCESS_DATA.STATUS == "FAILURE" || response.SUCCESS_DATA.STATUS == "SUCCESS" && tempData.length == 0) {
                                    var resObj = commonFile.prepareMethodResponse(response.SUCCESS_DATA.STATUS, "", "", "ERR-EXG-120020", "Error while executing calling API method", "", "", "");
                                    callBackImportFile(resObj);
                                } else {
                                    if (continue_process) {
                                        reqInstanceHelper.PrintInfo(serviceName, "Updating Exchange file tran records after code snippet execution started...", objLogInfo);
                                        updateExchangeFileInfoPathImport(originalRequest, function (finalResponse) {
                                            reqInstanceHelper.PrintInfo(serviceName, "Updating Exchange file tran records after code snippet execution ended...", objLogInfo);
                                            callBackImportFile(finalResponse);
                                        });
                                    } else {
                                        var filearray = [];
                                        var SAVE_TRAN_DET = callbackres;
                                        var FILE_COUNT = {
                                            TOTAL_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_TOTAL_COUNT,
                                            SUCCESS_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_SUCCESS_COUNT,
                                            FAILURE_FILE_COUNT: response.SUCCESS_DATA.INFO_MESSAGE.FILE_FAILURE_COUNT,
                                        };
                                        for (var i = 0; i < SAVE_TRAN_DET.length; i++) {
                                            if (SAVE_TRAN_DET[i]["file_status"] == "SUCCESS") {
                                                filearray.push({
                                                    "SUCCESS_FILE_NAME": SAVE_TRAN_DET[i]["name"]
                                                });
                                            } else {
                                                filearray.push({
                                                    "FAILURE_FILE_NAME": SAVE_TRAN_DET[i]["name"],
                                                    "FAILURE_FILE_ERROR": SAVE_TRAN_DET[i]["error_description"]
                                                });
                                            }
                                        }
                                        var resultobj = {
                                            FILE_COUNT: FILE_COUNT,
                                            FILES: filearray,
                                            FROM_STATIC: true
                                        };
                                        console.log('resultobj', JSON.stringify(resultobj));
                                        resObj = commonFile.prepareMethodResponse("SUCCESS", "", resultobj, "", "", "", "", "");
                                        callBackImportFile(resObj);
                                    }
                                }
                            } catch (ex) {
                                var resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-", "Exception Occurred", ex, "", "");
                                callBackImportFile(resObj);
                            }
                        } else {
                            if (response.STATUS != undefined && response.STATUS == "FAILURE") {
                                response.ERROR_MESSAGE = "Error while trying to import";
                                response.ERROR_OBJECT = "";
                                callBackImportFile(response);
                            } else {
                                var files = [];
                                if (response.SAVED_TRANSACTIONS != "" && response.SAVED_TRANSACTIONS != undefined) {
                                    if (response.SAVED_TRANSACTIONS.length > 0) {
                                        for (var i in importFileReqObj) {
                                            files.push({
                                                "name": importFileReqObj[i]["name"],
                                                "STATUS": "UPDATED"
                                            });
                                        }
                                        originalRequest.FILES = files;
                                        originalRequest.NEED_TRN_INSERT = true;
                                        originalRequest.ffg_json = ffg_json;
                                        originalRequest.save_tran = response.SAVED_TRANSACTIONS;
                                        originalRequest.originalRequest = originalRequest;
                                        var from_update_file = originalRequest.FROM_UPDATE_FILES || false;
                                        var UPDATE_EXG_FILE = true;
                                        if (originalRequest.UPDATE_EXG_FILE == false) {
                                            UPDATE_EXG_FILE = false;
                                        }

                                        var ERRONEOUS_DATA = response["ERRONEOUS_DATA"] || [];
                                        var count = 0;
                                        for (var req of originalRequest.FILES) {
                                            if (req['name'] != '') {
                                                count += 1;
                                            }
                                        }
                                        reqInstanceHelper.PrintInfo("EXGIMPORTDOWNLOAD", 'Update exg file status ' + UPDATE_EXG_FILE, {});
                                        if (UPDATE_EXG_FILE) {
                                            var temp = {};


                                            temp["FILE_COUNT"] = {
                                                TOTAL_FILE_COUNT: count,
                                                SUCCESS_FILE_COUNT: 0,
                                                FAILURE_FILE_COUNT: 0
                                            };
                                            if (from_update_file) {
                                                updateExchangeFileInfoPath(originalRequest, function (finalResponse) {
                                                    finalResponse["VALIDATED_DATA_ERROR_RESULT"] = ERRONEOUS_DATA;
                                                    try {
                                                        temp['FILE_COUNT']['TOTAL_FILE_COUNT'] = count;
                                                        temp["FILE_COUNT"]['SUCCESS_FILE_COUNT'] = finalResponse['SUCCESS_DATA']['EXHF_ID_ARR'].length;
                                                        temp["FILE_COUNT"]['FAILURE_FILE_COUNT'] = ERRONEOUS_DATA.length;
                                                    } catch (ex) {

                                                    }
                                                    callBackImportFile(finalResponse);
                                                });
                                            } else {
                                                updateExchangeFileInfo(originalRequest, function (finalResponse) {
                                                    finalResponse["VALIDATED_DATA_ERROR_RESULT"] = ERRONEOUS_DATA;
                                                    temp['FILE_COUNT'] = {};
                                                    try {
                                                        temp['FILE_COUNT']['TOTAL_FILE_COUNT'] = count;
                                                        temp["FILE_COUNT"]['SUCCESS_FILE_COUNT'] = finalResponse['SUCCESS_DATA']['EXHF_ID_ARR'].length;
                                                        temp["FILE_COUNT"]['FAILURE_FILE_COUNT'] = ERRONEOUS_DATA.length;
                                                        finalResponse["FILE_COUNT"] = temp["FILE_COUNT"];
                                                    } catch (ex) {

                                                    }
                                                    callBackImportFile(finalResponse);
                                                });
                                            }
                                        } else {
                                            originalRequest['Selected_items'] = files;
                                            updateExchangeFileInfoStaticImportDownload(originalRequest, function (finalResponse) {
                                                finalResponse["VALIDATED_DATA_ERROR_RESULT"] = ERRONEOUS_DATA;
                                                var obj = {};
                                                obj["VALIDATED_DATA_ERROR_RESULT"] = ERRONEOUS_DATA;
                                                obj['FILE_COUNT'] = {};
                                                obj['FILE_COUNT']['TOTAL_FILE_COUNT'] = count;
                                                obj['FILE_COUNT']['SUCCESS_FILE_COUNT'] = response.SAVED_TRANSACTIONS.length;
                                                obj['FILE_COUNT']['FAILURE_FILE_COUNT'] = ERRONEOUS_DATA.length;
                                                resObj = commonFile.prepareMethodResponse("SUCCESS", "", obj, "", "", "", "", "");
                                                return callBackImportFile(resObj);
                                            });
                                        }
                                    } else {
                                        var ERRONEOUS_DATA = response["ERRONEOUS_DATA"] || [];
                                        var obj = {};
                                        obj["VALIDATED_DATA_ERROR_RESULT"] = ERRONEOUS_DATA;
                                        obj['FILE_COUNT'] = {};
                                        obj['FILE_COUNT']['TOTAL_FILE_COUNT'] = count;
                                        obj['FILE_COUNT']['FAILURE_FILE_COUNT'] = ERRONEOUS_DATA.length;
                                        obj['FILE_COUNT']['SUCCESS_FILE_COUNT'] = 0;
                                        resObj = commonFile.prepareMethodResponse("FAILURE", "TRANSACTION FAILED", "", "", "", JSON.stringify(obj), "", "");
                                        callBackImportFile(resObj);
                                    }
                                } else {
                                    var ERRONEOUS_DATA = response["ERRONEOUS_DATA"] || [response[0]] || [];
                                    var obj = {};
                                    obj["VALIDATED_DATA_ERROR_RESULT"] = ERRONEOUS_DATA;
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "TRANSACTION FAILED", "", "", "", JSON.stringify(obj), "", "");
                                    callBackImportFile(resObj);
                                }
                            }
                        }
                    });
                } else {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-", "FFG JSON not found", "", "", "");
                    callBackImportFile(resObj);
                }
            } else {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-", "FFG JSON not found", "", "", "");
                callBackImportFile(resObj);
            }
        });
    });
}


/**
 * 
 * @param fileNamePattern - Pattern defined in FILE_FORMATS array
 */
function formulateFileNames(fileNamePattern, session) {
    fileNamePattern = replaceText(fileNamePattern, '$DATE$', momentInstance().format('DDMMYYYY'));
    fileNamePattern = replaceText(fileNamePattern, '$date$', momentInstance().format('DDMMYYYY'));
    fileNamePattern = replaceText(fileNamePattern, '$D$', momentInstance().format('D'));
    fileNamePattern = replaceText(fileNamePattern, '$Y2$', momentInstance().format('YY'));
    fileNamePattern = replaceText(fileNamePattern, '$Y4$', momentInstance().format('YYYY'));
    fileNamePattern = replaceText(fileNamePattern, '$DM$', momentInstance().format('MM'));
    fileNamePattern = replaceText(fileNamePattern, '$H12$', momentInstance().format('hh'));
    fileNamePattern = replaceText(fileNamePattern, '$H24$', momentInstance().format('HH'));
    fileNamePattern = replaceText(fileNamePattern, '$TM$', momentInstance().format('mm'));
    fileNamePattern = replaceText(fileNamePattern, '$MS$', momentInstance().milliseconds());
    fileNamePattern = replaceText(fileNamePattern, '$S$', momentInstance().format('ss'));
    fileNamePattern = replaceText(fileNamePattern, '$TIME$', momentInstance().format('hhmmss'));
    fileNamePattern = replaceText(fileNamePattern, '$time$', momentInstance().format('hhmmss'));
    fileNamePattern = replaceText(fileNamePattern, '$DDMMYYYY$', momentInstance().format('ddMMyyyy'));
    fileNamePattern = replaceAllOccurance(fileNamePattern, "$SPACE$", ' ');
    if (session != undefined) {
        fileNamePattern = replaceText(fileNamePattern, '$SYSTEM_ID$', session.SYSTEM_ID);
    }
    fileNamePattern = replaceText(fileNamePattern, '$', '');
    return fileNamePattern;
}

function replaceAllOccurance(text, replacementText, toReplace) {
    text = text.split(replacementText).join(toReplace);
    return text;
}

function uploadFile(reqObj, originalRequest, callback) {
    var objLogInfo = reqObj.objLogInfo;
    var type = reqObj.GatewayDetails.SUCCESS_DATA.gateway_type;
    var resObj = "";
    var read_path = reqObj.GatewayDetails.SUCCESS_DATA.read_path;
    var write_path = reqObj.GatewayDetails.SUCCESS_DATA.write_path;
    var selected_files = reqObj.Selected_items || [];
    var SKIP_FTP_DOWNLOAD = false;
    if (!selected_files.length) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120067", "No files selected", "", "", "");
        callback(resObj);
    } else {
        var arrTenantSetupCategory = ['EXG_STORAGE_PATH', 'EXG_STORAGE_PATH_TYPE', 'EXG_STORAGE_PATH_FTP_INFO', 'EXG_PKI_STORE']; // EXG_PKI_STORE
        var tenantSetupCondObj = {
            'client_id': reqObj.objSessionInfo.CLIENT_ID,
            'tenant_id': reqObj.objSessionInfo.TENANT_ID,
            'category': arrTenantSetupCategory
        };
        reqFXDBInstance.GetTableFromFXDB(reqObj.clt_cas_instance, 'tenant_setup', [], tenantSetupCondObj, objLogInfo, async function (tenant_setup_error, result) {
            if (tenant_setup_error) {
                var errorMsg = 'Error While Getting Data From TENANT_SETUP based on Categories like ' + arrTenantSetupCategory.toString();
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120069', errorMsg, tenant_setup_error);
                resObj = commonFile.prepareMethodResponse('FAILURE', '', '', "ERR-EXG-120068", 'Error While Getting Data From Tenenat Setup based on Category..', tenant_setup_error, "", "");
                callback(resObj);
            } else {
                var ftpTypeStoragePathObj = {};
                var StoragePathType = '';
                var storagePath = '';
                var keystoresftpInfo = '';
                /*       //  For Developmet
                      var gateway_config = '{"VALUE":{"ip":"192.168.2.30","port":"2222","username":"tester","password":"password","gateway_type":"SFTP","cert_file_name":"rbs.pem","cert_location_type":"LOCAL"}}';
                      result.rows.push({ setup_json: gateway_config, category: 'EXG_PKI_STORE' }); */
                console.log('result - ' + JSON.stringify(result.rows));
                for (var v = 0; v < result.rows.length; v++) {
                    const element = result.rows[v];
                    console.log('element-' + element);
                    try {
                        if (element.category == 'EXG_STORAGE_PATH') {
                            // setup_json looks like {"NAME":"EXG_STORAGE_PATH","VALUE":"//home//torus//vph//"}
                            storagePath = JSON.parse(element['setup_json'])['VALUE'];
                        } else if (element.category == 'EXG_STORAGE_PATH_TYPE') {
                            // setup_json looks like { "NAME": "EXG_STORAGE_PATH_TYPE", "VALUE": "FTP" }
                            StoragePathType = JSON.parse(element['setup_json'])['VALUE'];
                        } else if (element.category == 'EXG_PKI_STORE') {
                            var encdata = element['setup_json'];
                            if (encdata) {
                                var DecryptedSetupJson = await reqFXDBInstance.GetDecryptedData(reqObj.clt_cas_instance, encdata, objLogInfo);
                                keystoresftpInfo = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(DecryptedSetupJson)])[0]
                            } else {
                                keystoresftpInfo = {}
                            } //  console.log('keystore - ' + JSON.stringify(keystoresftpInfo));
                        } else {
                            // setup_json looks like {"NAME":"EXG_STORAGE_PATH_TYPE","VALUE":{"IP":"192.168.2.203","PORT":"21","USERNAME":"dharani","PASSWORD":"Factory147"}}
                            ftpTypeStoragePathObj = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(element['setup_json'])])[0];
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120070', 'Catch Error While parsing Data from Tenant Setup Json...', error);
                    }
                }
                reqInstanceHelper.PrintInfo(serviceName, 'Storage Path From DB - ' + storagePath, objLogInfo);
                var fileUploadLinuxPathPrefix = 'Upload//' + reqObj.objSessionInfo.TENANT_ID + '//' + reqObj.objSessionInfo.APP_ID + '//' + reqObj.EXFFG_CODE + '//';
                if (storagePath) {
                    storagePath = storagePath + fileUploadLinuxPathPrefix;
                } else {
                    storagePath = fileUploadLinuxPathPrefix;
                }


                var cond = {};
                cond.setup_code = 'EXG_DOWNLOAD_MODE';
                reqSvchelper.GetSetupJson(reqObj.clt_cas_instance, cond, objLogInfo, function (res) {
                    if (res.Status == 'SUCCESS') {
                        if (res.Data.length) {
                            var setup_json = JSON.parse(res.Data[0].setup_json);
                            if (setup_json && setup_json.EXG_DOWNLOAD_MODE == 'LOGICAL') {
                                SKIP_FTP_DOWNLOAD = true;
                            }
                        }
                        reqInstanceHelper.PrintInfo(serviceName, 'After Adding TENANT_ID,APP_ID,FFG_CODE to the Storage Path - ' + storagePath, objLogInfo);
                        read_path = storagePath;
                        var objSuccessData = {};
                        reqInstanceHelper.PrintInfo(serviceName, 'Gateway Type - ' + type, objLogInfo);
                        if (type === "Local") {
                            var fileArr = [];
                            var temp = [];
                            for (var i = 0; i < selected_files.length; i++) {
                                if (selected_files[i]["childfiles"] && selected_files[i]["childfiles"].length > 0) {
                                    for (var indexf in selected_files[i]["childfiles"]) {
                                        temp.push(selected_files[i][childfiles][indexf]["name"]);
                                        temp.sort(function (a, b) {
                                            return a.SORTORDER - b.SORTORDER;
                                        });
                                    }
                                } else {
                                    temp.push(selected_files[i]["name"]);
                                }
                            }
                            selected_files = temp;
                            if (reqObj && !reqObj.arrUploadSuccessFileNames) {
                                reqObj.arrUploadSuccessFileNames = [];
                            }
                            async.forEachOf(selected_files, function (value, key, asyncCallback) {
                                fs.createReadStream(path.join(read_path, value)).pipe(fs.createWriteStream(path.join(write_path, value)));
                                reqObj.arrUploadSuccessFileNames.push(value);
                                asyncCallback();
                            }, function (err) {
                                if (err) {
                                    objSuccessData.strInfo = 'Files Upload Failed';
                                    objSuccessData.processedData = reqObj.arrUploadSuccessFileNames;
                                    resObj = commonFile.prepareMethodResponse("FAILURE", '', objSuccessData, "ERR-EXG-120041", "Error while straming files", "", "", "");
                                    callback(resObj);
                                } else {
                                    objSuccessData.strInfo = 'Files Uploaded Successfully';
                                    objSuccessData.processedData = reqObj.arrUploadSuccessFileNames;
                                    resObj = commonFile.prepareMethodResponse("SUCCESS", 'Files Uploaded Successfully...', objSuccessData, "", "", "", "", "");
                                    callback(resObj);
                                }
                            });
                        } else if (type === "FTP" || type === "SFTP") {
                            // StoragePathType = '';
                            // read_path = "D:\\exchange\\storage\\Upload\\"; // For Local Storage Path Type
                            reqObj.GatewayDetails.SUCCESS_DATA.log_info = objLogInfo;
                            reqInstanceHelper.PrintInfo(serviceName, 'Exg Download Mode - ' + SKIP_FTP_DOWNLOAD, objLogInfo);
                            if (!SKIP_FTP_DOWNLOAD) {
                                if (StoragePathType && StoragePathType == 'FTP' && ftpTypeStoragePathObj && Object.keys(ftpTypeStoragePathObj).length) { // To check whether Setup json has any data or not..
                                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - FTP Storage ', objLogInfo);
                                    reqInstanceHelper.PrintInfo(serviceName, 'FTP Info For Database Storage Path - ' + JSON.stringify(ftpTypeStoragePathObj), objLogInfo);
                                    reqObj.GatewayDetails.SUCCESS_DATA.ftpTypeStoragePathInfo = ftpTypeStoragePathObj;
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - Local Storage ', objLogInfo);
                                    ftpTypeStoragePathObj = {};
                                }
                            }
                            reqObj.GatewayDetails.SUCCESS_DATA.keystoresftpInfo = keystoresftpInfo;
                            reqObj.GatewayDetails.SUCCESS_DATA.SKIP_FTP_DOWNLOAD = SKIP_FTP_DOWNLOAD;
                            // for development Main sftp credentials
                            // reqObj.GatewayDetails.SUCCESS_DATA.gateway_config = '{"ip":"192.168.2.203","port":"22","username":"sftpuser","passphrase":"Welcome@100","cert_file_name":"cert\\rbs.pem","cert_location_type":"SFTP"}'
                            // reqObj.GatewayDetails.SUCCESS_DATA.gateway_type = 'SFTP';
                            // reqObj.GatewayDetails.SUCCESS_DATA.read_path = "D:\\exchange\\storage\\";
                            if (!SKIP_FTP_DOWNLOAD) {
                                var arrExhf_id = []
                                for (var j = 0; j < selected_files.length; j++) {
                                    arrExhf_id.push(selected_files[j].exhf_id)
                                }
                                reqTranDBInstance.GetTableFromTranDB(reqObj.tran_db_instance, 'ex_header_files', { exhf_id: arrExhf_id }, reqObj.objLogInfo, function (res, err) {
                                    if (err) {
                                        reqInstanceHelper.PrintInfo(serviceName, "Error occured query header files - " + err, null);
                                        callback(err);
                                    } else {
                                        for (var i = 0; i < res.length; i++) {
                                            if (res[i].file_content) {
                                                fs.writeFileSync(`${reqObj.GatewayDetails.SUCCESS_DATA.read_path}${res[i].file_name}`, res[i].file_content);
                                            }
                                        }
                                        ftpHelper.uploadLocalToFTP(selected_files, reqObj.GatewayDetails.SUCCESS_DATA, read_path, function (result) {
                                            try {
                                                for (var j = 0; j < selected_files.length; j++) {
                                                    if (fs.existsSync(`${reqObj.GatewayDetails.SUCCESS_DATA.read_path}${selected_files[i].file_name}`)) {
                                                        fs.unlinkSync(`${reqObj.GatewayDetails.SUCCESS_DATA.read_path}${selected_files[i].file_name}`)
                                                    }
                                                }
                                                callback(result);
                                            } catch (error) {
                                                reqInstanceHelper.PrintInfo(serviceName, "Exception occured while deleting source path file - " + error, null);
                                            }
                                        });
                                    }
                                })
                            } else {
                                ftpHelper.uploadLocalToFTP(selected_files, reqObj.GatewayDetails.SUCCESS_DATA, read_path, function (result) {
                                    callback(result);
                                });
                            }
                        } else {
                            // not implemented
                        }
                    } else {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120074', 'Error While Getting EXG_DOWNLOAD_MODE from Platform Setup...', res.Error);
                        resObj = commonFile.prepareMethodResponse('FAILURE', '', '', "ERR-EXG-120074", 'Error While Getting Data From Tenenat Setup based on Category..', res.Error, '', '');
                        callback(resObj);
                    }
                });
            }
        });
    }
}


function getGateWaySetup(reqObj, callback) {
    try {
        var resObj = {};
        var objLogInfo = reqObj.objLogInfo;
        var mHeaders = reqObj.mHeaders;
        var exg_code = reqObj.EXG_CODE ? reqObj.EXG_CODE : reqObj.EXS_ID;
        var exGatewayCond = {
            'exg_code': exg_code,
            'client_id': reqObj.session.CLIENT_ID,
            'app_id': reqObj.session.APP_ID
        };
        if (isLatestPlatformVersion) {
            reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters...', objLogInfo);
            exGatewayCond.TENANT_ID = reqObj.session.TENANT_ID;
        }
        reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_gateways', [], exGatewayCond, objLogInfo, function callbacksearchuser(error, result) {
            if (error) {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120006", "Error while executing getGateWaySetup method", error, "", "");
            } else {
                if (result.rows.length > 0) {
                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", result.rows[0], "", "", "", "", "");
                } else {
                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", "", "ERR-EXG-120007", "No gateway setup found", "", "", "");
                }
            }
            callback(resObj);
        });
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120008", "Exception while executing getGateWaySetup method", error, "", "");
        callback(resObj);
    }
}

function IsJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

function getExportRequestData(reqObj, originalRequest, callBackRequestData) {
    var objLogInfo = reqObj.objLogInfo;
    var resObj = {};
    var is_custom_code_applicable = false;
    var storagePath_main = "";
    var hasSystemID = reqObj.hasSystemID || false;
    if (hasSystemID) {
        storagePath_main = reqObj.gateway_config.write_path;
    }
    getExchangeFileFormatGroups(reqObj, function (exchangeFileFomatGroupResponse) {
        if (exchangeFileFomatGroupResponse.STATUS === "SUCCESS") {
            var data = exchangeFileFomatGroupResponse.SUCCESS_DATA;
            if (data.length > 0) {
                var ffg_json = commonFile.parseJSON(data[0]["ffg_json"]);
                reqObj.ffg_json = ffg_json;
                if (ffg_json == undefined || ffg_json == "") {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120032", "File format group setup not found", "", "", "");
                    return callBackRequestData(resObj);
                }
                var selectedData = "";
                // call wfselct process to fetch details
                getProcessData(reqObj, originalRequest, function (responseProcessData) {
                    if (responseProcessData.STATUS === "SUCCESS") {
                        if (responseProcessData.SUCCESS_DATA.process_status == "SUCCESS" && responseProcessData.SUCCESS_DATA.service_status == "SUCCESS") {
                            if (IsJsonString(responseProcessData.SUCCESS_DATA.data.RowData)) {
                                selectedData = JSON.parse(responseProcessData.SUCCESS_DATA.data.RowData);
                            } else {
                                selectedData = responseProcessData.SUCCESS_DATA.data.RowData;
                            }

                            reqInstanceHelper.PrintInfo(serviceName, 'Eligible Transaction Data Count From WFSelect - ' + selectedData.length, objLogInfo);
                            /* if (reqObj.ffg_json && reqObj.ffg_json.FILE_FORMATS.length && reqObj.ffg_json.FILE_FORMATS[0].SKIP_ELIGIBLE_DATA != "Y") {
                                if (!selectedData.length) {
                                    var errcode = 'ERR-EXG-120085';
                                    var errMsg = 'There is No Eligible Transaction Data Count From WFSelect';
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, errcode, errMsg, '');
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", errcode, errMsg, "", "", "");
                                    return callBackRequestData(resObj);
                                }
                            } */
                            reqObj.tempSelectedData = selectedData;
                            reqObj.orignalSelectedData = selectedData;

                            getProcessedDataFromCustomCode(reqObj, ffg_json, function (processedDataObj) {
                                if (processedDataObj.STATUS === "SUCCESS") {
                                    selectedData = processedDataObj.SUCCESS_DATA.PROCESSED_DATA;
                                    is_custom_code_applicable = true;
                                }
                                var ffgtype = ffg_json.FILE_FORMATS[0]["TYPE"];
                                var project_name = ffg_json.FILE_FORMATS[0]["PROJECT_NAME"] || ffg_json.FILE_FORMATS[0]["project_name"] || "";
                                // For Download Compatibility Start
                                var ffgProjects = ffg_json.FILE_FORMATS[0]["PROJECTS"] || [];
                                // Getting Code Snippet Name - New Case
                                for (var u = 0; u < ffgProjects.length; u++) {
                                    var codesnippetInfo = ffgProjects[0];
                                    if (codesnippetInfo.PROJECT_CASE == 'CREATE_OR_UPDATE') {
                                        project_name = codesnippetInfo.PROJECT_NAME;
                                        project_code = codesnippetInfo.PROJECT_CODE;
                                        break;
                                    }
                                }
                                // For Download Compatibility End
                                if (ffgtype != 'D' && project_name != "") {
                                    is_custom_code_applicable = true;
                                }
                                getstoragepath(reqObj, function (storagePath) {
                                    if (storagePath_main == "") {
                                        storagePath_main = storagePath;
                                    }
                                    commonFile.PrintInfo("Storage path is " + storagePath_main);
                                    var exportData = {
                                        "ruleObj": ffg_json,
                                        "selectedData": selectedData,
                                        "ccrule": processedDataObj.SUCCESS_DATA,
                                        "process": "EXPORT",
                                        "is_custom_code_applicable": is_custom_code_applicable,
                                        "PATH": storagePath_main
                                    };
                                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", exportData, "", "", "", "", "");
                                    callBackRequestData(resObj);
                                });
                            });
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Error in GetWFSelect - ' + responseProcessData.SUCCESS_DATA.data, objLogInfo);
                            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120032", "Error in wfselect", "", "", "");
                            callBackRequestData(resObj);
                        }
                    } else {
                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120033", "Error while calling wfselect", responseProcessData, "", "");
                        callBackRequestData(resObj);
                    }
                });
            } else {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120031", "FFG JSON not found", "", "", "");
                callBackRequestData(resObj);
            }
        } else {
            callBackRequestData(exchangeFileFomatGroupResponse);
        }
    });
}

function getProcessedDataFromCustomCode(reqObj, ffg_json, callBackProcessedData) {
    var resObj = "";
    var resultData = {
        "PROCESSED_DATA": "",
        "PROJECT_CODE": ""
    };
    try {
        var fileFormatGroupObj = {};
        // currently only one file format
        var project_name = ffg_json.FILE_FORMATS[0]["PROJECT_NAME"] || ffg_json.FILE_FORMATS[0]["project_name"] || "";
        var project_code = ffg_json.FILE_FORMATS[0]["PROJECT_CODE"] || ffg_json.FILE_FORMATS[0]["project_code"] || "";
        // For Download Compatibility Start
        var ffgProjects = ffg_json.FILE_FORMATS[0]["PROJECTS"] || [];
        // Getting Code Snippet Name - New Case
        for (var u = 0; u < ffgProjects.length; u++) {
            var codesnippetInfo = ffgProjects[0];
            if (codesnippetInfo.PROJECT_CASE == 'CREATE_OR_UPDATE') {
                project_name = codesnippetInfo.PROJECT_NAME;
                project_code = codesnippetInfo.PROJECT_CODE;
                break;
            }
        }
        // For Download Compatibility End
        var type = ffg_json.FILE_FORMATS[0]["TYPE"] || ffg_json.FILE_FORMATS[0]["type"] || "";

        if (project_name != "" && type != "D") {
            var objCC = require('../../ide_services/' + project_name + '/' + 'prepareData' + ".js");
            objCC["prepareData"](reqObj.tempSelectedData, function (callbackCC) {
                var preparedData = callbackCC;
                resultData["PROCESSED_DATA"] = callbackCC;
                resultData["PROJECT_CODE"] = project_code;
                resultData["PROJECT_NAME"] = project_name;
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", resultData, "", "", "", "", "");
                return callBackProcessedData(resObj);
            });
        } else {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120011", "Error while executing getProcessedDataFromCustomCode method", "", "", "");
            return callBackProcessedData(resObj);
        }

    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120012", "Exception while executing getProcessedDataFromCustomCode method", error, "", "");
        callBackProcessedData(resObj);
    }
}


function getstoragepath(reqObj, callback) {
    var strStoragePath = "";
    try {
        var resObj = {};
        var setupJSONArr = [];
        var Client_id = "";
        if (reqObj.objSessionInfo == undefined) {
            Client_id = reqObj.session.CLIENT_ID;
        } else {
            Client_id = reqObj.objSessionInfo.CLIENT_ID;
        }
        reqFXDBInstance.GetTableFromFXDB(reqObj.clt_cas_instance, 'tenant_setup', [], {
            'client_id': Client_id,
            'tenant_id': reqObj.tenant_id || "0",
            'category': 'EXG_STORAGE_PATH'
        }, reqObj.objLogInfo, function (error, result) {
            if (!error) {
                if (result.rows.length > 0) {
                    var strStoragePath = JSON.parse(result.rows[0]["setup_json"])["VALUE"];
                }
            }
            callback(strStoragePath);
        });
    } catch (error) {
        callback(strStoragePath);
    }
}

function getExchangeFileFormatGroups(reqObj, callBackExchangeFileFormatGroups) {
    var resObj = {};
    try {
        var fileFormatGroupObj = {};
        reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_file_format_groups ', [], {
            'EXFFG_CODE': reqObj.EXFFG_CODE,
            'app_id': reqObj.session.APP_ID
        }, reqObj.objLogInfo, function (error, result) {
            if (error) {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120013", "Error while executing getExchangeFileFormatGroups method", error, "", "");
            } else {
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", result.rows, "", "", "", "", "");
            }
            callBackExchangeFileFormatGroups(resObj);
        });
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120014", "Exception while executing getExchangeFileFormatGroups method", error, "", "");
        callBackExchangeFileFormatGroups(resObj);
    }
}


function getSystemGateways(reqObj, callBackSystemGateways) {
    var resObj = {};
    try {
        if (reqObj.tenant_id == undefined) {
            tenant_id = reqObj.mHeaders.routingkey.split("~")[2].split("-")[1];
        } else {
            tenant_id = reqObj.tenant_id;
        }
        if (reqObj.EXS_ID == undefined || reqObj.EXS_ID == "") {
            reqObj.EXS_ID = reqObj.session.S_ID;
        }
        var queryproj = {
            'source_s_id': reqObj.session.S_ID,
            'dst_s_id': reqObj.EXS_ID,
            'client_id': reqObj.session.CLIENT_ID,
            'app_id': reqObj.session.APP_ID,
            'tenant_id': tenant_id
        };
        if (reqObj.EXFFG_CODE != undefined || reqObj.EXFFG_CODE != "") {
            queryproj["exffg_code"] = reqObj.EXFFG_CODE;
        }
        reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_systems ', [], queryproj, reqObj.objLogInfo, function (error, result) {
            if (error) {
                reqInstanceHelper.PrintInfo(serviceName, 'Error while getting system gateways ' + JSON.stringify(error), {});
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "", error, "", "");
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'System Gateways result ' + JSON.stringify(result.rows), {});
                if (result.rows.length > 0) {
                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", result.rows[0], "", "", "", "", "");
                } else {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "", "", "", "");
                }
            }
            callBackSystemGateways(resObj);
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Exception while calling system gateways' + JSON.stringify(error), {});
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "", error, "", "");
        callBackSystemGateways(resObj);
    }
}


function updateExchangeFileInfo(reqObj, callBackUpdateExchangeFileInfo) {
    var objLogInfo = reqObj.objLogInfo;
    var headers = reqObj.headers;
    // Used to Hold the Insert Process for particular time which can be obtained from the Input Params and Mainly used 
    var DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC = (reqObj && reqObj.SERVICE_PARAMS && reqObj.SERVICE_PARAMS.DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC && reqObj.SERVICE_PARAMS.DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC * 1000) || 0;  // Converting ito Milliseconds
    reqInstanceHelper.PrintInfo(serviceName, 'DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC - ' + DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC, objLogInfo);
    var EXH_ID = "";
    var EXF_ID_ARR = [];
    var EXHF_ID_ARR = [];
    var EXO_ID_ARR = [];
    var resObj = {};
    var filearray = [];
    var FILE_COUNT = "";
    var tran_db_instance = reqObj.tran_db_instance;
    var IS_FILE_FROM_CLIENT = reqObj.IS_FILE_FROM_CLIENT;
    var recoveryInfo = {
        EX_HEADER_INSERT: {
            STATUS: false,
            DATA: []
        },
        EX_HEADER_FILES_INSERT: {
            STATUS: false,
            DATA: []
        },
        TMP_EX_HEADER_FILES_DELETE: {
            STATUS: false,
            DATA: []
        },
    };
    var prct_id = reqObj['prct_id'];
    var NEED_TRN_INSERT = reqObj.NEED_TRN_INSERT || false;
    var fileDownloadOnly = reqObj.fileDownloadOnly || false;// This Paramter is used only in ExgDownloadAutomation API...
    var SAVE_TRAN_DET = reqObj.save_tran;
    var dt_code = "";
    var dtt_code = "";
    var ffg_json = "";
    var primary_col = reqObj.PRIMARY_COLUMN;
    if (reqObj.ffg_json != undefined) {
        ffg_json = reqObj.ffg_json.FILE_FORMATS[0]["RECORD_FORMATS"][0] || "";
    }
    if (reqObj.DT_CODE && reqObj.DT_CODE) {
        dt_code = reqObj.DT_CODE;
    } else {
        dt_code = ffg_json["DT_Code"] || "";
    }
    if (reqObj.DTT_CODE && reqObj.DTT_CODE) {
        dtt_code = reqObj.DTT_CODE;
    } else {
        dtt_code = ffg_json["DTT_Code"] || "";
    }
    var ex_header_files_arr = [];
    setTimeout(function (params) {
        async.series([
            function (asyncCallBack) {
                var source_sid = "";
                var dest_sid = "";
                source_sid = reqObj.session.S_ID || "";
                dest_sid = reqObj.DST_ID || reqObj.EXS_ID;
                var file_path = reqObj.gateway_config.read_path;
                if (reqObj.gateway_config != undefined) {
                    if (reqObj.gateway_config.write_path != undefined && reqObj.gateway_config.write_path != "" && reqObj.FromDownload == undefined) {
                        file_path = reqObj.gateway_config.write_path;
                    }
                    if (file_path == "" && reqObj['storagePath'] != undefined) {
                        file_path = reqObj['storagePath'];
                    }
                }
                if (IS_FILE_FROM_CLIENT) {
                    file_path = 'FROM_CLIENTSIDE'; // Updating the File Path if the Download Mode is Client Side
                }
                var ex_header_arr = [{
                    "EXFFG_CODE": reqObj.EXFFG_CODE,
                    "EXG_CODE": reqObj.EXG_CODE,
                    "FILE_PATH": file_path,
                    "SRC_ID": source_sid,
                    "DST_ID": dest_sid,
                    "CREATED_BY": objLogInfo.USER_ID,
                    "VERSION_NO": 1
                }];
                if (isLatestPlatformVersion) {
                    ex_header_arr[0].APP_ID = reqObj.session.APP_ID;
                    ex_header_arr[0].TENANT_ID = reqObj.session.TENANT_ID;
                }
                if (reqObj.FROM_UPDATE_FILES) {
                    asyncCallBack();
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'EX_HEADER Insert Process Started for PRCT_ID - ' + prct_id, objLogInfo);
                    reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, "EX_HEADER", ex_header_arr, objLogInfo, null, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintInfo(serviceName, 'Ex_Header Insert Failed...', objLogInfo);
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120065', 'Error While Inserting Data into EX_HEADER...', error);
                            recoveryInfo.EX_HEADER_INSERT.DATA = ex_header_arr;
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'EX_HEADER Insert Process Completed Successfully', objLogInfo);
                            if (result.length) {
                                EXH_ID = result[0]["exh_id"];
                            }
                            recoveryInfo.EX_HEADER_INSERT.STATUS = true; // Updating as true after successful EX_HEADER insert process
                        }
                        asyncCallBack();
                    });
                }
            },
            function (asyncCallBack) {
                insertexheader()
                async function insertexheader() {
                    var files = reqObj.FILES;
                    var ex_files_arr = [];
                    for (var index = 0; index < files.length; index++) {
                        if (files[index] != null) {
                            if (files[index].name != "" && files[index].name != null) {
                                var ex_files_obj = {
                                    "FILE_NAME": files[index].name,
                                    "FILE_STATUS": files[index].STATUS, //STATUS - DOWNLOADED
                                    "EXH_ID": EXH_ID,
                                    "CREATED_BY": objLogInfo.USER_ID,
                                    "PRCT_ID": prct_id,
                                    "COMMENT_TYPE": 'INFO'
                                };
                                var ftpcon = JSON.parse(reqObj.gateway_config.gateway_config);
                                ftpcon.gateway_type = reqObj.gateway_config.gateway_type
                                var filecontent = await ftpHelper.GetFTPFileBufferData(ftpcon, `${reqObj.gateway_config.read_path}${files[index].name}`, objLogInfo)
                                if (filecontent) {
                                    ex_files_obj.FILE_CONTENT = filecontent
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'unable to read file or file content is empty', objLogInfo);
                                }
                                if (!reqObj.SKIP_FTP_DOWNLOAD) {
                                    ex_files_obj.FILE_CONTENT = fs.readFileSync(`${reqObj.storagePath}${files[index].name}`);
                                    fs.unlinkSync(`${reqObj.storagePath}${files[index].name}`);
                                }
                                if (ex_files_obj.FILE_STATUS == 'CREATED') {
                                    ex_files_obj.COMMENT_TEXT = 'FILE CREATED SUCCESSFULLY';
                                } else {
                                    ex_files_obj.COMMENT_TEXT = 'FILE DOWNLOADED SUCCESSFULLY';
                                }
                                if (isLatestPlatformVersion) {
                                    ex_files_obj.APP_ID = reqObj.session.APP_ID;
                                    ex_files_obj.TENANT_ID = reqObj.session.TENANT_ID;
                                    ex_files_obj.FILE_SIZE = files[index].size;
                                }
                                ex_files_arr.push(ex_files_obj);
                            }
                        }
                    }
                    if (reqObj.FROM_UPDATE_FILES) {
                        EXHF_ID_ARR = reqObj.EXHF_ID_ARR;
                        asyncCallBack();
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'EX_HEADER_FILES Insert Process Started for PRCT_ID - ' + prct_id, objLogInfo);
                        reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, "EX_HEADER_FILES", ex_files_arr, objLogInfo, null, function (result, error) {
                            if (error) {
                                reqInstanceHelper.PrintInfo(serviceName, 'EX_HEADER_FILES Insert Failed...', objLogInfo);
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120064', 'Error While Inserting Data into EX_HEADER_FILES...', error);
                                recoveryInfo.EX_HEADER_FILES_INSERT.DATA = ex_files_arr;
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'EX_HEADER_FILES Insert Process Completed Successfully', objLogInfo);
                                EXHF_ID_ARR = result;
                                recoveryInfo.EX_HEADER_FILES_INSERT.STATUS = true; // Updating as true after successful EX_HEADER_FILES insert process
                            }
                            asyncCallBack();
                        });
                    }
                }
            },
            function (asyncCallBack) {
                var ex_object_details_arr = [];
                if (EXHF_ID_ARR !== "" && EXHF_ID_ARR.length > 0) {
                    for (var index = 0; index < EXHF_ID_ARR.length; index++) {
                        if (SAVE_TRAN_DET) {
                            for (var i = 0; i < SAVE_TRAN_DET.length; i++) {
                                if (SAVE_TRAN_DET[i]["FileName"] == EXHF_ID_ARR[index]["file_name"]) {
                                    if (SAVE_TRAN_DET[i]["SaveTranResult"]) {
                                        if (SAVE_TRAN_DET[i]["SaveTranResult"]["STATUS"] == "SUCCESS") {
                                            var saveTranResult = SAVE_TRAN_DET[i]["SaveTranResult"]["SUCCESS_DATA"];
                                            if (saveTranResult.service_status == "SUCCESS") {
                                                var lastInsertIDS = saveTranResult.data.LAST_INSERT;
                                                for (var j = 0; j < lastInsertIDS.length; j++) {
                                                    if (EXHF_ID_ARR[index]["exhf_id"] != undefined && lastInsertIDS[j]["trn_id"] != undefined) {
                                                        var ex_object_details = {
                                                            "TRN_ID": lastInsertIDS[j]["trn_id"],
                                                            "DT_CODE": dt_code || "",
                                                            "DTT_CODE": dtt_code || "",
                                                            "EXHF_ID": EXHF_ID_ARR[index]["exhf_id"],
                                                            "TS_ID": lastInsertIDS[j]["ts_id"],
                                                            "CREATED_BY": objLogInfo.USER_ID,
                                                            "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo),
                                                            "VERSION_NO": 1
                                                        };
                                                        ex_object_details_arr.push(ex_object_details);

                                                        filearray.push({
                                                            "SUCCESS_FILE_NAME": SAVE_TRAN_DET[i]["FileName"]
                                                        });
                                                    }
                                                }
                                            }
                                        } else {
                                            filearray.push({
                                                "FAILURE_FILE_NAME": SAVE_TRAN_DET[i]["FileName"],
                                                "FAILURE_FILE_ERROR": SAVE_TRAN_DET[i]["Error"]
                                            });
                                        }
                                    } else {
                                        // From Dynamic File creation 
                                        var primary_col_value = (SAVE_TRAN_DET[i][primary_col] || SAVE_TRAN_DET[i]['trn_id']);
                                        var tsID = SAVE_TRAN_DET[i]['ts_id'];
                                        if (EXHF_ID_ARR[index]["exhf_id"] && primary_col_value && tsID) {
                                            var ex_object_details = {
                                                "TRN_ID": primary_col_value,
                                                "DT_CODE": dt_code || "",
                                                "DTT_CODE": dtt_code || "",
                                                "EXHF_ID": EXHF_ID_ARR[index]["exhf_id"],
                                                "TS_ID": SAVE_TRAN_DET[i]["ts_id"],
                                                "CREATED_BY": objLogInfo.USER_ID,
                                                "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo),
                                                "VERSION_NO": 1
                                            };
                                            ex_object_details_arr.push(ex_object_details);

                                            filearray.push({
                                                "SUCCESS_FILE_NAME": SAVE_TRAN_DET[i]["FileName"]
                                            });
                                        }
                                    }
                                    FILE_COUNT = SAVE_TRAN_DET[i]["FILE_COUNT"];
                                }
                            }
                        }
                    }
                    if (reqObj.NEED_TRN_INSERT && ex_object_details_arr.length) {
                        reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, "EX_FILE_TRANS", ex_object_details_arr, objLogInfo, null, function (result, error) {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            } else {
                                ex_header_files_arr = result;
                            }
                            asyncCallBack();
                        });
                    } else {
                        asyncCallBack();
                    }
                } else {
                    asyncCallBack();
                }
            },
            function (asyncCallBack) {
                if (prct_id === undefined || prct_id === "") {
                    asyncCallBack();
                } else {
                    // LOG ENTRY TO BE CONSIDERED FOR SUCCESS AND FAILURE LIST 
                    // tempSuccessPrctid, tempFailurePrctid
                    // CODE TO BE INCLUDE LATER 
                    reqInstanceHelper.PrintInfo(serviceName, 'Temp Table Deleting started for PRCT_ID - ' + prct_id, objLogInfo);
                    var recoveryMsg = '';
                    reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, "delete from tmp_ex_header_files where prct_id = '" + prct_id + "'", objLogInfo, function (result, err) {
                        if (err) {
                            reqInstanceHelper.PrintInfo(serviceName, 'TMP_EX_HEADER_FILES Delete Process Failed So, Adding Prct_ID in global.Exg_Down_DB_Insert_Failed_prct_ID', objLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'global.Exg_Down_DB_Insert_Failed_prct_ID Count - ' + global.Exg_Down_DB_Insert_Failed_prct_ID.length, objLogInfo);
                            AddTmpExHFInsertFailedPrctID(prct_id);
                            reqInstanceHelper.PrintInfo(serviceName, 'global.Exg_Down_DB_Insert_Failed_prct_ID Count - ' + global.Exg_Down_DB_Insert_Failed_prct_ID.length, objLogInfo);
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120063', 'Error While Deleting TMP_EX_HEADER_FILES Data...', err);

                            if (!recoveryInfo.EX_HEADER_INSERT.STATUS && !recoveryInfo.EX_HEADER_FILES_INSERT.STATUS) {
                                recoveryMsg = 'Error While Doing Delete Process in TMP_EX_HEADER_FILES and Insert Process for EX_HEADER and EX_HEADER_FILES';
                            } else if (!recoveryInfo.EX_HEADER_INSERT.STATUS) {
                                recoveryMsg = 'Error While Doing Delete Process in TMP_EX_HEADER_FILES and Insert Process for EX_HEADER Only';
                            } else {
                                recoveryMsg = 'Error While Doing Delete Process in TMP_EX_HEADER_FILES and Insert Process for EX_HEADER_FILES Only';
                            }
                            resObj = commonFile.prepareMethodResponse('FAILURE', '', recoveryInfo, 'ERR-EXG-1200299', recoveryMsg, err, '', '');
                            callBackUpdateExchangeFileInfo(resObj);
                        } else if (!recoveryInfo.EX_HEADER_INSERT.STATUS || !recoveryInfo.EX_HEADER_FILES_INSERT.STATUS) {
                            recoveryInfo.TMP_EX_HEADER_FILES_DELETE.STATUS = true; // Updating as true after successful TMP_EX_HEADER_FILES DELETE process
                            if (!recoveryInfo.EX_HEADER_INSERT.STATUS && !recoveryInfo.EX_HEADER_FILES_INSERT.STATUS) {
                                recoveryMsg = 'Error While Doing Insert Process for EX_HEADER and EX_HEADER_FILES';
                            } else if (!recoveryInfo.EX_HEADER_INSERT.STATUS) {
                                recoveryMsg = 'Error While Doing Insert Process for EX_HEADER Only';
                            } else {
                                recoveryMsg = 'Error While Doing Insert Process for EX_HEADER_FILES Only';
                            }
                            resObj = commonFile.prepareMethodResponse('FAILURE', '', recoveryInfo, 'ERR-EXG-120080', recoveryMsg, err, '', '');
                            callBackUpdateExchangeFileInfo(resObj);
                        } else {
                            recoveryInfo.TMP_EX_HEADER_FILES_DELETE.STATUS = true; // Updating as true after successful TMP_EX_HEADER_FILES DELETE process
                            reqInstanceHelper.PrintInfo(serviceName, 'Temp table "tmp_ex_header_files" deleted successfully', objLogInfo);
                            asyncCallBack();
                        }
                    });
                }
            }
        ], function (error, result) {
            if (error) {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120020", "Error while executing updateExchangeFileInfo method", error, "", "");
            } else {
                var data = {
                    "EXH_ID": EXH_ID,
                    "EXF_ID_ARR": EXF_ID_ARR,
                    "EXHF_ID_ARR": EXHF_ID_ARR,
                    "EXO_ID_ARR": EXO_ID_ARR,
                    "FILE_COUNT": FILE_COUNT,
                    "FILES": filearray
                };
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", data, "", "", "", "", "");
            }
            callBackUpdateExchangeFileInfo(resObj);
        });
    }, DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC);

}

function AddFilesToRedisSession(params, AddFilesToRedisSessionCB) {
    try {
        /*  params Should contains
         - objLogInfo {}
         - DB  
         - TTL  
         - TENANT_ID  ''
         - PROCESS  ''
         - APP_ID ''
         - FILES [{}]
         - EXFFG_CODE / FFG_CODE ''
         Callback
         AddFilesToRedisSessionCB(error,result);
         */
        var finalResult = {};
        var objLogInfo = params.objLogInfo;
        var process = params.PROCESS;
        var db = params.DB;
        var ttl = params.TTL || 111; // If there is no TTL passed as parameter
        var tenant_id = params.TENANT_ID;
        var app_id = params.APP_ID;
        var exffg_code = params.EXFFG_CODE;
        var files = params.FILES;
        reqRedisInstance.GetRedisConnectionwithIndex(db, function (error, redis_instance) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120081', 'Error While Getting Redis Connection in Redis DB - ' + db, error);
                AddFilesToRedisSessionCB(error, null);
            }
            else {
                var redisKey = '';
                var redisKeyValue = {};
                if (files.length) {
                    reqInstanceHelper.PrintInfo(serviceName, 'File Count - ' + files.length, objLogInfo);
                    async.forEachOfSeries(files, function (FileInfo, i, CB) {
                        try {
                            var fileName = FileInfo.file_name || FileInfo.name;
                            redisKey = tenant_id + '_' + app_id + '_' + exffg_code + '_' + fileName;
                            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' is going to Add in to the Redis DB - ' + db, objLogInfo);
                            redisKeyValue.FILE_NAME = redisKey;
                            redisKeyValue.PROCESS = process;
                            redisKeyValue.DATE_AND_TIME = new Date().toLocaleString();
                            // redis_instance.set(redisKey, JSON.stringify(redisKeyValue), 'EX', ttl, function (error, result) {
                            reqRedisInstance.RedisSetNx(redis_instance, redisKey, JSON.stringify(redisKeyValue), ttl, function (error, result) {
                                // console.log(error, result);
                                if (result) {
                                    reqInstanceHelper.PrintInfo(serviceName, redisKey + ' is Added into the Redis DB - ' + db, objLogInfo);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, redisKey + ' is Not Added into the Redis DB - ' + db, objLogInfo);
                                }
                                CB();
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120083', 'Catch Error in AddFilesToRedisSession - async.forEachOfSeries()...', error);
                            CB();
                        }
                    }, function (error, result) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Adding File Names into the Redis ' + db + ' Session Process is Successfully Completed...', objLogInfo);
                        AddFilesToRedisSessionCB(null, finalResult);
                    });
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'There is No File Count For Adding Files into the Redis Session - ' + db, objLogInfo);
                    AddFilesToRedisSessionCB(null, finalResult);
                }

            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120082', 'Catch Error in AddFilesToRedisSession()...', error);
        AddFilesToRedisSessionCB(error, null);
    }
}


function RemoveFileNameFromRedisSession(params, RemoveFileNameFromRedisSessionCB) {
    try {
        /*  params Should contains
         - objLogInfo {}
         - TENANT_ID  ''
         - APP_ID ''
         - DB 7
         - FILES [{}]
         - EXFFG_CODE / FFG_CODE ''
         Callback
         RemoveFileNameFromRedisSessionCB(error,result);
         */
        var finalResult = {};
        var objLogInfo = params.objLogInfo;
        var tenant_id = params.TENANT_ID;
        var app_id = params.APP_ID;
        var db = params.DB || 3;
        var exffg_code = params.EXFFG_CODE;
        var files = params.FILES;
        reqRedisInstance.GetRedisConnectionwithIndex(db, function (error, redis_instance) {
            // reqRedisInstance.GetRedisConnection(function (error, redis_instance) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120062', 'Error While Getting Redis Connection...', error);
                RemoveFileNameFromRedisSessionCB(error, null);
            }
            else {
                var redisKey = '';
                var redisKeyValue = {};
                if (files.length) {
                    reqInstanceHelper.PrintInfo(serviceName, 'File Count - ' + files.length, objLogInfo);
                    async.forEachOfSeries(files, function (FileInfo, i, CB) {
                        try {
                            var fileName = FileInfo.file_name || FileInfo.name;
                            redisKey = tenant_id + '_' + app_id + '_' + exffg_code + '_' + fileName;
                            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' is going to delete from the Redis...', objLogInfo);
                            reqRedisInstance.delRediskey(redis_instance, redisKey, function (result) {
                                console.log(result);
                                if (result == "SUCCESS") {
                                    console.log('Key value Deleted');
                                    reqInstanceHelper.PrintInfo(serviceName, redisKey + ' is Deleted from the Redis...', objLogInfo);
                                    CB();
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, redisKey + ' is Not Deleted from the Redis...', objLogInfo);
                                    CB();
                                }
                            });
                        } catch (error) {
                            console.log('trying to delete redis key value - ' + error)
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120061', 'Catch Error in RemoveFileNameFromRedisSession - async.forEachOfSeries()...', error);
                            CB();
                        }
                    }, function (error, result) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Clearing File Names from the Redis Session Process is Successfully Completed...', objLogInfo);
                        RemoveFileNameFromRedisSessionCB(null, finalResult);
                    });
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'There is No File Count For Clearing From Redis Session...', objLogInfo);
                    RemoveFileNameFromRedisSessionCB(null, finalResult);
                }

            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120060', 'Catch Error in RemoveFileNameFromRedisSession()...', error);
        RemoveFileNameFromRedisSessionCB(error, null);
    }
}

Array.prototype.contains = function (v) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === v) return true;
    }
    return false;
};


Array.prototype.unique = function () {
    var arr = [];
    for (var i = 0; i < this.length; i++) {
        if (!arr.includes(this[i])) {
            arr.push(this[i]);
        }
    }
    return arr;
};


function updateExchangeFileInfoPathImport(reqObj, callBackUpdateExchangeFileInfo) {
    var SAVE_TRAN_DET = reqObj.save_tran;
    var files = reqObj.FILES;
    var headers = reqObj.headers;
    var ex_header_files_arr = [];
    var resultobj;
    var filearray = [];
    var FILE_COUNT;
    var EXHF_ID_ARR = [];
    var prct_id = reqObj.objLogInfo.PROCESS_INFO.PRCT_ID ? reqObj.objLogInfo.PROCESS_INFO.PRCT_ID : reqObj.objLogInfo.PRCT_ID;
    var ex_files_arr = [];
    var tran_db_instance = reqObj['tran_db_instance'];
    reqObj['NEED_TRN_INSERT'] = true;
    async.series([
        function (asyncCallBack) {
            for (var index = 0; index < files.length; index++) {
                var ex_files_obj = {
                    "FILE_STATUS": files[index].file_status,
                    "EXHF_ID": files[index].exhf_id,
                };
                ex_files_arr.push(ex_files_obj);
            }
            for (var index = 0; index < files.length; index++) {
                var ex_files_obj = {
                    "file_name": files[index].name,
                    "exhf_id": files[index].exhf_id,
                };
                EXHF_ID_ARR.push(ex_files_obj);
            }
            var headerarr = [];
            for (var i = 0; i < ex_files_arr.length; i++) {
                var exheaderidObj = {
                    "file_id": ex_files_arr[i].EXHF_ID,
                    "prct_id": prct_id + "_temp",
                    "status": ex_files_arr[i]['FILE_STATUS'] || '',
                    "CREATED_BY": reqObj.objLogInfo.LOGIN_NAME,
                    "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, reqObj.objLogInfo)
                };
                headerarr.push(exheaderidObj);
            }
            reqTranDBInstance.InsertBulkTranDB(reqObj.tran_db_instance, "TMP_EX_HEADER_FILES", headerarr, reqObj.objLogInfo, null, function (result, error) {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                } else {
                    var statusContents = [];
                    for (var temp of ex_files_arr) {
                        statusContents.push(temp['FILE_STATUS']);
                    }
                    statusContents = statusContents.filter(function (item, i, ar) {
                        return ar.indexOf(item) === i;
                    });
                    async.forEachOfSeries(statusContents, function (value, key, callBackTempAsync) {
                        var query = "update ex_header_files set modified_by = '" + reqObj.objLogInfo.USER_ID + "' , modified_date = '" + reqDateFormatter.GetTenantCurrentDateTime(headers, reqObj.objLogInfo) + "' , file_status = '" + value + "' where cast(exhf_id as varchar(264)) IN (select file_id from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "' and status = '" + value + "')";
                        reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                            if (error) {
                                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                asyncCallBack(resObj);
                            } else {
                                callBackTempAsync();
                            }
                        });
                    }, function (error) {
                        if (error) {
                            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                            asyncCallBack(resObj);
                        } else {
                            var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "'";
                            reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                                if (error) {
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                    asyncCallBack(resObj);
                                } else {
                                    asyncCallBack();
                                }
                            });
                        }
                    });
                }
            });
        },
        function (asyncCallBack) {
            var ex_object_details_arr = [];
            if (EXHF_ID_ARR !== "" && EXHF_ID_ARR.length > 0) {
                for (var index = 0; index < EXHF_ID_ARR.length; index++) {
                    if (SAVE_TRAN_DET !== undefined) {
                        for (var i = 0; i < SAVE_TRAN_DET.length; i++) {
                            if (SAVE_TRAN_DET[i]["name"] == EXHF_ID_ARR[index]["file_name"]) {
                                if (SAVE_TRAN_DET[i]["file_status"] == "SUCCESS") {
                                    for (var j = 0; j < SAVE_TRAN_DET[i]['TS'].length; j++) {
                                        if (EXHF_ID_ARR[index]["exhf_id"] != undefined && SAVE_TRAN_DET[i]["trn_id"] != undefined) {
                                            var ex_object_details = {
                                                "TRN_ID": SAVE_TRAN_DET[i]['TS'][j]["trn_id"],
                                                "DT_CODE": "",
                                                "DTT_CODE": "",
                                                "EXHF_ID": SAVE_TRAN_DET[i]["EXHF_ID"],
                                                "TS_ID": SAVE_TRAN_DET[i]['TS'][j]["ts_id"],
                                                "CREATED_BY": reqObj.objLogInfo.USER_ID,
                                                "VERSION_NO": 1
                                            };
                                            ex_object_details_arr.push(ex_object_details);
                                        }
                                    }
                                    filearray.push({
                                        "SUCCESS_FILE_NAME": SAVE_TRAN_DET[i]["FileName"]
                                    });
                                } else {
                                    filearray.push({
                                        "FAILURE_FILE_NAME": SAVE_TRAN_DET[i]["FileName"],
                                        "FAILURE_FILE_ERROR": SAVE_TRAN_DET[i]["Error"]
                                    });
                                    FILE_COUNT = SAVE_TRAN_DET[i]["FILE_COUNT"];
                                }
                                FILE_COUNT = SAVE_TRAN_DET[i]["FILE_COUNT"];
                            }
                        }
                    }
                    if (EXHF_ID_ARR.length == ex_object_details_arr.length) {
                        break;
                    }
                }
                if (reqObj.NEED_TRN_INSERT) {
                    reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, "EX_FILE_TRANS", ex_object_details_arr, reqObj.objLogInfo, null, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                        } else {
                            ex_header_files_arr = result;
                        }
                        asyncCallBack();
                    });
                } else {
                    asyncCallBack();
                }
            } else {
                asyncCallBack();
            }
        }
    ], function (error, result) {
        if (error) {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120020", "Error while executing updateExchangeFileInfo method", error, "", "");
        } else {
            resultobj = {
                FILE_COUNT: FILE_COUNT,
                FILES: filearray,
                FROM_STATIC: true
            };
            resObj = commonFile.prepareMethodResponse("SUCCESS", "", resultobj, "", "", "", "", "");
        }
        callBackUpdateExchangeFileInfo(resObj);
    });
}

function updateExchangeFileInfoPath(reqObj, callBackUpdateExchangeFileInfo) {
    var EXH_ID = "";
    var EXF_ID_ARR = [];
    var EXHF_ID_ARR = [];
    var EXO_ID_ARR = [];
    var resObj = {};
    var dt_code = "";
    var dtt_code = "";
    var tran_db_instance = reqObj.tran_db_instance;
    var headers = reqObj.headers;
    var ffg_json = reqObj.ffg_json.FILE_FORMATS[0]["RECORD_FORMATS"][0];
    var save_tran = reqObj.save_tran;
    var NEED_TRN_INSERT = reqObj.NEED_TRN_INSERT || false;
    var SAVE_TRAN_DET = reqObj.save_tran;
    var ex_header_files_arr = [];

    if (reqObj.DT_CODE != undefined && reqObj.DT_CODE != "") {
        dt_code = reqObj.DT_CODE;
    } else {
        dt_code = ffg_json["DT_Code"] || "";
    }

    if (reqObj.DTT_CODE != undefined && reqObj.DTT_CODE != "") {
        dtt_code = reqObj.DTT_CODE;
    } else {
        dtt_code = ffg_json["DTT_Code"] || "";
    }
    async.series([
        function (asyncCallBack) {
            var files = reqObj.Selected_items;
            var ex_files_arr = [];
            for (var index = 0; index < files.length; index++) {
                var ex_files_obj = {
                    "FILE_STATUS": files[index].status,
                    "EXHF_ID": files[index].file_id,
                };
                ex_files_arr.push(ex_files_obj);
            }
            var ex_headerfilearr = [];
            var prct_id = reqObj.objLogInfo.PROCESS_INFO.PRCT_ID ? reqObj.objLogInfo.PROCESS_INFO.PRCT_ID : reqObj.objLogInfo.PRCT_ID;
            for (var i = 0; i < ex_files_arr.length; i++) {
                var exheaderfileObj = {
                    "file_id": ex_files_arr[i].EXHF_ID,
                    "prct_id": prct_id + "_temp",
                    "status": ex_files_arr[i]['FILE_STATUS'] || '',
                    "CREATED_BY": reqObj.objLogInfo.LOGIN_NAME,
                    "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, reqObj.objLogInfo)
                };
                ex_headerfilearr.push(exheaderfileObj);
            }
            reqTranDBInstance.InsertBulkTranDB(reqObj.tran_db_instance, "TMP_EX_HEADER_FILES", ex_headerfilearr, reqObj.objLogInfo, null, function (result, error) {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                } else {
                    var statusContents = [];
                    for (var temp of ex_files_arr) {
                        statusContents.push(temp['FILE_STATUS']);
                    }
                    statusContents = statusContents.filter(function (item, i, ar) {
                        return ar.indexOf(item) === i;
                    });
                    var query = "update ex_header_files set modified_by = '" + reqObj.objLogInfo.USER_ID + "', modified_date = '" + reqDateFormatter.GetTenantCurrentDateTime(headers, reqObj.objLogInfo) + "' , file_status = 'UPDATED' where cast(exhf_id as varchar(264)) IN (select file_id from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "' and status = 'DOWNLOADED')";
                    reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                        if (error) {
                            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                            asyncCallBack(resObj);
                        } else {
                            var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "'";
                            reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                                if (error) {
                                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                    asyncCallBack(resObj);
                                } else {
                                    reqTranDBInstance.Commit(reqObj.tran_db_instance, true, function () {
                                        asyncCallBack();
                                    });
                                }
                            });
                        }
                    });
                }
            });
        },
        function (asyncCallBack) {
            var ex_object_details_arr = [];
            if (EXHF_ID_ARR !== "" && EXHF_ID_ARR.length > 0) {
                for (var index = 0; index < EXHF_ID_ARR.length; index++) {
                    if (SAVE_TRAN_DET !== undefined) {
                        for (var i = 0; i < SAVE_TRAN_DET.length; i++) {
                            if (SAVE_TRAN_DET[i]["FileName"] == EXHF_ID_ARR[index]["file_name"]) {
                                if (SAVE_TRAN_DET[i]["SaveTranResult"]["STATUS"] == "SUCCESS") {
                                    var saveTranResult = SAVE_TRAN_DET[i]["SaveTranResult"]["SUCCESS_DATA"];
                                    if (saveTranResult.service_status == "SUCCESS") {
                                        var lastInsertIDS = saveTranResult.data.LAST_INSERT;
                                        for (var j = 0; j < lastInsertIDS.length; j++) {
                                            if (EXHF_ID_ARR[index]["exhf_id"] != undefined && lastInsertIDS[j]["trn_id"] != undefined) {
                                                var ex_object_details = {
                                                    "TRN_ID": lastInsertIDS[j]["trn_id"],
                                                    "DT_CODE": dt_code || "",
                                                    "DTT_CODE": dtt_code || "",
                                                    "EXHF_ID": EXHF_ID_ARR[index]["exhf_id"],
                                                    "TS_ID": lastInsertIDS[j]["ts_id"],
                                                    "CREATED_BY": reqObj.objLogInfo.USER_ID,
                                                    "VERSION_NO": 1
                                                };
                                                ex_object_details_arr.push(ex_object_details);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (reqObj.NEED_TRN_INSERT) {
                    reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, "EX_FILE_TRANS", ex_object_details_arr, reqObj.objLogInfo, null, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                        } else {
                            ex_header_files_arr = result;
                        }
                        asyncCallBack();
                    });

                } else {
                    asyncCallBack();
                }
            } else {
                asyncCallBack();
            }
        },
        function (asyncCallback) {
            asyncCallback();
        }
    ], function (error, result) {
        if (error) {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120020", "Error while executing updateExchangeFileInfo method", error, "", "");
        } else {
            var data = {
                "EXH_ID": EXH_ID,
                "EXF_ID_ARR": EXF_ID_ARR,
                "EXHF_ID_ARR": EXHF_ID_ARR,
                "EXO_ID_ARR": EXO_ID_ARR
            };
            resObj = commonFile.prepareMethodResponse("SUCCESS", "", data, "", "", "", "", "");
        }
        callBackUpdateExchangeFileInfo(resObj);
    });
}


function updateExchangeFileInfoStaticImportDownload(reqObj, callBackUpdateExchangeFileInfo) {
    var EXH_ID = "";
    var EXF_ID_ARR = [];
    var EXHF_ID_ARR = [];
    var EXO_ID_ARR = [];
    var resObj = {};
    var dt_code = "";
    var dtt_code = "";
    var tran_db_instance = reqObj.tran_db_instance;
    var headers = reqObj.headers;
    var ffg_json = reqObj.ffg_json.FILE_FORMATS[0]["RECORD_FORMATS"][0];
    var save_tran = reqObj.save_tran;
    var NEED_TRN_INSERT = reqObj.NEED_TRN_INSERT || false;
    var SAVE_TRAN_DET = reqObj.save_tran;
    var ex_header_files_arr = [];
    if (reqObj.DT_CODE != undefined && reqObj.DT_CODE != "") {
        dt_code = reqObj.DT_CODE;
    } else {
        dt_code = ffg_json["DT_Code"] || "";
    }
    if (reqObj.DTT_CODE != undefined && reqObj.DTT_CODE != "") {
        dtt_code = reqObj.DTT_CODE;
    } else {
        dtt_code = ffg_json["DTT_Code"] || "";
    }
    var prct_id = reqObj.objLogInfo.PROCESS_INFO.PRCT_ID ? reqObj.objLogInfo.PROCESS_INFO.PRCT_ID : reqObj.objLogInfo.PRCT_ID;
    async.series([
        function (asyncCallBack) {
            var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "'";
            reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                if (error) {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                    asyncCallBack(resObj);
                } else {
                    reqTranDBInstance.Commit(reqObj.tran_db_instance, true, function () {
                        asyncCallBack();
                    });
                }
            });
        },
        function (asyncCallBack) {
            var files = reqObj.Selected_items;
            var ex_files_arr = [];
            for (var index = 0; index < files.length; index++) {
                if (files[index].name != undefined && files[index].name != "" && files[index].name != null) {
                    var ex_files_obj = {
                        "FILE_STATUS": files[index].STATUS,
                        "FILE_NAME": files[index].name,
                    };
                    ex_files_arr.push(ex_files_obj);
                }
            }
            var ex_headerfilearr = [];
            for (var i = 0; i < ex_files_arr.length; i++) {
                var exheaderfileObj = {
                    "file_name": ex_files_arr[i].FILE_NAME,
                    "prct_id": prct_id + "_temp",
                    "status": ex_files_arr[i]['FILE_STATUS'] || '',
                    "CREATED_BY": reqObj.objLogInfo.LOGIN_NAME,
                    "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(headers, reqObj.objLogInfo)
                };
                ex_headerfilearr.push(exheaderfileObj);
            }
            reqTranDBInstance.InsertBulkTranDB(reqObj.tran_db_instance, "TMP_EX_HEADER_FILES", ex_headerfilearr, reqObj.objLogInfo, null, function (result, error) {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                } else {
                    var statusContents = [];
                    for (var temp of ex_files_arr) {
                        statusContents.push(temp['FILE_STATUS']);
                    }
                    statusContents = statusContents.filter(function (item, i, ar) {
                        return ar.indexOf(item) === i;
                    });
                    async.forEachOfSeries(statusContents, function (value, key, callBackTempAsync) {
                        var query = "update ex_header_files set modified_by = '" + reqObj.objLogInfo.USER_ID + "' , modified_date = '" + reqDateFormatter.GetTenantCurrentDateTime(headers, reqObj.objLogInfo) + "' , file_status = '" + value + "' where cast(file_name as varchar(264)) IN (select file_name from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "' and status = '" + value + "')";
                        reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                            if (error) {
                                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                callBackTempAsync(resObj);
                            } else {
                                var query = "delete from tmp_ex_header_files where prct_id = '" + prct_id + "_temp" + "'";
                                reqTranDBInstance.ExecuteSQLQuery(reqObj.tran_db_instance, query, reqObj.objLogInfo, function (result, error) {
                                    if (error) {
                                        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "", "", error, "", "");
                                        callBackTempAsync(resObj);
                                    } else {
                                        reqTranDBInstance.Commit(reqObj.tran_db_instance, true, function () {
                                            callBackTempAsync();
                                        });
                                    }
                                });
                            }
                        });
                    }, function (err) {
                        asyncCallBack();
                    });
                }
            });
        },
        function (asyncCallBack) {
            var ex_object_details_arr = [];
            if (EXHF_ID_ARR !== "" && EXHF_ID_ARR.length > 0) {
                for (var index = 0; index < EXHF_ID_ARR.length; index++) {
                    if (SAVE_TRAN_DET !== undefined) {
                        for (var i = 0; i < SAVE_TRAN_DET.length; i++) {
                            if (SAVE_TRAN_DET[i]["FileName"] == EXHF_ID_ARR[index]["file_name"]) {
                                if (SAVE_TRAN_DET[i]["SaveTranResult"]["STATUS"] == "SUCCESS") {
                                    var saveTranResult = SAVE_TRAN_DET[i]["SaveTranResult"]["SUCCESS_DATA"];
                                    if (saveTranResult.service_status == "SUCCESS") {
                                        var lastInsertIDS = saveTranResult.data.LAST_INSERT;
                                        for (var j = 0; j < lastInsertIDS.length; j++) {
                                            if (EXHF_ID_ARR[index]["exhf_id"] != undefined && lastInsertIDS[j]["trn_id"] != undefined) {
                                                var ex_object_details = {
                                                    "TRN_ID": lastInsertIDS[j]["trn_id"],
                                                    "DT_CODE": dt_code || "",
                                                    "DTT_CODE": dtt_code || "",
                                                    "EXHF_ID": EXHF_ID_ARR[index]["exhf_id"],
                                                    "TS_ID": lastInsertIDS[j]["ts_id"],
                                                    "CREATED_BY": reqObj.objLogInfo.USER_ID,
                                                    "VERSION_NO": 1
                                                };
                                                ex_object_details_arr.push(ex_object_details);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                if (reqObj.NEED_TRN_INSERT) {
                    reqTranDBInstance.InsertBulkTranDBWithAudit(tran_db_instance, "EX_FILE_TRANS", ex_object_details_arr, reqObj.objLogInfo, null, function (result, error) {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                        } else {
                            ex_header_files_arr = result;
                        }
                        asyncCallBack();
                    });
                } else {
                    asyncCallBack();
                }
            } else {
                asyncCallBack();
            }
        },
        function (asyncCallback) {
            asyncCallback();
        }
    ], function (error, result) {
        if (error) {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120020", "Error while executing updateExchangeFileInfo method", error, "", "");
        } else {
            var data = {
                "EXH_ID": EXH_ID,
                "EXF_ID_ARR": EXF_ID_ARR,
                "EXHF_ID_ARR": EXHF_ID_ARR,
                "EXO_ID_ARR": EXO_ID_ARR
            };
            resObj = commonFile.prepareMethodResponse("SUCCESS", "", data, "", "", "", "", "");
        }
        callBackUpdateExchangeFileInfo(resObj);
    });
}

function loadExchangeSetting(reqObj, callBackLoadExchangeSetting) {
    var resObj = {};
    try {
        var fileFormatGroupObj = {};
        reqFXDBInstance.GetTableFromFXDB(reqObj.clt_cas_instance, 'code_descriptions', [], {
            'cd_code': 'EXCHANGE_SETTING'
        }, objLogInfo, function (error, result) {
            if (error) {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120021", "Error while executing loadExchangeSetting method", error, "", "");
            } else {
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", result[0]["code_value"], "", "", "", "", "");
            }
            callBackLoadExchangeSetting(resObj);
        });
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120022", "Exception while executing loadExchangeSetting method", error, "", "");
        callBackLoadExchangeSetting(resObj);
    }
}


function loadExchangeGateway(reqObj, callbackLoadExchangeGateway) {
    var resObj = {};
    var EXCHANGE_SYSTEM_GATEWAYS = [];
    var EXCHANGE_SYSTEM = [];
    var EXCHANGE_FILE_FORMAT_GROUP = [];
    var objLogInfo = reqObj.objLogInfo;
    var finalResult = {
        "EXCHANGE_SYSTEM_GATEWAYS": "",
        "EXCHANGE_SYSTEMS": "",
        "EXCHANGE_FILE_FORMAT_GROUPS": ""
    };
    try {
        async.parallel([
            function (asyncCallback) {
                reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_gateways', ['exg_id', 'gateway_name'], {}, objLogInfo, function (error, result) {
                    if (!error) {
                        EXCHANGE_SYSTEM_GATEWAYS = result.rows;
                    }
                    asyncCallback();
                });
            },
            function (asyncCallback) {
                reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_system', ['exs_id', 'sys_name'], {}, objLogInfo, function (error, result) {
                    if (!error) {
                        EXCHANGE_SYSTEM = result.rows;
                    }
                    asyncCallback();
                });
            },
            function (asyncCallback) {
                reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_file_format_groups', ['EXFFG_CODE', 'exffg_name'], {}, objLogInfo, function (error, result) {
                    if (!error) {
                        EXCHANGE_FILE_FORMAT_GROUP = result.rows;
                    }
                    asyncCallback();
                });
            }
        ], function (error, result) {
            if (!error) {
                finalResult.EXCHANGE_SYSTEM_GATEWAYS = EXCHANGE_SYSTEM_GATEWAYS;
                finalResult.EXCHANGE_SYSTEMS = EXCHANGE_SYSTEM;
                finalResult.EXCHANGE_FILE_FORMAT_GROUPS = EXCHANGE_FILE_FORMAT_GROUP;
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", finalResult, "", "", "", "", "");
            } else {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120023", "Error while executing loadExchangeGateway method", error, "", "");
            }
            callbackLoadExchangeGateway(resObj);
        });
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120024", "Exception while executing loadExchangeGateway method", error, "", "");
        callbackLoadExchangeGateway(resObj);
    }
}


function getProcessData(reqObj, originalRequest, callBackGetProcessData) {
    var resObj = {};
    // Check need to skip wfselect 
    if (reqObj.ffg_json && (reqObj.ffg_json.SKIP_ELIGIBLE_DATA == "Y" || reqObj.ffg_json.FILE_FORMATS[0].SKIP_ELIGIBLE_DATA == "Y")) {
        console.log("Skip wfselecct - 'Y' no need to execute wfselect");
        var Wfres = { "service_status": "SUCCESS", "process_status": "SUCCESS", "data": { "RowData": "" }, "error_code": "" };
        resObj = commonFile.prepareMethodResponse("SUCCESS", "", Wfres, "", "", "", "", "");
        callBackGetProcessData(resObj);
    } else {
        originalRequest.body.PARAMS = reqObj;
        var headers = {
            "routingkey": originalRequest.headers["routingkey"],
            // "routingkey": 'CLT-1278~APP-1002~TNT-0~ENV-0', // For development
            "session-id": originalRequest.headers["session-id"]
        };
        delete originalRequest.body.SESSION_ID;
        var tempObj = originalRequest;
        var serverhost = reqObj.PROTOCOL + "//" + reqObj.CURL + "/Handler/GetWFSelect";
        // serverhost = 'http://192.168.2.3:4001/Handler/GetWFSelect';
        console.log("------WFSELECT REQUEST-------");

        delete tempObj.body.PARAMS.mHeaders;
        delete tempObj.body.PARAMS.objLogInfo;
        delete tempObj.body.PARAMS.dep_cas_instance;
        delete tempObj.body.PARAMS.res_cas_instance;
        delete tempObj.body.PARAMS.tran_db_instance;
        delete tempObj.body.PARAMS.gateway_config;

        var input_request = {
            url: serverhost,
            method: "POST",
            json: true,
            body: tempObj.body,
            headers: headers
        };
        try {
            request(input_request, function (error, response, body) {
                console.log(JSON.stringify(body), '-----------------')
                if (error) {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120025", "Error while executing getProcessData method", error, "", "");
                } else {
                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", body, "", "", "", "", "");
                }
                callBackGetProcessData(resObj);
            });
        } catch (error) {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-120026", "Exception while executing getProcessData method", error, "", "");
            callBackGetProcessData(resObj);
        }
    }
}

function getCreatedFiles(pInputRequest, getCreatedFilesCallback) {
    try {
        /*    Expected pInputRequest Object will be
           inputRequest["session"] 
           inputRequest['tenant_id']
           inputRequest['objLogInfo']
           inputRequest['tran_db_instance']
           inputRequest['clt_cas_instance']
           inputRequest['EXFFG_CODE']
   
           Callback Parameters are 
           pErrorCode,pErrorMesg,pErrorObj,pArrResponseData */
        var FFG_CODE = pInputRequest.EXFFG_CODE;
        var session = pInputRequest.session || {};
        var objLogInfo = pInputRequest.objLogInfo;
        var selectFileSize = '';
        if (isLatestPlatformVersion) {
            selectFileSize = 'EHF.FILE_SIZE,';
        }
        var newPlatformFilters = " and EHF.app_id = '" + session.APP_ID + "' and EHF.tenant_id = '" + session.TENANT_ID + "'";
        // pInputRequest.SERVICE_LOG_FOLDER_PATH = '../../../torus-services/api/exchange/service_logs/upload/' + FFG_CODE + '/';
        // Getting PRCT_ID for File Upload Process
        if (pInputRequest.ACTION == "Uploaded_File") {
            var status = "UPLOAD_COMPLETED";
        } else {
            var status = 'CREATED';
        }
        if (pInputRequest.from_scheduler) {
            // Via Scheduler
            reqAuditLog.GetProcessToken(pInputRequest.tran_db_instance, objLogInfo, function (error, prct_id) {
                if (error) {
                    getCreatedFilesCallback('ERR-EXG-120059', 'Error While Getting a New Process Token...', error, []);
                } else {
                    objLogInfo.prct_id = prct_id;
                    var selectQry = "SELECT DISTINCT(EHF.FILE_NAME) FILE_NAME FROM EX_HEADER_FILES EHF INNER JOIN EX_HEADER EH ON EH.EXH_ID = EHF.EXH_ID WHERE EHF.FILE_STATUS = '" + status + "' and EH.EXFFG_CODE = '" + FFG_CODE + "' and  prct_id is null";
                    if (isLatestPlatformVersion) {
                        reqInstanceHelper.PrintInfo(serviceName, 'APP_ID and TENANT_ID filters are Added in the Query..', objLogInfo);
                        selectQry = selectQry + newPlatformFilters;
                    }
                    var tran_limit_count = pInputRequest.upload_file_limit_count || 100;
                    if (pInputRequest.tran_db_instance.DBConn.DBType.toLowerCase() == 'oracledb') {
                        selectQry = selectQry + ' AND ROWNUM <= ' + tran_limit_count;
                    } else { // For Postgress DB
                        selectQry = selectQry + ' LIMIT ' + tran_limit_count;
                    }
                    var query = "update ex_header_files set prct_id = '" + prct_id + "' where  file_name in ( " + selectQry + ")";
                    reqTranDBInstance.ExecuteSQLQuery(pInputRequest.tran_db_instance, query, objLogInfo, function (result, error) {
                        if (error) {
                            getCreatedFilesCallback('ERR-EXC-120036', 'Error on db query', error, []);
                        } else {
                            var selectQryByPRCT_ID = "SELECT DISTINCT(EHF.FILE_NAME) FILE_NAME, " + selectFileSize + " EHF.EXHF_ID EXHF_ID, EH.FILE_PATH PATH, EHF.FILE_STATUS STATUS FROM EX_HEADER_FILES EHF JOIN EX_HEADER EH ON EH.EXH_ID = EHF.EXH_ID WHERE EHF.PRCT_ID = '" + prct_id + "'";
                            reqTranDBInstance.ExecuteSQLQuery(pInputRequest.tran_db_instance, selectQryByPRCT_ID, objLogInfo, function (result, error) {
                                try {
                                    if (error) {
                                        WritePrctToNullServiceLogFile(pInputRequest.headers, prct_id, pInputRequest.SERVICE_LOG_FOLDER_PATH, 'NULL_PRCT_ID', null, function () {
                                            getCreatedFilesCallback('ERR-EXC-120040', 'Error on db query', error, []);
                                        });
                                    } else {
                                        var rows = result.rows;
                                        var files = [];
                                        for (var i = 0; i < rows.length; i++) {
                                            files.push({
                                                name: rows[i]['file_name'],
                                                file_name: rows[i]['file_name'],
                                                STATUS: rows[i]['status'],
                                                size: rows[i]['file_size'],
                                                exhf_id: rows[i]['exhf_id'],
                                            });
                                        }
                                        getCreatedFilesCallback('', '', '', files);
                                    }
                                } catch (error) {
                                    getCreatedFilesCallback('ERR-EXC-120037', 'Error on  ExecuteSQLQuery query', error, []);
                                }
                            });
                        }
                    });
                }
            });
        } else {
            // Via Screen
            var selectQry = "SELECT DISTINCT(EHF.FILE_NAME) FILE_NAME, " + selectFileSize + " EHF.EXHF_ID EXHF_ID, EHF.FILE_STATUS STATUS FROM EX_HEADER_FILES EHF INNER JOIN EX_HEADER EH ON EH.EXH_ID = EHF.EXH_ID WHERE EHF.FILE_STATUS = '" + status + "' AND EH.EXFFG_CODE ='" + FFG_CODE + "' and (EH.prct_id = '' or EH.prct_id is null)";
            if (isLatestPlatformVersion) {
                reqInstanceHelper.PrintInfo(serviceName, 'For Screen, APP_ID and TENANT_ID filters are Added in the Query..', objLogInfo);
                selectQry = selectQry + newPlatformFilters;
            }
            reqTranDBInstance.ExecuteSQLQuery(pInputRequest.tran_db_instance, selectQry, objLogInfo, function (result, error) {
                if (error) {
                    getCreatedFilesCallback('ERR-EXC-120039', 'Error on db query for Screen Side Method...', error, []);
                } else {
                    var rows = result.rows;
                    var files = [];
                    for (var i = 0; i < rows.length; i++) {
                        files.push({
                            file_name: rows[i]['file_name'],
                            name: rows[i]['file_name'],
                            STATUS: rows[i]['status'],
                            size: rows[i]['file_size'],
                            exhf_id: rows[i]['exhf_id'],
                        });
                    }
                    getCreatedFilesCallback('', '', '', files);
                }
            });
        }

    } catch (error) {
        getCreatedFilesCallback('ERR-EXC-120038', 'Catch Error in getCreatedFiles() ', error, []);
    }

}


function getGatewayDetails(reqObj, callBack) {
    var resObj = {};
    try {
        var exGatewayCond = {
            'exg_code': reqObj.EXG_CODE,
            'client_id': reqObj.objSessionInfo.CLIENT_ID,
            'app_id': reqObj.objSessionInfo.APP_ID
        };
        if (isLatestPlatformVersion) {
            reqInstanceHelper.PrintInfo(serviceName, 'Adding TENANT ID Filters...', reqObj.objLogInfo);
            exGatewayCond.TENANT_ID = reqObj.objSessionInfo.TENANT_ID;
        }
        reqFXDBInstance.GetTableFromFXDB(reqObj.dep_cas_instance, 'ex_gateways', [], exGatewayCond, reqObj.objLogInfo, function (error, result) {
            if (error) {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "Error while getting data from ex_gateways", error, "", "");
                callBack(resObj);
            } else {
                if (result.rows.length > 0) {
                    resObj = commonFile.prepareMethodResponse("SUCCESS", "", result.rows[0], "", "", "", "", "");
                    callBack(resObj);
                } else {
                    resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "No gateway found", "", "", "");
                    callBack(resObj);
                }
            }
        });
    } catch (error) {
        resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR", "Exception occured in getGatewayDetails", error, "", "");
        callBack(resObj);
    }
}

function uploadFileProcess(reqBody, uploadFileProcessCallback) {
    /*  Expected Parameters from reqBody will be
     reqBody.clt_cas_instance,
         reqBody.dep_cas_instance,
         reqBody.tran_db_instance,
         reqBody.headers,
         reqBody.objSessionInfo,
         reqBody.objLogInfo,
         reqBody.Selected_items,
         reqBody.Des_sys,
         reqBody.EXG_CODE
         reqBody.EXFFG_CODE
 
     Callback Parameters are 
     pErrorCode,pErrorMesg,pErrorObj,pStrResponseData */

    var serviceParamRedisKey = 'SERVICE_PARAMS';
    // Getting the Service params based on the Service Name from the Redis
    reqInstanceHelper.GetConfig(serviceParamRedisKey, function (serviceParamRedisKeyValue, error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Redis Key - ' + serviceParamRedisKey + ' Redis Value - ' + serviceParamRedisKeyValue, objLogInfo);
        if (serviceParamRedisKeyValue) {
            try {
                serviceParamRedisKeyValue = JSON.parse(serviceParamRedisKeyValue)['Exchange'];
            } catch (error) {

            }
        }
        reqExchangeEngine = require('./ExchangeEngine');
        var objLogInfo = reqBody.objLogInfo;
        var APP_ID = reqBody.objSessionInfo.APP_ID || null;
        var CLIENT_ID = reqBody.objSessionInfo.CLIENT_ID || null;
        var from_screen = reqBody.from_screen;
        var headers = reqBody.headers;
        var EXFFG_CODE = reqBody.EXFFG_CODE;
        var arrInProgressfileNames = [];
        for (var i = 0; i < reqBody.Selected_items.length; i++) {
            var fileObj = { file_name: reqBody.Selected_items[i].name };
            arrInProgressfileNames.push(fileObj);
        }
        var fileName = '';
        var fileContent = '';
        var folderPath = reqBody.SERVICE_LOG_FOLDER_PATH;

        // Getting PRCT_ID for File Upload Process
        function CheckingPrct_id(objLogInfo, CheckingPrct_idCB) {
            if (objLogInfo.prct_id) {
                CheckingPrct_idCB(null, objLogInfo.prct_id);

            } else {
                reqAuditLog.GetProcessToken(reqBody.tran_db_instance, objLogInfo, function (error, prct_id) {
                    if (error) {
                        CheckingPrct_idCB(error, prct_id);
                    }
                    else {
                        CheckingPrct_idCB(null, prct_id);
                    }
                });
            }
        }
        CheckingPrct_id(objLogInfo, function (error, prct_id) {
            try {
                if (error) {
                    uploadFileProcessCallback('ERR-EXG-120042', 'Error while getting PRCT_ID', error, null);
                }
                else {
                    try {
                        var rows = reqBody.Selected_items;
                        var filteredArr = [];
                        var arrExhfID = [];
                        if (rows.length) {
                            for (var i = 0; i < rows.length; i++) {
                                var currentRow = rows[i];
                                currentRow.size = 0;
                                currentRow.STATUS = currentRow.STATUS;
                                currentRow.name = currentRow.file_name;
                                currentRow.exhf_id = currentRow.exhf_id;
                                delete currentRow.status;
                                arrExhfID.push(currentRow.exhf_id);
                                filteredArr.push(currentRow);
                            }
                        }
                        reqBody.Selected_items = filteredArr;
                        reqInstanceHelper.PrintInfo(serviceName, 'Selected_item List - ' + JSON.stringify(filteredArr), objLogInfo);
                        reqInstanceHelper.PrintInfo(serviceName, 'File Upload API Call is From Screen - ' + from_screen, objLogInfo);

                        if (from_screen) {
                            if (!filteredArr.length) {
                                uploadFileProcessCallback('ERR-EXG-120066', 'Files Not Selected For File Upload Process...', '', null);
                            } else {
                                var modifiedDate = reqDateFormatter.GetTenantCurrentDateTime(headers, objLogInfo);
                                var ex_header_files_prct_update_qry = "update EX_HEADER_FILES set prct_id = '" + prct_id + "', MODIFIED_DATE =  '" + modifiedDate + "' where prct_id is null and exhf_id in (" + arrExhfID.toString() + ")";
                                reqTranDBInstance.ExecuteSQLQuery(reqBody.tran_db_instance, ex_header_files_prct_update_qry, objLogInfo, function (result, error) {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120059', 'PRCT_ID update from NULL to New ID in the EX_HEADER_FILES Table is Failed...', error);
                                        uploadFileProcessCallback('ERR-EXG-120049', 'Error while Updating Prct_id from Null to New ID in EX_HEADER_FILES...', error, null);

                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated PRCT_ID from NULL to New ID in the EX_HEADER_FILES Table...', objLogInfo);
                                        var ex_header_files_select_qry = "select EXHF_ID from EX_HEADER_FILES  where prct_id = '" + prct_id + "'";
                                        reqTranDBInstance.ExecuteSQLQuery(reqBody.tran_db_instance, ex_header_files_select_qry, objLogInfo, function (result, error) {
                                            if (error) {
                                                // Need To Write Service Log File In this case
                                                var objProcessedFile = {
                                                    NULL_PRCT_ID: prct_id
                                                };
                                                fileContent = JSON.stringify(objProcessedFile);
                                                fileName = GetServiceFileName(headers);
                                                reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent, function (result) {
                                                    return uploadFileProcessCallback('ERR-EXG-120345', 'Error While Getting Data from EX_HEADER_FILES Table...', error, null);
                                                });

                                            } else {
                                                if (!result.rows.length) {
                                                    return uploadFileProcessCallback('ERR-EXG-120049', 'Unable To Process the Selected Files...', '', null);
                                                }
                                                else {
                                                    var result_rows = result.rows;
                                                    var final_selected_items = [];
                                                    var final_failed_items = [];
                                                    for (var a = 0; a < result_rows.length; a++) {
                                                        var exhf_id = result_rows[a].exhf_id;
                                                        for (var b = 0; b < reqBody.Selected_items.length; b++) {
                                                            if (reqBody.Selected_items[b].exhf_id == (exhf_id)) {
                                                                final_selected_items.push(reqBody.Selected_items[b]);
                                                            } else {
                                                                final_failed_items.push(reqBody.Selected_items[b]);
                                                            }
                                                        }
                                                    }
                                                    reqBody.Selected_items = final_selected_items;
                                                    CallUpload();
                                                }
                                            }
                                        });

                                    }
                                });
                            }
                        }
                        else {
                            // via Scheduler
                            CallUpload();
                        }

                        function CallUpload() {
                            // Used to Hold the FTP File Upload Process for particular time which can be obtained from the Input Params and Mainly used 
                            var DELAY_TIME_FOR_FTP_RECOVERY_TEST_SEC = (serviceParamRedisKeyValue && serviceParamRedisKeyValue.DELAY_TIME_FOR_FTP_RECOVERY_TEST_SEC && serviceParamRedisKeyValue.DELAY_TIME_FOR_FTP_RECOVERY_TEST_SEC * 1000) || 0;  // Converting ito Milliseconds
                            reqInstanceHelper.PrintInfo(serviceName, 'DELAY_TIME_FOR_FTP_RECOVERY_TEST_SEC - ' + DELAY_TIME_FOR_FTP_RECOVERY_TEST_SEC, objLogInfo);
                            setTimeout(() => {
                                uploadFile(reqBody, {}, function (uploadresult) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'File Upload Result - ' + JSON.stringify(uploadresult), objLogInfo);
                                    doStatusChange(uploadresult);
                                    function doStatusChange(uploadresult) {
                                        var uploadResultStatus = uploadresult.STATUS;
                                        var arrFailedFileList = [];
                                        var processedFileList = [];
                                        var arrFileuploadSuccess = [];
                                        var arrFileUploadFail = [];
                                        var totalFiles = uploadresult.SUCCESS_DATA.processedData || reqBody.Selected_items; // Uploaded File list from Success Status  ||  Failed File List from Failure Status
                                        for (var b = 0; b < totalFiles.length; b++) {
                                            if (totalFiles[b].error || uploadResultStatus == 'FAILURE') {
                                                if (!totalFiles[b].error) {
                                                    totalFiles[b].error = uploadresult.ERROR_MESSAGE;
                                                }
                                                arrFailedFileList.push(totalFiles[b]);
                                                arrFileUploadFail.push(totalFiles[b].exhf_id);
                                            } else {
                                                processedFileList.push(totalFiles[b]);
                                                arrFileuploadSuccess.push(totalFiles[b].exhf_id);
                                            }
                                        }

                                        // Used to Hold the Insert Process for particular time which can be obtained from the Input Params and Mainly used 
                                        var DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC = (serviceParamRedisKeyValue && serviceParamRedisKeyValue.DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC && serviceParamRedisKeyValue.DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC * 1000) || 0;  // Converting ito Milliseconds
                                        reqInstanceHelper.PrintInfo(serviceName, 'DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC - ' + DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC, objLogInfo);
                                        setTimeout(() => {
                                            async.series({
                                                statusChangeToUploaded: function (statusChangeToUploaded) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'No. Of Uploaded File Names - ' + processedFileList.length, objLogInfo);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Uploaded File Name List - ' + JSON.stringify(processedFileList), objLogInfo);
                                                    if (processedFileList.length) {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Update File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table...', objLogInfo);
                                                        var successCondObj = {
                                                            'EXHF_ID': arrFileuploadSuccess,
                                                            'FILE_STATUS': 'CREATED',
                                                            'PRCT_ID': prct_id
                                                        };
                                                        var updateColumn = {
                                                            'FILE_STATUS': 'UPLOADED',
                                                            'MODIFIED_BY': objLogInfo.USER_ID,
                                                            'COMMENT_TEXT': 'File Uploaded Successfully',
                                                            'COMMENT_TYPE': 'INFO'
                                                        };
                                                        reqTranDBInstance.UpdateTranDBWithAudit(reqBody.tran_db_instance, 'EX_HEADER_FILES', updateColumn, successCondObj, objLogInfo, function (result, error) {
                                                            if (error) {
                                                                var objProcessedFile = {
                                                                    processedFileList: processedFileList,
                                                                    prct_id: prct_id
                                                                };
                                                                fileContent = JSON.stringify(objProcessedFile);
                                                                fileName = GetServiceFileName(headers);
                                                                reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent, function (result) {
                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120053', 'Update Failed in EX_HEADER_FILES Table...', error);
                                                                    statusChangeToUploaded(null, 'File uploaded but status not updated' + error.stack);
                                                                });
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'File Status Updated Successfully', objLogInfo);
                                                                statusChangeToUploaded(null, 'File Status Updated Successfully');
                                                            }
                                                        });
                                                    } else {
                                                        statusChangeToUploaded(null);
                                                    }
                                                },
                                                Prct_IDToNullForFailedData: function (statusChangeToCreated) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'No. Of Upload Failed File Names - ' + arrFailedFileList.length, objLogInfo);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Upload Failed File Name List - ' + JSON.stringify(arrFailedFileList), objLogInfo);
                                                    if (arrFailedFileList.length) {
                                                        var str_upload_failed = arrFailedFileList[0].error || 'File Upload Failed';
                                                        reqInstanceHelper.PrintInfo(serviceName, 'For Failed Files Updating Prct_id to Null in EX_HEADER_FILES Table...', objLogInfo);
                                                        var successCondObj = {
                                                            'PRCT_ID': prct_id,
                                                            'EXHF_ID': arrFileUploadFail

                                                        };
                                                        var str_upload_failed = arrFailedFileList[0].error || 'File Upload Failed';
                                                        var updateColumn = {
                                                            'PRCT_ID': null,
                                                            'MODIFIED_BY': objLogInfo.USER_ID,
                                                            'COMMENT_TEXT': str_upload_failed,
                                                            'COMMENT_TYPE': 'ERROR'
                                                        };
                                                        reqTranDBInstance.UpdateTranDBWithAudit(reqBody.tran_db_instance, 'EX_HEADER_FILES', updateColumn, successCondObj, objLogInfo, function (result, error) {
                                                            if (error) {
                                                                var objFailedFile = {
                                                                    arrFailedFileList: arrFailedFileList,
                                                                    prct_id: prct_id
                                                                };
                                                                fileContent = JSON.stringify(objFailedFile);
                                                                fileName = GetServiceFileName(headers);
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Writing Service Log For Failed Files Updating Prct_id to Null in EX_HEADER_FILES Table...', objLogInfo);
                                                                reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent, function (result) {
                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120053', 'Update Failed in EX_HEADER_FILES Table...', error);
                                                                    statusChangeToCreated(null, 'Failed to update PRCT_ID to Null due to ' + error.stack);
                                                                });
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'PRCT_ID Successfully Updated as Null', objLogInfo);
                                                                statusChangeToCreated(null, 'PRCT_ID Successfully Updated as Null');
                                                            }
                                                        });
                                                    } else {
                                                        statusChangeToCreated(null);
                                                    }
                                                },
                                                function(err, results) {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'uploadresult - ' + JSON.stringify(uploadresult), objLogInfo);
                                                    if (uploadresult.STATUS == "SUCCESS") {

                                                        // Calling Custom Code Snippet Project Using FFG Code
                                                        var callCodeSnippetParams = {};
                                                        var codeSnippetInputParams = {};
                                                        codeSnippetInputParams.SUCCESS_FILE_LIST = processedFileList;
                                                        codeSnippetInputParams.FAILED_FILE_LIST = arrFailedFileList;
                                                        codeSnippetInputParams.PRCT_ID = prct_id;
                                                        codeSnippetInputParams.TRAN_DB_INSTANCE = reqBody.tran_db_instance;
                                                        codeSnippetInputParams.CLT_CAS_INSTANCE = reqBody.clt_cas_instance;
                                                        codeSnippetInputParams.DEP_CAS_INSTANCE = reqBody.dep_cas_instance;
                                                        codeSnippetInputParams.SESSION_INFO = reqBody.objSessionInfo;
                                                        codeSnippetInputParams.objLogInfo = objLogInfo;
                                                        callCodeSnippetParams.EXG_PROCESS_NAME = 'UPLOAD';
                                                        callCodeSnippetParams.dep_cas_instance = reqBody.dep_cas_instance;
                                                        callCodeSnippetParams.objLogInfo = objLogInfo;
                                                        callCodeSnippetParams.APP_ID = APP_ID;
                                                        callCodeSnippetParams.CLIENT_ID = CLIENT_ID;
                                                        callCodeSnippetParams.EXFFG_CODE = EXFFG_CODE;
                                                        callCodeSnippetParams.CODE_SNIPPET_INPUT_PARAMS = codeSnippetInputParams;
                                                        reqExchangeEngine.CallCodeSnippetByFFGCode(callCodeSnippetParams, function (codeSnippetResult, error) {
                                                            // Sample Code Snippet Response Will be looks like
                                                            // {"STATUS":"FAILURE","SUCCESS_MESSAGE":"STATIC","SUCCESS_DATA":[],"ERROR_CODE":"500","ERROR_MESSAGE":"NO DTT Code Found","ERROR_OBJECT":"","PROCESS_STATUS":"FAILURE","INFO_MESSAGE":"NO DTT Code Found"}
                                                            //  {"STATUS":"SUCCESS","SUCCESS_MESSAGE":"STATIC","SUCCESS_DATA":[],"PROCESS_STATUS":"SUCCESS","INFO_MESSAGE":"SUCCESS"}
                                                            if (error) {  // Not able to calling the Code Snippet Project Due to Some Error...
                                                                uploadFileProcessCallback(null, '', error, null);
                                                            } else if (codeSnippetResult) { // Sending the Code Snippet Response To the Client Side...
                                                                uploadFileProcessCallback(codeSnippetResult.ERROR_CODE, codeSnippetResult.ERROR_MESSAGE, codeSnippetResult.ERROR_OBJECT, codeSnippetResult.INFO_MESSAGE);
                                                            } else { // Send Response to the Client using Framework If there is No Code Snippet Project Used...
                                                                uploadFileProcessCallback(uploadresult.ERROR_CODE, uploadresult.ERROR_MESSAGE, uploadresult.ERROR_OBJECT, uploadresult.SUCCESS_MESSAGE);
                                                            }
                                                        });
                                                    } else {
                                                        uploadFileProcessCallback(uploadresult.ERROR_CODE, uploadresult.ERROR_MESSAGE, uploadresult.ERROR_OBJECT, null);
                                                    }
                                                }
                                            });
                                        }, DELAY_TIME_FOR_DB_RECOVERY_TEST_SEC);
                                    }
                                });
                            }, DELAY_TIME_FOR_FTP_RECOVERY_TEST_SEC);
                        }
                    }
                    catch (error) {
                        uploadFileProcessCallback('ERR-EXG-120049', 'Catch Error in ExecuteSQLQuery() Callback...', error, null);
                    }
                }
            } catch (error) {
                uploadFileProcessCallback('ERR-EXG-120043', 'Catch Error in getting PRCT_ID', error, null);
            }
        });
    });
}

// Common Process for Checking Service Log File [Both APIs - Upload and UploadCreatedFiles]
function CheckServiceLogForFileUploadProcess(inputRequest, CheckServiceLogForFileUploadProcessCB) {
    try {
        /*    Required Parameters are
           objLogInfo
           headers
           SERVICE_LOG_FOLDER_PATH
           tran_db_instance
           headers */
        var objLogInfo = inputRequest.objLogInfo;
        var headers = inputRequest.headers;
        CheckUploadServiceLogFiles(inputRequest, objLogInfo, function (status) {
            CheckServiceLogForFileUploadProcessCB();
        });

        function CheckUploadServiceLogFiles(pInputRequest, pObjLogInfo, CheckUploadServiceLogFilesCB) {
            try {
                var serviceLogFolderPath = pInputRequest.SERVICE_LOG_FOLDER_PATH;
                var processedServiceLogFolder = serviceLogFolderPath + 'PROCESSED/';
                reqInstanceHelper.PrintInfo(serviceName, 'Checking for Recovery Files from Folder Path - ' + serviceLogFolderPath, pObjLogInfo);
                fs.readdir(serviceLogFolderPath, function (err, files) {
                    if (err) {
                        console.log('Error in CheckServiceLogFiles() Fs.readdir();', err);
                        CheckUploadServiceLogFilesCB(true);
                    } else {
                        var errorFiles = [];
                        for (var a = 0; a < files.length; a++) {
                            if ((files[a]).startsWith('ERR_')) {
                                var fileObj = { file_name: files[a] };
                                errorFiles.push(fileObj);
                            }
                        }
                        reqInstanceHelper.PrintInfo(serviceName, 'Recovery File Count - ' + errorFiles.length, pObjLogInfo);
                        if (errorFiles.length) {
                            // After getting Eligible Error Files, need to check whether these files are already in process or not [Multi node concept]
                            reqRedisInstance.GetRedisConnectionwithIndex(3, function (error, redis_instance) {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120076', 'Error While Getting Redis Connection with Index - 3', error);
                                    CheckUploadServiceLogFilesCB(false);
                                }
                                else {
                                    var dateFormatString = 'DD-MMM-YYYY hh:mm:ss A';
                                    var uploadRecoveryProcessKeyName = 'UPLOAD_RECOVERY_PROCESS';
                                    var uploadRecoveryProcessKeyValue = {};
                                    var uploadRecoveryProcessKeyTTL = '600'; // 10 Minutes
                                    uploadRecoveryProcessKeyValue.PROCESS = uploadRecoveryProcessKeyName;
                                    uploadRecoveryProcessKeyValue.DATE_AND_TIME = reqDateFormatter.ConvertDate(new Date(), '', '', dateFormatString);
                                    // redis_instance.set(uploadRecoveryProcessKeyName, JSON.stringify(uploadRecoveryProcessKeyValue),'NX', 'EX', uploadRecoveryProcessKeyTTL, function (error, result) {
                                    reqRedisInstance.RedisSetNx(redis_instance, uploadRecoveryProcessKeyName, JSON.stringify(uploadRecoveryProcessKeyValue), ttl, function (error, result) {
                                        if (error) {
                                            reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120077', 'Error While Using Redis Setnx Method with Index - 3', error);
                                            CheckUploadServiceLogFilesCB(false);
                                        }
                                        else if (result) {
                                            // redis_instance.set(uploadRecoveryProcessKeyName, JSON.stringify(uploadRecoveryProcessKeyValue), 'EX', uploadRecoveryProcessKeyTTL);
                                            reqInstanceHelper.PrintInfo(serviceName, 'Upload Recovery File Process is Started', pObjLogInfo);
                                            async.forEachOfSeries(errorFiles, function (objErrorFile, index, errorFileCB) {
                                                objErrorFile.file_path = serviceLogFolderPath + objErrorFile.file_name;
                                                objErrorFile.headers = headers;
                                                ReadAndRenamingFile(pInputRequest.tran_db_instance, objErrorFile, pObjLogInfo, function (result) {
                                                    if (result) {
                                                        var file_renaming = (objErrorFile.file_name).split('_');
                                                        // Creating Processed Folder for Moving the Processed Recovery Log Files
                                                        var folderCreationReqObj = { destination_folder_path: processedServiceLogFolder };
                                                        reqInstanceHelper.DynamicFolderCreationwithCallback(folderCreationReqObj, function () {
                                                            fs.rename(objErrorFile.file_path, (processedServiceLogFolder + 'PRC_' + file_renaming[1]), function () {
                                                                errorFileCB();
                                                            });
                                                        });
                                                    } else {
                                                        errorFileCB();
                                                    }
                                                });
                                            },
                                                function () {
                                                    // redis_instance.del(uploadRecoveryProcessKeyName, function (params) {
                                                    reqRedisInstance.delRediskey(redis_instance, uploadRecoveryProcessKeyName, function (res) {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Upload Recovery File Process Completed', pObjLogInfo);
                                                        CheckUploadServiceLogFilesCB(false);
                                                    });
                                                });
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Upload Recovery File Process is already in Process', pObjLogInfo);
                                            // If the UPLOAD_RECOVERY_PROCESS Redis Key is existing for long time then need to clear from the redis with check 
                                            redis_instance.get(uploadRecoveryProcessKeyName, function (error, uploadRecoveryProcessKeyValue) {
                                                if (error) {
                                                    reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120078', 'Error While Getting key Details  from  Redis Setnx Method with Index - 3', error);
                                                    CheckUploadServiceLogFilesCB(false);
                                                } else {
                                                    if (uploadRecoveryProcessKeyValue) {
                                                        try {
                                                            uploadRecoveryProcessKeyValue = JSON.parse(uploadRecoveryProcessKeyValue);
                                                            var startTime = uploadRecoveryProcessKeyValue.DATE_AND_TIME;
                                                            var calculatedTime = momentInstance(startTime, dateFormatString).add(uploadRecoveryProcessKeyTTL, 'seconds').format(dateFormatString);
                                                            var currentTime = reqDateFormatter.ConvertDate(new Date(), '', '', dateFormatString);
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Time Difference - ' + (new Date(currentTime).getTime() - new Date(calculatedTime).getTime()), pObjLogInfo);
                                                            if (new Date(currentTime).getTime() > new Date(calculatedTime).getTime()) {
                                                                // Need to Delete the Redis Key
                                                                // redis_instance.del(uploadRecoveryProcessKeyName, function (p1, p2) {
                                                                reqRedisInstance.delRediskey(redis_instance, uploadRecoveryProcessKeyName, function (result) {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Upload Recovery File Process Completed', pObjLogInfo);
                                                                    CheckUploadServiceLogFilesCB(false);
                                                                });
                                                            } else {
                                                                CheckUploadServiceLogFilesCB(false);
                                                            }
                                                        } catch (error) {
                                                            reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120079', 'Error While Verifying the Redis Key Timing', error);
                                                            CheckUploadServiceLogFilesCB(false);
                                                        }
                                                    } else {
                                                        CheckUploadServiceLogFilesCB(false);
                                                    }
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'There is No Recovery File For Upload Process', pObjLogInfo);
                            CheckUploadServiceLogFilesCB(true);
                        }
                    }
                });

            } catch (error) {
                CheckUploadServiceLogFilesCB(true);
            }
        }

        function ReadAndRenamingFile(pTran_db_instance, pFileObj, pObjLogInfo, ReadFileAndUpdateDBCB) {
            try {
                var headers = pFileObj.headers;
                fs.readFile(pFileObj.file_path, 'utf8', (error, data) => {
                    if (error) {
                        console.log('Error while getting File Content and Error - ' + error);
                        return ReadFileAndUpdateDBCB(false);
                    };
                    if (!data) {
                        console.log('File Content Empty');
                        return ReadFileAndUpdateDBCB(true);
                    }
                    var actualFileContent = JSON.parse(data);
                    var processedFileList = actualFileContent.processedFileList || [];
                    var Prct_IdInFileContent = actualFileContent.prct_id || [];
                    var NullPrct_id = actualFileContent.NULL_PRCT_ID || '';
                    var arrFailedFileList = actualFileContent.arrFailedFileList || [];
                    var status = {};

                    async.series({
                        statusChangeToUploaded: function (statusChangeToUploaded) {
                            reqInstanceHelper.PrintInfo(serviceName, 'No. Of Uploaded File Names - ' + processedFileList.length, pObjLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Uploaded File Name List - ' + JSON.stringify(processedFileList), pObjLogInfo);
                            status.uploaded_status = true;
                            status.uploaded_error = null;
                            var arrFileuploadSuccess = [];
                            if (actualFileContent && processedFileList.length) {
                                for (var b = 0; b < processedFileList.length; b++) {
                                    arrFileuploadSuccess.push(processedFileList[b].exhf_id);
                                }
                            }
                            if (processedFileList.length) {
                                var successCondObj = {
                                    'EXHF_ID': arrFileuploadSuccess,
                                    'FILE_STATUS': 'CREATED',
                                    'PRCT_ID': Prct_IdInFileContent
                                };
                                var updateColumn = {
                                    'FILE_STATUS': 'UPLOADED',
                                    'MODIFIED_BY': pObjLogInfo.USER_ID,
                                    'COMMENT_TEXT': 'File Uploaded Successfully',
                                    'COMMENT_TYPE': 'INFO'
                                };
                                reqInstanceHelper.PrintInfo(serviceName, 'Update File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table...', pObjLogInfo);
                                reqTranDBInstance.UpdateTranDBWithAudit(pTran_db_instance, 'EX_HEADER_FILES', updateColumn, successCondObj, pObjLogInfo, function (result, error) {
                                    if (error) {
                                        status.uploaded_status = false;
                                        status.uploaded_error = error.stack;
                                        reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120059', 'Update File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table is Failed...', error);
                                        statusChangeToUploaded(null, status);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table...', pObjLogInfo);
                                        statusChangeToUploaded(null, status);
                                    }
                                });
                            } else {
                                statusChangeToUploaded(null, status);
                            }
                        },
                        Prct_IDToNullForFailedData: function (Prct_IDToNullForFailedDataCB) {
                            reqInstanceHelper.PrintInfo(serviceName, 'No. Of Upload Failed File Names - ' + arrFailedFileList.length, pObjLogInfo);
                            reqInstanceHelper.PrintInfo(serviceName, 'Upload Failed File Name List - ' + JSON.stringify(arrFailedFileList), pObjLogInfo);
                            status.prct_id_to_null_status = true;
                            status.prct_id_to_null_error = null;
                            if (arrFailedFileList.length) {
                                var arrFileUploadFail = [];
                                if (actualFileContent && arrFailedFileList.length) {
                                    for (var b = 0; b < arrFailedFileList.length; b++) {
                                        arrFileUploadFail.push(arrFailedFileList[b].exhf_id);
                                    }
                                }
                                var successCondObj = {
                                    'PRCT_ID': Prct_IdInFileContent,
                                    'EXHF_ID': arrFileUploadFail

                                };
                                var str_upload_failed = arrFailedFileList[0].error || 'File Upload Failed';
                                var updateColumn = {
                                    'PRCT_ID': null,
                                    'MODIFIED_BY': pObjLogInfo.USER_ID,
                                    'COMMENT_TEXT': str_upload_failed,
                                    'COMMENT_TYPE': 'ERROR'
                                };
                                reqInstanceHelper.PrintInfo(serviceName, 'Update File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table...', pObjLogInfo);
                                reqTranDBInstance.UpdateTranDBWithAudit(pTran_db_instance, 'EX_HEADER_FILES', updateColumn, successCondObj, pObjLogInfo, function (result, error) {
                                    if (error) {
                                        status.prct_id_to_null_status = false;
                                        status.prct_id_to_null_error = error.stack;
                                        reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120059', 'Update File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table is Failed...', error);
                                        Prct_IDToNullForFailedDataCB(null, status);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully Updated File Status from CREATED to UPLOADED in the EX_HEADER_FILES Table...', pObjLogInfo);
                                        Prct_IDToNullForFailedDataCB(null, status);
                                    }
                                });
                            } else {
                                Prct_IDToNullForFailedDataCB(null, status);
                            }
                        },
                        Prct_IDToNullForUploadAfterUpdate: function (Prct_IDToNullForUploadAfterUpdateCB) {
                            status.update_after_prct_id_to_null_status = true;
                            status.update_after_prct_id_to_null_error = null;

                            if (NullPrct_id) {
                                var successCondObj = {
                                    'PRCT_ID': NullPrct_id
                                };
                                var updateColumn = {
                                    'PRCT_ID': null
                                };
                                reqInstanceHelper.PrintInfo(serviceName, 'Making Prct_ID to Null in the EX_HEADER_FILES Table...', pObjLogInfo);
                                reqTranDBInstance.UpdateTranDBWithAudit(pTran_db_instance, 'EX_HEADER_FILES', updateColumn, successCondObj, pObjLogInfo, function (result, error) {
                                    if (error) {
                                        status.update_after_prct_id_to_null_status = false;
                                        status.update_after_prct_id_to_null_error = error.stack;
                                        reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'ERR-EXG-120059', 'Making Prct_ID to Null in the EX_HEADER_FILES Table is Failed...', error);
                                        Prct_IDToNullForUploadAfterUpdateCB(null, status);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Successfully Making Prct_ID to Null in the EX_HEADER_FILES Table...', pObjLogInfo);
                                        Prct_IDToNullForUploadAfterUpdateCB(null, status);
                                    }
                                });
                            } else {
                                Prct_IDToNullForUploadAfterUpdateCB(null, status);
                            }
                        },
                        function(err, results) {
                            reqInstanceHelper.PrintInfo(serviceName, 'File List Process List - ' + JSON.stringify(status), pObjLogInfo);
                            if (status.uploaded_status && status.prct_id_to_null_status && status.update_after_prct_id_to_null_status) {
                                ReadFileAndUpdateDBCB(true);
                            } else {
                                ReadFileAndUpdateDBCB(false);
                            }
                        }
                    });
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, pObjLogInfo, 'ERR-EXC-1005', 'Exception Occured While ReadAndRenamingFile()... ', error);
            }

        }
    } catch (error) {
        console.log(error, 'Error in CheckServiceLogForFileUploadProcess();');
    }

}

function GetServiceFileName(pHeader) {
    return 'ERR_' + reqDateFormatter.ConvertDate(new Date(), pHeader, null, 'YYYY-MM-DD     hh-mm-ss-SSSS A') + '.log';
}

function DeleteTranTableData(pSession, pTableName, pCond, pLogInfo, pCallback) {
    reqTranDBInstance.DeleteTranDB(pSession, pTableName, pCond, pLogInfo, pCallback);
}

function getUniqueElements(firstArray, secondArray) {
    // Expected Array will be ['fileName1','fileName2','fileName3','fileName4']
    var differentElements = [];
    if (secondArray && secondArray.length) {
        secondArray.forEach(function (e) {
            if (firstArray.indexOf(e.file_name) == -1) {
                differentElements.push(e);
            }
        });
        return differentElements;
    }
    else {
        return firstArray;
    }
}

function replaceText(inputString, replacementFor, replaceWith) {
    var regexp = new RegExp(replacementFor, 'g');
    var outputText = inputString.replace(regexp, replaceWith);
    return outputText;
}

function AddTmpExHFInsertFailedPrctID(pPrct_id) {
    if (global.Exg_Down_DB_Insert_Failed_prct_ID.indexOf(pPrct_id) == -1) {
        global.Exg_Down_DB_Insert_Failed_prct_ID.push(pPrct_id);
    }
}

// Common Method to write a service log file for making prct_id to null
function WritePrctToNullServiceLogFile(pHeaders, pPrct_id, pSERVICE_LOG_FOLDER_PATH, pFileContentKeyName, pTableName, WritePrctToNullServiceLogFileCB) {
    // Writing Service log file
    var objProcessedFile = {};
    var keyName = pFileContentKeyName.toUpperCase();
    switch (keyName) {
        case 'NULL_PRCT_ID':
            objProcessedFile[keyName] = pPrct_id;
            break;
        case 'DELETE_PRCT_ID':
            objProcessedFile[keyName] = pPrct_id;
            objProcessedFile.Table_Name = pTableName;
            break;

        default:
            break;
    }

    var folderPath = pSERVICE_LOG_FOLDER_PATH;
    var fileContent = JSON.stringify(objProcessedFile);
    var fileName = reqInstanceHelper.GetServiceFileName(pHeaders);
    reqInstanceHelper.WriteServiceLog(folderPath, fileName, fileContent, WritePrctToNullServiceLogFileCB);
}


function CreateFTPFolder(exGateway, ftpConfig, CreateFTPFolderCB) {
    try {
        var removedSlashReadPath = exGateway.read_path;
        var objLogInfo = {};
        removedSlashReadPath = ftpHelper.RemoveSlashCharFrmString(removedSlashReadPath);
        reqInstanceHelper.PrintInfo(serviceName, 'Creating New Folder In FTP and Folder Name - ' + removedSlashReadPath, objLogInfo);
        ftpHelper.createFolder(removedSlashReadPath + "_processed", ftpConfig, objLogInfo)
            .then((result) => {
                CreateFTPFolderCB();
            })
            .catch((error) => {
                CreateFTPFolderCB();
            });
    } catch (error) {
        CreateFTPFolderCB();
    }
}


function CheckMatchingPattern(files, ffg_json, ObjReplacingContent, pLogInfo) {
    /* files =  [
        {
          "name": "MT103_Rabeesh_V.xml",
          "matching_pattern": "*.xml",
          "ff_Id": 2,
          "parent_ff_Id": "",
          "childfiles": [],
          "size": "2KB",
          "STATUS": "NOT DOWNLOADED"
        }
      ] */
    try {
        var file_formats = ffg_json["FILE_FORMATS"];
        var validFiles = [];
        var inValidFiles = [];
        var childarray = [];
        for (var fileindex = 0; fileindex < files.length; fileindex++) {
            for (var fileFormatindex = 0; fileFormatindex < file_formats.length; fileFormatindex++) {
                var matching_pattern = file_formats[fileFormatindex]['MATCHING_PATTERN'] || '';
                var file_extension = file_formats[fileFormatindex]['EXTENSION'] || '';
                var ischild = file_formats[fileFormatindex]['IS_CHILD'] || false;
                var childffg = file_formats[fileFormatindex]['PARENT_FILE'] || '';
                var ff_id = file_formats[fileFormatindex]['EXFF_ID'];
                // matching_pattern = '$SCODE_*';
                // file_extension = '.XML';
                // file_extension = '.DOC';
                // matching_pattern = '$ROOTSCODE_$SCODE_*';
                // ObjReplacingContent = {
                //     ROOT_SCODE: 'CCS_KEEQB'
                // };
                var fileName = files[fileindex]['name'];
                var isValidFileExtension = true;
                if (matching_pattern || file_extension) {
                    if (matching_pattern) {
                        var arrMatching_pattern = matching_pattern.split('_');
                        for (let a = 0; a < arrMatching_pattern.length; a++) {
                            const element = arrMatching_pattern[a];
                            // Key Formation
                            var replacingKeyFormation = ''
                            if (element == '$ROOTSCODE') {
                                replacingKeyFormation = 'ROOT_SCODE';
                            }
                            else if (element == '$SCODE') {
                                replacingKeyFormation = 'S_CODE';
                            }
                            else if (element == '$APPID') {
                                replacingKeyFormation = 'APP_ID';
                            }
                            else if (element == '$APPCODE') {
                                replacingKeyFormation = 'APP_CODE';
                            }
                            else if (element == '$TENANTID') { // st_code need
                                replacingKeyFormation = 'TENANT_ID';
                            }
                            // Checking the Key existing in Session
                            if (ObjReplacingContent && replacingKeyFormation in ObjReplacingContent) {
                                matching_pattern = matching_pattern.replace(element, ObjReplacingContent[replacingKeyFormation]);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Matching Pattern value is not Replaced', pLogInfo);
                                reqInstanceHelper.PrintInfo(serviceName, 'Session Value - ' + ObjReplacingContent, pLogInfo);
                            }
                        }
                        // for (const key in ObjReplacingContent) {
                        //     matching_pattern = matching_pattern.replace('$' + key, ObjReplacingContent[key]);
                        // }
                    }
                    if (file_extension) {
                        var arrFile_name_extension = fileName.split('.');
                        var arrfile_extension_pattern = file_extension.split('.');
                        if (arrFile_name_extension[arrFile_name_extension.length - 1] && arrfile_extension_pattern[arrfile_extension_pattern.length - 1] && arrfile_extension_pattern[arrfile_extension_pattern.length - 1].toLowerCase() == arrFile_name_extension[arrFile_name_extension.length - 1].toLowerCase()) {
                            isValidFileExtension = true;
                        } else {
                            isValidFileExtension = false;
                        }
                    }
                    reqInstanceHelper.PrintInfo(serviceName, 'Matching Pattern - ' + matching_pattern, pLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'File Extension - ' + file_extension, pLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'File Extension Validation Result - ' + isValidFileExtension, pLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'File Name - ' + fileName, pLogInfo);
                    if (isValidMatchingFile(fileName, matching_pattern, pLogInfo) && isValidFileExtension) {
                        var obj = {};
                        obj["name"] = fileName;
                        obj["matching_pattern"] = matching_pattern;
                        obj["ff_Id"] = ff_id
                        obj["parent_ff_Id"] = childffg
                        obj["childfiles"] = []

                        if (files[fileindex]["size"] != undefined) {
                            obj["size"] = files[fileindex]["size"];
                        }
                        if (ischild == "true") {
                            childarray.push(obj)
                        } else {
                            validFiles.push(obj);
                            break;
                        }
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Matching Pattern or File Extenssion Failed File - ' + fileName, pLogInfo);
                        inValidFiles.push(fileName);
                    }
                } else {
                    var obj = {};
                    obj["name"] = fileName;
                    obj["matching_pattern"] = '';
                    obj["ff_Id"] = ff_id
                    obj["parent_ff_Id"] = childffg
                    obj["childfiles"] = []

                    if (files[fileindex]["size"] != undefined) {
                        obj["size"] = files[fileindex]["size"];
                    }

                    if (ischild == "true") {
                        childarray.push(obj)
                    } else {
                        validFiles.push(obj);
                        break;
                    }
                }
            }
        }

        for (var i = 0; i < childarray.length; i++) {
            for (var j = 0; j < validFiles.length; j++) {
                if (childarray[i].parent_ff_Id == validFiles[j].ff_Id) {
                    validFiles[j]["childfiles"].push(childarray[i])

                }
            }
        }

        return {
            validFiles,
            inValidFiles
        };
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-EXG-120075', 'Catch Error in CheckMatchingPattern()...', error);
        return {
            validFiles,
            inValidFiles
        };
    }
}

function isValidMatchingFile(fileName, matchingPattern, pLogInfo) {
    if (matchingPattern && fileName) {
        return minimatch(fileName.toLowerCase(), matchingPattern.toLowerCase());
    } else {
        return true;
    }
}


// Params should contains
// CLIENT_ID
// TENANT_ID
// clt_cas_instance
// gateway_type
// cert_location_type
function GetPrivateKeyStoreFTPInfo(params, objLogInfo, GetPrivateKeyStoreFTPInfoCB) {
    try {
        if (params.gateway_type == 'SFTP' && params.cert_location_type && params.cert_location_type.toUpperCase() == 'SFTP') {
            // Getting Privatekey store FTP Informations
            var arrTenantSetupCategory = ['EXG_PKI_STORE'];
            var tenantSetupCondObj = {
                // 'client_id': params.CLIENT_ID,
                'tenant_id': params.TENANT_ID,
                'category': arrTenantSetupCategory
            };
            reqFXDBInstance.GetTableFromFXDB(params.clt_cas_instance, 'TENANT_SETUP', [], tenantSetupCondObj, objLogInfo, function (tenant_setup_error, result) {
                if (tenant_setup_error) {
                    var errorMsg = 'Error While Getting Data From TENANT_SETUP based on Categories like ' + arrTenantSetupCategory.toString();
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120084', errorMsg, tenant_setup_error);
                    GetPrivateKeyStoreFTPInfoCB(tenant_setup_error, null);
                } else {
                    GetPrivateKeyStoreFTPInfoCB(null, result.rows);
                }
            });
        } else {
            GetPrivateKeyStoreFTPInfoCB(null);
        }
    } catch (error) {

        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-EXG-120083', 'Catch Error in GetPrivateKeyStoreFTPInfo()...', error);
        GetPrivateKeyStoreFTPInfoCB(error, null);
    }
}

async function GetExGatewayDetails(pSession, pGatewayCond, objLogInfo, pcallback) {
    try {
        if (pSession.DBConn.DBType == 'pg') {
            await reqFXDBInstance.setSearchPath(pSession, ['dep_cas', 'tran_db', 'clt_cas'], objLogInfo)
            var query = `select client_id,app_id,exg_code,created_by,created_date,start_active_date,end_active_date,fn_pcidss_decrypt(gateway_config,$PCIDSS_KEY) as gateway_config ,gateway_name,gateway_type,handler_code,is_electronic,read_path,write_path,tenant_id from dep_tran.ex_gateways`;
            var whereCond = ''
            for (var key in pGatewayCond) {
                if (!whereCond) {
                    whereCond = ` where ${key}  ='${pGatewayCond[key]}'`
                } else {
                    whereCond = whereCond + ` and ${key}= '${pGatewayCond[key]}'`
                }
            }
            query = query + whereCond
            reqFXDBInstance.ExecuteQuery(pSession, query, objLogInfo, function (pErr, pResult) {
                pcallback(pErr, pResult)
            })
        } else {
            reqFXDBInstance.GetTableFromFXDB(pSession, 'EX_GATEWAYS', pGatewayCond, objLogInfo, function (pError, result) {
                pcallback(pError, result)
            })
        }

    } catch (error) {
        pcallback(error, '')
    }
}




module.exports = {
    ExportFile: exportFile,
    LoadExchangeSetting: loadExchangeSetting,
    LoadExchangeGateway: loadExchangeGateway,
    ImportFile: importFile,
    Getstoragepath: getstoragepath,
    UploadFile: uploadFile,
    GetSystemGateways: getSystemGateways,
    updateExchangeFileInfo: updateExchangeFileInfo,
    getExchangeFileFormatGroups: getExchangeFileFormatGroups,
    GetCreatedFiles: getCreatedFiles,
    UploadFileProcess: uploadFileProcess,
    AddTmpExHFInsertFailedPrctID: AddTmpExHFInsertFailedPrctID,
    GetGatewayDetails: getGatewayDetails,
    WritePrctToNullServiceLogFile: WritePrctToNullServiceLogFile,
    CheckServiceLogForFileUploadProcess: CheckServiceLogForFileUploadProcess,
    PrepareExgFileDownloadParams: PrepareExgFileDownloadParams,
    ExgFileDownloadWithRequiredParams: ExgFileDownloadWithRequiredParams,
    RemoveFileNameFromRedisSession: RemoveFileNameFromRedisSession,
    AddFilesToRedisSession: AddFilesToRedisSession,
    CheckMatchingPattern: CheckMatchingPattern,
    GetPrivateKeyStoreFTPInfo: GetPrivateKeyStoreFTPInfo,
    GetExGatewayDetails: GetExGatewayDetails
};