/**
 * @Author           : RABEESH V,
 * @Api_Name         : /ExgDeleteFTPFiles,
 * @Description      : Deleting the FTP Files From the Gateway based on Date Filter
 * @Platform_Version : 7.0
 * @LAST_ERROR_CODE  : ERR_EXGDELETEFTPFILE_1019
 */

// Require dependencies
var reqExpress = require('express');
var reqAsync = require('async');
var reqMoment = require('moment');
var router = reqExpress.Router();
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqSvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqFtpHelper = require('./helper/FTPHelper');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var serviceName = "ExgDeleteFTPFiles";

router.post('/ExgDeleteFTPFiles', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Exg FTP File Delete Process Begin', objLogInfo);
        objLogInfo.HANDLER_CODE = 'EXG_FTP_FILE_DELETE';
        objLogInfo.PROCESS = 'EXG_FTP_FILE_DELETE';
        objLogInfo.ACTION_DESC = 'ExgFtpFileDelete';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var reqObj = appRequest.body.PARAMS;
            var TENANT_ID = objSessionInfo.TENANT_ID;
            var CLIENT_ID = objSessionInfo.CLIENT_ID;
            var APP_ID = '';
            var PROGRAM_NAME = 'TORUS_EXCHANGE_API';
            var EXFFG_CODE = '';
            var GW_CODE = '';
            var pFFG_CODE_COND = '';
            var renamingFTPFolderName = '_ARCHIV';
            var ftpFileExpiringDuration = reqObj.EXPIRATION_DAYS; // In days
            var ftpFileExpInDate = '';
            if (reqObj.FFG_CODE) {
                pFFG_CODE_COND = " AND EH.EXFFG_CODE = '" + reqObj.FFG_CODE + "' "; // In days
            }
            var strExHeaderFileStatus = reqObj.FILE_STATUS || "'UPLOAD_COMPLETED', 'UPDATED'"; // FILE_STATUS = 'UPLOAD_COMPLETED', 'UPDATED' [Comma separated]
            var ACTION = reqObj.ACTION; // Used to Move/Delete FTP Files
            reqInstanceHelper.PrintInfo(serviceName, 'EXFFG_CODE - ' + pFFG_CODE_COND, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'File Status in EX_HEADER_FILES - ' + strExHeaderFileStatus, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'ACTION - ' + ACTION, objLogInfo);
            reqInstanceHelper.PrintInfo(serviceName, 'FTP File Expiring Duration In Days - ' + ftpFileExpiringDuration, objLogInfo);
            if (ftpFileExpiringDuration > -1 && ACTION) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                        reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                            var ffgAndGatewayList = "SELECT DISTINCT EH.APP_ID, EH.EXFFG_CODE, EH.EXG_CODE FROM EX_HEADER_FILES EHF INNER JOIN EX_HEADER EH ON EH.EXH_ID = EHF.EXH_ID WHERE EHF.TENANT_ID = '" + TENANT_ID + "' AND EHF.FILE_STATUS IN ( " + strExHeaderFileStatus + " ) AND EH.EXG_CODE IS NOT NULL " + pFFG_CODE_COND + " ORDER BY EH.EXG_CODE, EH.EXFFG_CODE";
                            // Getting FFG and Gateway list from EX_HEADER Table
                            reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, ffgAndGatewayList, objLogInfo, function (ffgAndGatewayResp, error) {
                                if (error) {
                                    var errorMsg = 'Error While Getting FFG and Gateway List From EX_HEADER Table';
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1017', errorMsg, error);
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_EXGDELETEFTPFILE_1017', errorMsg, error);
                                }
                                else if (ffgAndGatewayResp.rows.length) {
                                    // ffgAndGatewayResp.rows = [ffgAndGatewayResp.rows[0]]; // @@
                                    reqInstanceHelper.PrintInfo(serviceName, 'FFG and Gateway Data Count - ' + ffgAndGatewayResp.rows.length, objLogInfo);
                                    // Getting EXG_DOWNLOAD_MODE Informations
                                    var SKIP_FTP_DOWNLOAD = false;
                                    var cond = {
                                        setup_code: 'EXG_DOWNLOAD_MODE'
                                    };
                                    reqSvchelper.GetSetupJson(clt_cas_instance, cond, objLogInfo, function (res) {
                                        if (res.Status == 'SUCCESS') {
                                            if (res.Data.length) {
                                                var setup_json = JSON.parse(res.Data[0].setup_json);
                                                if (setup_json && setup_json.EXG_DOWNLOAD_MODE == 'LOGICAL') {
                                                    SKIP_FTP_DOWNLOAD = true;
                                                }
                                            }
                                            // Getting Storage Path Informations
                                            var arrTenantSetupCategory = ['EXG_STORAGE_PATH', 'EXG_STORAGE_PATH_TYPE', 'EXG_STORAGE_PATH_FTP_INFO', 'EXG_PKI_STORE'];
                                            var tenantSetupCondObj = {
                                                'client_id': CLIENT_ID,
                                                'tenant_id': TENANT_ID,
                                                'category': arrTenantSetupCategory
                                            };
                                            reqFXDBInstance.GetTableFromFXDB(clt_cas_instance, 'TENANT_SETUP', [], tenantSetupCondObj, objLogInfo, async function (tenant_setup_error, result) {
                                                if (tenant_setup_error) {
                                                    var errorMsg = 'Error While Getting Data From TENANT_SETUP based on Categories like ' + arrTenantSetupCategory.toString();
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1000', errorMsg, tenant_setup_error);
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_EXGDELETEFTPFILE_1000', errorMsg, tenant_setup_error);
                                                } else {
                                                    var ftpTypeStoragePathObj = {};
                                                    var StoragePathType = '';
                                                    var dbStoragePath = '';
                                                    var keystoresftpInfo = '';
                                                    for (var v = 0; v < result.rows.length; v++) {
                                                        const element = result.rows[v];
                                                        try {
                                                            if (element.category == 'EXG_STORAGE_PATH') {
                                                                // setup_json looks like {"NAME":"EXG_STORAGE_PATH","VALUE":"//home//torus//vph//"}
                                                                dbStoragePath = JSON.parse(element['setup_json'])['VALUE'] || '';
                                                            } else if (element.category == 'EXG_STORAGE_PATH_TYPE') {
                                                                // setup_json looks like { "NAME": "EXG_STORAGE_PATH_TYPE", "VALUE": "FTP" }
                                                                StoragePathType = JSON.parse(element['setup_json'])['VALUE'] || '';
                                                            } else if (element.category == 'EXG_PKI_STORE') {
                                                                var encdata = element['setup_json'];
                                                                var DecryptedSetupJson = await reqFXDBInstance.GetDecryptedData(clt_cas_instance, encdata, objLogInfo);
                                                                keystoresftpInfo = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(DecryptedSetupJson)])[0]; // JSON.parse(element['setup_json'])['VALUE'];
                                                                console.log('keystore - ' + JSON.stringify(keystoresftpInfo));
                                                            } else {
                                                                // setup_json looks like {"NAME":"EXG_STORAGE_PATH_TYPE","VALUE":{"IP":"192.168.2.203","PORT":"21","USERNAME":"dharani","PASSWORD":"Factory147"}}
                                                                ftpTypeStoragePathObj = reqInstanceHelper.ArrKeyToLowerCase([JSON.parse(element['setup_json'])])[0];
                                                            }
                                                        } catch (error) {
                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1001', 'Catch Error While parsing Data from Tenant Setup Json...', error);
                                                        }
                                                    }
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path - ' + dbStoragePath, objLogInfo);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - ' + StoragePathType, objLogInfo);
                                                    reqInstanceHelper.PrintInfo(serviceName, 'No. Of Expiring Days to Delete Old FTP Files - ' + ftpFileExpiringDuration, objLogInfo);
                                                    var dateFormat = '';
                                                    // Getting Eligible Files from the Ex_header_files table to Delete
                                                    if (tran_db_instance.DBConn.DBType.toLowerCase() == 'oracledb') {
                                                        dateFormat = 'DD-MON-YY';
                                                    } else {
                                                        dateFormat = 'YYYY-MM-DD';
                                                    }
                                                    reqAsync.forEachOfSeries(ffgAndGatewayResp.rows, function (eachRow, index, nextRow) {
                                                        APP_ID = eachRow.app_id;
                                                        GW_CODE = eachRow.exg_code;
                                                        EXFFG_CODE = eachRow.exffg_code;
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Process Started for TENANT_ID - ' + TENANT_ID + ' APP_ID - ' + APP_ID + ' GATEWAY CODE - ' + GW_CODE + ' FFG_CODE - ' + EXFFG_CODE, objLogInfo);
                                                        var query = "select exhf_id, file_name,file_size, file_status, eh.exg_code, eh.exffg_code,ehf.created_date  from EX_HEADER_FILES ehf inner join EX_HEADER eh on eh.EXH_ID = ehf.EXH_ID left join EX_FFG_FILE_PURGE EXFP on EXFP.exffg_code = eh.exffg_code and EXFP.app_id = '" + APP_ID + "' and EXFP.tenant_id = '" + TENANT_ID + "' and EXFP.program_name = 'TORUS_EXCHANGE_API' where eh.exffg_code= '" + EXFFG_CODE + "' and to_date(to_char(ehf.created_date, '" + dateFormat + "' ),  '" + dateFormat + "') <= (to_date(to_char( current_timestamp,  '" + dateFormat + "' ),  '" + dateFormat + "' ) - INTERVAL '" + ftpFileExpiringDuration + "' DAY) and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "' and ehf.file_status in (" + strExHeaderFileStatus + ") and (EXFP.purged_date IS NULL or to_date(to_char(ehf.created_date,  '" + dateFormat + "' ),  '" + dateFormat + "') >= (to_date(to_char( EXFP.purged_date,  '" + dateFormat + "' ),  '" + dateFormat + "' )))";
                                                        reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (eligibleFiles, error) {
                                                            if (error) {
                                                                var errorMsg = 'Error While Getting Eligible Files for Delete Process';
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1003', errorMsg, error);
                                                                nextRow();
                                                            } else if (eligibleFiles.rows.length) {
                                                                // eligibleFiles.rows = [eligibleFiles.rows[0]]; // @@
                                                                // Getting Gateway Informations
                                                                var exGatewayCond = {
                                                                    'exg_code': GW_CODE,
                                                                    // 'EXG_CODE': eligibleFiles.rows[0].exg_code,
                                                                    'CLIENT_ID': CLIENT_ID,
                                                                    'APP_ID': APP_ID,
                                                                    'TENANT_ID': TENANT_ID
                                                                };
                                                                ftpFileExpInDate = reqMoment().subtract(ftpFileExpiringDuration, 'days');

                                                                reqExchangeHelper.GetExGatewayDetails(dep_cas_instance, exGatewayCond, objLogInfo, function (error, result) {
                                                                    if (error) {
                                                                        var errorMsg = 'Error While Getting Gateway Data From EX_GATEWAYS Table...';
                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1009', errorMsg, error);
                                                                        nextRow();
                                                                    } else if (result.rows.length) {
                                                                        var exGatewaysResponse = result.rows[0];
                                                                        var gatewayConfig = exGatewaysResponse && JSON.parse(exGatewaysResponse.gateway_config) || {};
                                                                        gatewayConfig.keystoresftpInfo = keystoresftpInfo;
                                                                        var gatewayReadPath = exGatewaysResponse.read_path;
                                                                        var gatewayWritePath = exGatewaysResponse.write_path;
                                                                        var gatewayType = exGatewaysResponse.gateway_type;
                                                                        gatewayConfig.gateway_type = gatewayType;
                                                                        if (gatewayType == "FTP" || gatewayType == "SFTP") {
                                                                            var fTPFileDownloadStoragePathFFGLevel = gatewayReadPath;
                                                                            // var fTPFileDownloadStoragePathFFGLevel = 'Download\\' + TENANT_ID + '\\' + APP_ID + '\\' + EXFFG_CODE + '\\';
                                                                            // var fTPFileDownloadStoragePathFFGLevelForArchival = 'Download//' + TENANT_ID + '//' + APP_ID + '//' + EXFFG_CODE + renamingFTPFolderName + '//';
                                                                            var fTPFileUploadStoragePathFFGLevel = 'Upload\\' + TENANT_ID + '\\' + APP_ID + '\\' + EXFFG_CODE + '\\';
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Storage Path From DB - ' + dbStoragePath, objLogInfo);
                                                                            if (dbStoragePath) {
                                                                                // fTPFileDownloadStoragePathFFGLevel = dbStoragePath + fTPFileDownloadStoragePathFFGLevel;
                                                                                fTPFileUploadStoragePathFFGLevel = dbStoragePath + fTPFileUploadStoragePathFFGLevel;
                                                                            }

                                                                            // Need to Delete FTP Files From Three Areas like Main FTP, Sub FTP [Storage Path as FTP Type] and Local [As FTP For Windows Service]
                                                                            if (SKIP_FTP_DOWNLOAD) {
                                                                                gatewayConfig.deleteFromDownloadMainFTPFileFolderPath = fTPFileDownloadStoragePathFFGLevel; // Main FTP Path For Download
                                                                                gatewayConfig.deleteFromUploadMainFTPFileFolderPath = gatewayWritePath; // Main FTP Path For Upload
                                                                            } else {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Database Gateway Read Path - ' + gatewayReadPath, objLogInfo);
                                                                                gatewayReadPath = reqFtpHelper.RemoveSlashCharFrmString(gatewayReadPath) + '_processed\\';
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'After adding "_processed" with Gateway Read Path - ' + gatewayReadPath, objLogInfo);
                                                                                if (StoragePathType && StoragePathType == 'FTP' && ftpTypeStoragePathObj && Object.keys(ftpTypeStoragePathObj).length) { // To check whether Setup json has any data or not..
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - FTP Storage ', objLogInfo);
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'FTP Info For Database Storage Path - ' + JSON.stringify(ftpTypeStoragePathObj), objLogInfo);
                                                                                    gatewayConfig.ftpTypeStoragePathInfo = ftpTypeStoragePathObj;
                                                                                    // For File Download
                                                                                    gatewayConfig.deleteFromDownloadMainFTPFileFolderPath = gatewayReadPath; // Main FTP Path
                                                                                    gatewayConfig.deleteFromDownloadSubFTPFileFolderPath = fTPFileDownloadStoragePathFFGLevel; // Sub FTP Path
                                                                                    // For File Upload
                                                                                    gatewayConfig.deleteFromUploadMainFTPFileFolderPath = gatewayWritePath; // Main FTP Path
                                                                                    gatewayConfig.deleteFromUploadSubFTPFileFolderPath = fTPFileUploadStoragePathFFGLevel; // Main FTP Path
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Database Storage Path Type - Local Storage ', objLogInfo);
                                                                                    ftpTypeStoragePathObj = {};
                                                                                    gatewayConfig.deleteFromDownloadMainFTPFileFolderPath = gatewayReadPath; // Main FTP Path
                                                                                    gatewayConfig.deleteFromUploadMainFTPFileFolderPath = gatewayWritePath; // Main FTP Path
                                                                                    // gatewayConfig.deleteLinuxFileFolderPath = dbStoragePath + fTPFileDownloadStoragePathFFGLevel; // Local Path
                                                                                    gatewayConfig.deleteFromDownloadLinuxFileFolderPath = fTPFileDownloadStoragePathFFGLevel; // Local Path
                                                                                    gatewayConfig.deleteFromUploadLinuxFileFolderPath = fTPFileUploadStoragePathFFGLevel; // Local Path
                                                                                }
                                                                            }
                                                                            // storagePath = "D:\\exchange\\storage\\";
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'After Adding TENANT_ID, APP_ID, FFG_CODE to the Storage Path - ' + dbStoragePath, objLogInfo);
                                                                            if (ACTION.toUpperCase() == 'REDIS') {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Going to DELETE File Names From the Redis DB - 7', objLogInfo);
                                                                                RemovingFilesFromRedis(null, function (error, result) {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Process Completed for TENANT_ID - ' + TENANT_ID + ' APP_ID - ' + APP_ID + ' GATEWAY CODE - ' + GW_CODE + ' FFG_CODE - ' + EXFFG_CODE, objLogInfo);
                                                                                    return nextRow();
                                                                                });
                                                                            }
                                                                            else if (ACTION.toUpperCase() == 'DELETE') {
                                                                                // File Deleting Process
                                                                                //Send Private key in gatewayConfig 
                                                                                // gatewayConfig = { "ip": "192.168.2.203", "port": "22", "username": "sftpuser", "passphrase": "Welcome@100", "cert_file_name": "cert\\rbs.pem", "cert_location_type": "SFTP" };
                                                                                // gatewayConfig.gateway_type = 'SFTP';

                                                                                reqFtpHelper.DeleteFTPFiles(eligibleFiles.rows, gatewayConfig, objLogInfo, function (DeleteFTPFilesError, DeleteFTPFilesResult) {
                                                                                    if (DeleteFTPFilesError) {
                                                                                        var errorMsg = 'Error While Deleting Eligible FTP Files';
                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1004', errorMsg, DeleteFTPFilesError);
                                                                                        nextRow();
                                                                                    } else {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Delete FTP File Result - ' + JSON.stringify(DeleteFTPFilesResult), objLogInfo);
                                                                                        UpdateFTPFileDeleteProcessInfo();
                                                                                    }
                                                                                });
                                                                            } else {
                                                                                // File Moving Process
                                                                                var EligibleMovingFiles = [];
                                                                                var moveFromForDownload = '';
                                                                                var moveToForDownload = '';
                                                                                var moveFromForUpload = '';
                                                                                var moveToForUpload = '';
                                                                                for (let j = 0; j < eligibleFiles.rows.length; j++) {
                                                                                    const element = eligibleFiles.rows[j];
                                                                                    try {
                                                                                        EligibleMovingFiles.push(JSON.parse(JSON.stringify(element)));
                                                                                    } catch (error) {
                                                                                        console.log(error);
                                                                                    }
                                                                                }
                                                                                if (SKIP_FTP_DOWNLOAD) {
                                                                                    // For Download
                                                                                    moveFromForDownload = fTPFileDownloadStoragePathFFGLevel;
                                                                                    moveToForDownload = reqFtpHelper.RemoveSlashCharFrmString(fTPFileDownloadStoragePathFFGLevel) + renamingFTPFolderName + '\\';
                                                                                    // For Upload
                                                                                    moveFromForUpload = gatewayWritePath;
                                                                                    moveToForUpload = reqFtpHelper.RemoveSlashCharFrmString(gatewayWritePath) + renamingFTPFolderName + '\\';
                                                                                }
                                                                                // Adding Src File Path and Destination File Path
                                                                                for (var fileObj of EligibleMovingFiles) {
                                                                                    // For Download
                                                                                    fileObj.srcPathForDownload = moveFromForDownload;
                                                                                    fileObj.destPathForDownload = moveToForDownload;
                                                                                    // For Upload
                                                                                    fileObj.srcPathForUpload = moveFromForUpload;
                                                                                    fileObj.destPathForUpload = moveToForUpload;
                                                                                }
                                                                                gatewayConfig.isFromFTPFileDeleteProcess = true;

                                                                                // To Create Folders For Download, If Folder Does not existing in FTP
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Creating Ftp Folder For Download Process- ' + moveToForDownload, objLogInfo);
                                                                                reqFtpHelper.createFolder(moveToForDownload, gatewayConfig, objLogInfo)
                                                                                    .then((result) => {

                                                                                        // To Create Folders For Upload, If Folder Does not existing in FTP
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Creating Ftp Folder For Upload Process- ' + moveToForUpload, objLogInfo);
                                                                                        reqFtpHelper.createFolder(moveToForUpload, gatewayConfig, objLogInfo)
                                                                                            .then((result) => {
                                                                                                reqFtpHelper.changeFilePath(EligibleMovingFiles, gatewayConfig, objLogInfo).then((responseChangeFiles) => {
                                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Renaming FTP File Path Result - ' + JSON.stringify(responseChangeFiles), objLogInfo);
                                                                                                    UpdateFTPFileDeleteProcessInfo();
                                                                                                });
                                                                                            })
                                                                                            .catch((error) => {
                                                                                                nextRow();
                                                                                            })

                                                                                    })
                                                                                    .catch((error) => {
                                                                                        nextRow();
                                                                                    })
                                                                            }

                                                                            function RemovingFilesFromRedis(params, RemovingFilesFromRedisCB) {
                                                                                try {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Removing Files from the Redis DB 7 Session', objLogInfo);
                                                                                    var RemoveFileNameFromRedisSessionReqObj = {};
                                                                                    RemoveFileNameFromRedisSessionReqObj.objLogInfo = objLogInfo;
                                                                                    RemoveFileNameFromRedisSessionReqObj.TENANT_ID = TENANT_ID;
                                                                                    RemoveFileNameFromRedisSessionReqObj.APP_ID = APP_ID;
                                                                                    RemoveFileNameFromRedisSessionReqObj.FILES = eligibleFiles.rows;
                                                                                    RemoveFileNameFromRedisSessionReqObj.EXFFG_CODE = EXFFG_CODE;
                                                                                    RemoveFileNameFromRedisSessionReqObj.DB = 7;
                                                                                    reqExchangeHelper.RemoveFileNameFromRedisSession(RemoveFileNameFromRedisSessionReqObj, RemovingFilesFromRedisCB);
                                                                                } catch (error) {
                                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1019', errorMsg, error);
                                                                                    RemovingFilesFromRedisCB(null, error);
                                                                                }
                                                                            }


                                                                            function UpdateFTPFileDeleteProcessInfo(params) {
                                                                                try {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Removing Files from the Redis DB 7 Session', objLogInfo);
                                                                                    RemovingFilesFromRedis(null, function (error, result) {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Updating the FTP File Delete Process Results...', objLogInfo);
                                                                                        // Getting data from EX_FFG_FILE_PURGE
                                                                                        var condObj = {
                                                                                            'EXFFG_CODE': EXFFG_CODE,
                                                                                            'TENANT_ID': TENANT_ID,
                                                                                            'APP_ID': APP_ID
                                                                                            , 'PROGRAM_NAME': PROGRAM_NAME
                                                                                        };
                                                                                        // Update the purged date in EX_FFG_FILE_PURGE Table
                                                                                        reqTranDBInstance.GetTableFromTranDB(tran_db_instance, 'EX_FFG_FILE_PURGE', condObj, objLogInfo, function (exFfgFilePurgeResult, exFfgFilePurgeError) {
                                                                                            if (exFfgFilePurgeError) {
                                                                                                var errorMsg = 'FTP Files Successfully Deleted but Failed to Get Informations From Table...';
                                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1015', errorMsg, exFfgFilePurgeError);
                                                                                                nextRow();
                                                                                            } else if (exFfgFilePurgeResult.length) {
                                                                                                // Update Case
                                                                                                var updateColumn = {
                                                                                                    'PURGED_DATE': reqDateFormatter.GetDateAt12AM(mHeaders, objLogInfo, ftpFileExpInDate)
                                                                                                };
                                                                                                var purgeCondInfo = {
                                                                                                    'EXFFG_CODE': EXFFG_CODE,
                                                                                                    'TENANT_ID': TENANT_ID,
                                                                                                    'APP_ID': APP_ID
                                                                                                    , 'PROGRAM_NAME': PROGRAM_NAME,
                                                                                                };
                                                                                                reqTranDBInstance.UpdateTranDBWithAudit(tran_db_instance, 'EX_FFG_FILE_PURGE', updateColumn, purgeCondInfo, objLogInfo, function (result, error) {
                                                                                                    if (error) {
                                                                                                        var errorMsg = 'FTP Files Successfully Deleted but Failed to Update Informations in Table...';
                                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1014', errorMsg, '');
                                                                                                    } else {
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'EX_FFG_FILE_PURGE Update Process Successfully Completed...', objLogInfo);
                                                                                                    }
                                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'FTP File Delete Process Completed for TENANT_ID - ' + TENANT_ID + ' APP_ID - ' + APP_ID + ' GATEWAY CODE - ' + GW_CODE + ' FFG_CODE - ' + EXFFG_CODE, objLogInfo);
                                                                                                    nextRow();
                                                                                                });
                                                                                            } else {
                                                                                                // Insert Case
                                                                                                reqInstanceHelper.PrintInfo(serviceName, 'EX_FFG_FILE_PURGE Insert Process Started', objLogInfo);
                                                                                                var purgeInfo = {
                                                                                                    'EXFFG_CODE': EXFFG_CODE,
                                                                                                    'TENANT_ID': TENANT_ID,
                                                                                                    'APP_ID': APP_ID,
                                                                                                    'PURGED_DATE': reqDateFormatter.GetDateAt12AM(mHeaders, objLogInfo, ftpFileExpInDate)
                                                                                                    , 'PROGRAM_NAME': PROGRAM_NAME
                                                                                                };
                                                                                                reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, 'EX_FFG_FILE_PURGE', [purgeInfo], objLogInfo, function (result, error) {
                                                                                                    if (error) {
                                                                                                        var errorMsg = 'FTP Files Successfully Deleted but Failed to Update Informations in EX_FFG_FILE_PURGE Table...';
                                                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1012', errorMsg, '');
                                                                                                    } else {
                                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'EX_FFG_FILE_PURGE Insert Process Successfully Completed and FTP Files Successfully Deleted', objLogInfo);
                                                                                                    }
                                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'FTP File Delete Process Completed for TENANT_ID - ' + TENANT_ID + ' APP_ID - ' + APP_ID + ' GATEWAY CODE - ' + GW_CODE + ' FFG_CODE - ' + EXFFG_CODE, objLogInfo);
                                                                                                    nextRow();
                                                                                                });
                                                                                            }
                                                                                        });
                                                                                    });
                                                                                } catch (error) {
                                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1018', 'Catch Error in UpdateFTPFileDeleteProcessInfo()', '');
                                                                                    nextRow();
                                                                                }
                                                                            }
                                                                        }

                                                                        else {
                                                                            // Local Gateway type 
                                                                            var errorMsg = 'Gateway Type as LOCAL is Not Implemented Yet...';
                                                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1008', errorMsg, '');
                                                                            nextRow();
                                                                        }
                                                                    }
                                                                    else {
                                                                        var errorMsg = 'There is No Gateway Data Found...';
                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1006', errorMsg, '');
                                                                        nextRow();
                                                                    }
                                                                });
                                                            }
                                                            else {
                                                                // No Eligible Data Error
                                                                var errorMsg = 'There is No Eligible Files to Start a FTP File Delete Process...';
                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1010', errorMsg, '');
                                                                nextRow();
                                                            }
                                                        });
                                                    }
                                                        , function () {
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, 'FTP Files Deleting Process Completed', objLogInfo, '', '', '');
                                                        });
                                                }
                                            });

                                        } else {
                                            var errorMsg = 'Error While Getting EXG_DOWNLOAD_MODE Data...';
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1007', errorMsg, '');
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_EXGDELETEFTPFILE_1007', errorMsg, '');
                                        }
                                    });
                                } else {
                                    // No FFG and Gateway Data from EX_HEADER
                                    var errorMsg = 'There is No Data From EX_HEADER Table to get the FFG and Gateway List...';
                                    //reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1016', errorMsg, '');
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_EXGDELETEFTPFILE_1016', errorMsg, '');
                                }
                            });
                        });
                    });
                });
            } else {
                var errorMsg = '';
                if (!ftpFileExpiringDuration > -1) {
                    errorMsg = 'Expiring Duration is Required for FTP File Delete Process...';
                }
                if (!ACTION) {
                    errorMsg = 'Action is Required for FTP File Delete Process like File Delete/Move ...';
                }
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1011', errorMsg, '');
                return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_EXGDELETEFTPFILE_1011', errorMsg, '');
            }
        } catch (error) {
            var errorMsg = 'Catch Error in FTP File Delete Process...';
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1005', errorMsg, error);
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR_EXGDELETEFTPFILE_1005', errorMsg, error);
        }
    });
});


module.exports = router;