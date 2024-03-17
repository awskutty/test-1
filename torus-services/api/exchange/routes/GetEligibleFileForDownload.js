/**
 * @Api_Name        : /ExgImportDownload,
 * @Description     : Import file from specified path
 * @Last_Error_Code : ERR-EXC-1000 
 */

// Require dependencies
var dir_path = '../../../../';
var modPath = dir_path + 'node_modules/';
var refPath = dir_path + 'torus-references/';
var reqExpress = require(modPath + 'express');
var reqInstanceHelper = require(refPath + 'common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqFXDBInstance = require(refPath + 'instance/DBInstance');
var reqTranDBInstance = require(refPath + 'instance/TranDBInstance');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var router = reqExpress.Router();
var reqLogInfo = require(refPath + 'log/trace/LogInfo');
var async = require(modPath + 'async');
var ftpHelper = require('./helper/FTPHelper');
var serviceName = "EXGImportDownload";
var commonFile = require('./util/Common')
var fs = require('async');
var path = require("path");
var reqAuditLog = require(refPath + 'log/audit/AuditLog');
var minimatch = require(modPath + 'minimatch');

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
router.post('/GetEligibleFileForDownload', function (appRequest, appResponse) {
    var objLogInfo = "";
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        var isLatestPlatformVersion = false;
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, objLogInfo);
            isLatestPlatformVersion = true;
        }
        var prct_id = '';
        var from_scheduler = false;
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        reqInstanceHelper.PrintInfo(serviceName, 'objLogInfoFromExg - ' + appRequest.body.objLogInfoFromExg || false, objLogInfo);
        if (appRequest.body.objLogInfoFromExg) {
            reqInstanceHelper.PrintInfo(serviceName, 'Called GetEligibleFileForDownload', objLogInfo);
            from_scheduler = true;
            objLogInfo = appRequest.body.objLogInfoFromExg;
            prct_id = appRequest.body.objLogInfoFromExg['prct_id'];
        }
        reqInstanceHelper.PrintInfo(serviceName, 'From_scheduler - ' + from_scheduler, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'PRCT_ID From ExgImportDownload - ' + appRequest.body.objLogInfoFromExg.prct_id, objLogInfo);

        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.HANDLER_CODE = 'EXG_FILE_CREATION';
        objLogInfo.PROCESS = 'EXG_FILE_CREATION-GetEligibleFileForDownload';
        objLogInfo.ACTION_DESC = 'GetEligibleFileForDownload';
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            var reqBody = appRequest.body.PARAMS;
            var reqObj = reqBody;
            var TENANT_ID = objSessionInfo.TENANT_ID;
            reqObj.TENANT_ID = TENANT_ID;
            reqObj.tenant_id = TENANT_ID;
            var FFG_CODE = reqBody.FFG_CODE;
            var GW_CODE = reqBody.GW_CODE;
            var Des_sys = reqBody.Des_sys;
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
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function (dep_cas_instance) {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    reqTranDBInstance.GetTranDBConn(mHeaders, true, function (tran_db_instance) {

                        getOrCreateProcessToken(tran_db_instance, objLogInfo, prct_id).then((prct_id_new) => {
                            try {
                                prct_id = prct_id_new;
                                reqInstanceHelper.PrintInfo(serviceName, 'PRCT ID IS ' + prct_id, objLogInfo)
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
                                            exGatewayCond.TENANT_ID = TENANT_ID;
                                        }
                                        // reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_gateways', [], exGatewayCond, objLogInfo, function (error, result) {
                                        reqExchangeHelper.GetExGatewayDetails(dep_cas_instance, exGatewayCond, objLogInfo, function (error, result) {
                                            if (error) {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, "ERR-EXG-", "Error while getting data from ex_gateways", error);
                                            } else {
                                                if (result.rows.length > 0) {
                                                    var exGatewaysResponse = result.rows[0];
                                                    if (exGatewaysResponse.gateway_type === "FTP") {
                                                        var ftpConfig = JSON.parse(exGatewaysResponse.gateway_config);
                                                        ftpConfig.FOLDERPATH = exGatewaysResponse.read_path;
                                                        ftpConfig.log_info = objLogInfo;
                                                        try {
                                                            var exchangeFileInfoRequest = "";
                                                            var FtpFiles = "";
                                                            var removedSlashReadPath = '';
                                                            async.series([
                                                                function (asyncSeriesCallBack) {
                                                                    var selected_files_from_screen = appRequest.body.selected_files;
                                                                    if (selected_files_from_screen && selected_files_from_screen.length) {
                                                                        var data = [];
                                                                        for (var index = 0; index < selected_files_from_screen.length; index++) {
                                                                            if ((selected_files_from_screen)[index] === undefined) {
                                                                                break;
                                                                            } else {
                                                                                var ObjFile = selected_files_from_screen[index];
                                                                                ObjFile['STATUS'] = 'DOWNLOADED';
                                                                                // ObjFile['size'] = Math.ceil(ObjFile["size"] / 1024) + "KB";
                                                                                data.push(ObjFile);
                                                                            }
                                                                        }
                                                                        FtpFiles = data;
                                                                        asyncSeriesCallBack();
                                                                    } else {
                                                                        ftpHelper.getFileList(ftpConfig, function (callbackFtpFiles) {
                                                                            if (callbackFtpFiles.STATUS === "SUCCESS") {
                                                                                var tempdata = callbackFtpFiles.DATA;
                                                                                var data = [];
                                                                                fileData = checkMatchingPattern(tempdata, ffg_json);

                                                                                if (fileData.length === 0) {
                                                                                    SendSuccessResponse([], "No Files In FTP")
                                                                                }
                                                                                else {
                                                                                    // for (var index = 0; index < fileData.length; index++) {
                                                                                    for (var index = 0; index < 1000; index++) {
                                                                                        if (fileData[index] === undefined) {
                                                                                            break;
                                                                                        } else {
                                                                                            var ObjFile = fileData[index];
                                                                                            ObjFile['STATUS'] = 'DOWNLOADED';
                                                                                            ObjFile['size'] = Math.ceil(ObjFile["size"] / 1024) + "KB";
                                                                                            data.push(ObjFile);
                                                                                        }
                                                                                    }
                                                                                    FtpFiles = data;
                                                                                    asyncSeriesCallBack();
                                                                                }
                                                                            } else {
                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, '', '', callbackFtpFiles.MESSAGE, 'FAILURE');
                                                                            }
                                                                        });
                                                                    }

                                                                },
                                                                function (asyncSeriesCallBack) {// To Create "_inprogress" Folder If Folder Does not exist in FTP 
                                                                    removedSlashReadPath = ftpConfig.FOLDERPATH;
                                                                    removedSlashReadPath = ftpHelper.RemoveSlashCharFrmString(removedSlashReadPath);
                                                                    ftpHelper.createFolder(removedSlashReadPath + "_inprogress", ftpConfig, objLogInfo)
                                                                        .then((result) => {
                                                                            console.log(result)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                        .catch((error) => {
                                                                            console.log(error)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                },
                                                                function (asyncSeriesCallBack) {// To Create "_processed" Folder If Folder Does not exist in FTP 
                                                                    ftpHelper.createFolder(removedSlashReadPath + "_processed", ftpConfig, objLogInfo)
                                                                        .then((result) => {
                                                                            console.log(result)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                        .catch((error) => {
                                                                            console.log(error)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                },
                                                                function (asyncSeriesCallBack) {// To Create "_duplicate" Folder If Folder Does not exist in FTP 
                                                                    ftpHelper.createFolder(removedSlashReadPath + "_duplicate", ftpConfig, objLogInfo)
                                                                        .then((result) => {
                                                                            console.log(result)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                        .catch((error) => {
                                                                            console.log(error)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                },
                                                                function (asyncSeriesCallBack) {// To Create "_failed" Folder If Folder Does not exist in FTP 
                                                                    ftpHelper.createFolder(removedSlashReadPath + "_failed", ftpConfig, objLogInfo)
                                                                        .then((result) => {
                                                                            console.log(result)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                        .catch((error) => {
                                                                            console.log(error)
                                                                            asyncSeriesCallBack();
                                                                        })
                                                                },
                                                                function (asyncSeriesCallBack) {
                                                                    var filesToRename = [];
                                                                    var moveFrom = ftpConfig.FOLDERPATH;
                                                                    var moveTo = removedSlashReadPath + "_inprogress\\";
                                                                    for (var file of FtpFiles) {
                                                                        var obj = {
                                                                            "file_name": file.name,
                                                                            "fromPath": moveFrom,
                                                                            "toPath": moveTo
                                                                        }
                                                                        filesToRename.push(obj);
                                                                    }
                                                                    ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo).then((responseChangeFiles) => {
                                                                        var StatusCount = responseChangeFiles['StatusCount'];
                                                                        var successFiles = responseChangeFiles['SucessFiles'];
                                                                        var failedFiles = responseChangeFiles['FailedFiles'];
                                                                        var successFilesRenaming = [];
                                                                        for (var file of FtpFiles) {
                                                                            if (successFiles.indexOf(file['name']) != -1) {
                                                                                successFilesRenaming.push(file);
                                                                            }
                                                                        }
                                                                        FtpFiles = successFilesRenaming;
                                                                        if (FtpFiles.length === 0) {
                                                                            // send error
                                                                            SendErrorResponse("Files moving to temp folder failed", failedFiles);
                                                                        } else {
                                                                            asyncSeriesCallBack();
                                                                        }
                                                                    }).catch((err) => {
                                                                        SendErrorResponse("Files moving to temp folder failed", err);
                                                                    })
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
                                                                    for (var i = 0; i < files.length; i++) {
                                                                        if (files[i].childfiles && files[i].childfiles.length) {
                                                                            for (var j = 0; j < files[i].childfiles.length; j++) {
                                                                                var tempObj = {
                                                                                    "file_name": files[i].childfiles[j]["name"],
                                                                                    "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                                                    "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
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
                                                                                "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                                "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID,
                                                                                "status": "INPROGRESS",
                                                                                "exg_code": exGatewaysResponse.exg_code
                                                                            }
                                                                            tempFiles.push(tempObj);
                                                                        }
                                                                    }
                                                                    var prct_id = objLogInfo.PROCESS_INFO.PRCT_ID;

                                                                    // INSERT INTO "TMP_EX_HEADER_FILES"
                                                                    reqTranDBInstance.InsertBulkTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", tempFiles, reqObj.objLogInfo, null, function (result, error) {
                                                                        if (error) {
                                                                            reqInstanceHelper.PrintError(serviceName, reqObj.objLogInfo, 'errcode', 'errmsg', error);
                                                                        } else {
                                                                            if (tempFiles[tempFiles.length - 1] == ",") {
                                                                                tempFiles = tempFiles.slice(0, -1);
                                                                            }
                                                                            reqTranDBInstance.Commit(tran_db_instance, true, function () {
                                                                                var TmpTableChk = "select distinct T2.file_name FROM TMP_EX_HEADER_FILES T1 INNER join TMP_EX_HEADER_FILES T2 ON T1.file_name = T2.file_name WHERE T2.prct_id = '" + prct_id + "' and T1.prct_id <> '" + prct_id + "'";
                                                                                reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, TmpTableChk, reqObj.objLogInfo, function (resDupInTmpTable, error) {

                                                                                    //var tresultTmpTableChk = resDupInTmpTable.rows;
                                                                                    var tresultTmpTableChkFiles = [];
                                                                                    for (var temp of resDupInTmpTable.rows) {
                                                                                        tresultTmpTableChkFiles.push(temp.file_name)
                                                                                    }

                                                                                    var query = "select ehf.exhf_id,ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED') and exffg_code= '" + FFG_CODE + "' and tmp.prct_id= '" + prct_id + "'  "
                                                                                    reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, reqObj.objLogInfo, function (result, error) {

                                                                                        var dupFilesFromExhf = result.rows;
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from TMP_EX_HEADER_FILES ' + dupFilesFromExhf.length, objLogInfo)

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

                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from FTP ' + tempfileArr.length, objLogInfo);
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from QUERY ' + filesTemp.length, objLogInfo);

                                                                                        var remainingFiles = [];
                                                                                        remainingFiles = tempfileArr.diff(tresultTmpTableChkFiles);
                                                                                        remainingFiles = remainingFiles.diff(filesTemp);
                                                                                        var filesToRename = [];
                                                                                        var arrTotalDupFileList = [];
                                                                                        //Adding Duplicated File Names
                                                                                        arrTotalDupFileList = arrTotalDupFileList.concat(tresultTmpTableChkFiles);
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Temp Table Duplicated List - ' + arrTotalDupFileList.length, objLogInfo);
                                                                                        arrTotalDupFileList = arrTotalDupFileList.concat(filesTemp);
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Duplicated List From Query - ' + arrTotalDupFileList.length, objLogInfo);
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Removing Duplicates from  - ' + JSON.stringify(arrTotalDupFileList), objLogInfo);
                                                                                        arrTotalDupFileList = removeDuplElm(arrTotalDupFileList);
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'After Removing Duplicated Entries - ' + arrTotalDupFileList.length, objLogInfo);
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'After Removing Duplicated Entries - ' + JSON.stringify(arrTotalDupFileList), objLogInfo);
                                                                                        var moveFrom = removedSlashReadPath + "_inprogress" + "\\\\";
                                                                                        var moveTo = removedSlashReadPath + "_duplicate" + "\\\\";
                                                                                        if (arrTotalDupFileList.length) {
                                                                                            for (var file of arrTotalDupFileList) {
                                                                                                var obj = {
                                                                                                    "file_name": file,
                                                                                                    "fromPath": moveFrom,
                                                                                                    "toPath": moveTo
                                                                                                }
                                                                                                filesToRename.push(obj);
                                                                                            }
                                                                                            // For Moving Donwloaded Files to read_path+'_duplicate' Path
                                                                                            ftpHelper.changeFilePath(filesToRename, ftpConfig, objLogInfo).then(() => {
                                                                                                preparingResponseData();
                                                                                            }).catch((err) => {
                                                                                                SendErrorResponse("Files moving to _duplicate folder failed", err);
                                                                                            })
                                                                                        } else {
                                                                                            preparingResponseData();
                                                                                        }

                                                                                        function preparingResponseData() {
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Remaining Files Count ' + remainingFiles.length, objLogInfo);
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
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count ' + resData.length, objLogInfo)
                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Not Calling delete TMP_EX_HEADER_FILES', objLogInfo)
                                                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, resData, objLogInfo, '', '', '');
                                                                                        }
                                                                                    });
                                                                                });
                                                                            });
                                                                        }
                                                                    })
                                                                }
                                                            ])
                                                        } catch (ex) {
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, '', '', ex, 'FAILURE');
                                                        }
                                                    } else if (exGatewaysResponse.gateway_type === "Local" || exGatewaysResponse.gateway_type === "LOCAL") {
                                                        var read_path = exGatewaysResponse.read_path;
                                                        var write_path = exGatewaysResponse.write_path;

                                                        reqObj['tenant_id'] = objSessionInfo['TENANT_ID'];
                                                        reqObj['TENANT_ID'] = objSessionInfo['TENANT_ID'];

                                                        reqExchangeHelper.Getstoragepath(reqObj, function (storagePath) {

                                                            //read_path = "D:\\exchange\\read\\";
                                                            fs.readdir(read_path, function (err, files) {
                                                                if (err) {
                                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, "ERR-EXG-", "Error while transferring files from read path to local", "");
                                                                }
                                                                var fileArr = []
                                                                var tempFiles = [];
                                                                for (var x = 0; x < files.length; x++) {
                                                                    tempFiles.push({
                                                                        "name": files[x]
                                                                    })
                                                                }

                                                                files = checkMatchingPattern(tempFiles, ffg_json);
                                                                async.forEachOf(files, function (value, key, asyncCallback) {
                                                                    fileArr.push({
                                                                        "name": value["name"],
                                                                        "size": Math.ceil(fs.statSync(path.join(read_path, value["name"])).size / 1024) + "KB",
                                                                        "matching_pattern": value["matching_pattern"],
                                                                        "fileName": value["name"],
                                                                    })
                                                                    // fs.createReadStream(path.join(read_path, value)).pipe(fs.createWriteStream(path.join(storagePath, value)));
                                                                    asyncCallback();
                                                                }, function (err) {
                                                                    if (!err) {
                                                                        var files = fileArr;
                                                                        var tempFiles = [];
                                                                        for (var i in files) {
                                                                            var tempObj = {
                                                                                "file_name": files[i]["name"],
                                                                                "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                                                "CREATED_DATE": reqDateFormatter.GetCurrentDateInUTC(mHeaders, objLogInfo)
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

                                                                                var query = "select ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED') and exffg_code= '" + FFG_CODE + "' "
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
                                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, resData, objLogInfo, '', '', '');
                                                                                            }
                                                                                        }
                                                                                    })
                                                                                });
                                                                            }
                                                                        })
                                                                    } else {
                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, '', '', "", 'FAILURE');
                                                                    }
                                                                })
                                                            });
                                                        });
                                                    } else {
                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, "ERR-EXG-", "Error while transferring files from read path to local", "");
                                                    }
                                                } else {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, "ERR-EXG-", "No Gateway Information Found", "");
                                                }
                                            }
                                        })

                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, callbackFFGroup.ERROR_CODE, callbackFFGroup.ERROR_MESSAGE, callbackFFGroup.ERROR_OBJECT);
                                    }
                                });

                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Catch Error in GetProcessToken() function', error);
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'Error Code', 'Catch Error in GetProcessToken function ... ', error);
                            }
                        }).catch((err) => {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Catch Error in GetProcessToken() function', err);
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'Error Code', 'Catch Error in GetProcessToken function ... ', err);
                        })

                        function SendSuccessResponse(result) {
                            print_info("Funtion - SendSuccessResponse method called")
                            print_info("Sending Success Response")
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, result, this.objLogInfo, null, null, null);
                        }

                        function SendErrorResponse(message, ex) {
                            print_info("Funtion - SendErrorResponse method called")
                            print_info("Sending Failure Response")
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, this.objLogInfo, message, "Unexpected error occured", ex);
                        }

                        function print_info(pStr_mesg) {
                            reqInstanceHelper.PrintInfo(serviceName, pStr_mesg, objLogInfo);
                        }

                        function getOrCreateProcessToken(tran_db_instance, objLogInfo, prct_id) {
                            return new Promise((resolve, reject) => {
                                if (prct_id == "") {
                                    reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (err, prct_id_new) {
                                        if (err) {
                                            reject(err)
                                        } else {
                                            resolve(prct_id_new)
                                        }
                                    })
                                } else {
                                    resolve(prct_id)
                                }

                            })
                        }
                    });
                });
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR-EXC-10000', 'Exception Occured While Calling ImportFile API ... ', error);
        }
    });
});

function checkMatchingPattern(files, ffg_json) {
    var file_formats = ffg_json["FILE_FORMATS"];
    var validFiles = [];
    var childarray = []
    for (var fileindex = 0; fileindex < files.length; fileindex++) {
        for (var fileFormatindex = 0; fileFormatindex < file_formats.length; fileFormatindex++) {
            var matching_pattern = file_formats[fileFormatindex]["MATCHING_PATTERN"] || file_formats[fileFormatindex]["MATCHIN_PATTERN"] || "";
            var ischild = file_formats[fileFormatindex]["IS_CHILD"] || false
            var childffg = file_formats[fileFormatindex]["PARENT_FILE"] || ""
            var ff_id = file_formats[fileFormatindex]["EXFF_ID"]
            if (matching_pattern != "") {

                if (isValidMatchingFile(files[fileindex]["name"].toLowerCase(), matching_pattern)) {
                    var obj = {};
                    obj["name"] = files[fileindex]["name"];
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


                }
            } else {
                var obj = {};
                obj["name"] = files[fileindex]["name"];
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

    return validFiles;
}

function isValidMatchingFile(fileName, matchingPattern) {
    if (matchingPattern != "" && matchingPattern != undefined) {
        return minimatch(fileName, matchingPattern.toLowerCase());
    } else {
        return false;
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
function getSystemGateways(reqObj, objLogInfo, dep_cas_instance, callback) {
    reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_systems', [], {
        'client_id': reqObj.CLIENT_ID,
        'app_id': reqObj.APP_ID,
        'tenant_id': reqObj.TENANT_ID,
        'source_s_id': reqObj.SOURCE_S_ID,
        'dst_s_id': reqObj.DEST_S_ID
    }, objLogInfo, function (error, result) {
        if (error) {
            resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-", "Error while getting data from ex_gateways", error, "", "");
        } else {
            if (result.rows.length > 0) {
                resObj = commonFile.prepareMethodResponse("SUCCESS", "", result.rows, "", "", "", "", "");
            } else {
                resObj = commonFile.prepareMethodResponse("FAILURE", "", "", "ERR-EXG-", "No system gateway found", "", "", "");
            }
        }
        callback(resObj);

    });
}

module.exports = router;