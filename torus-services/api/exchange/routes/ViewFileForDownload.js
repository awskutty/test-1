/**
 * @Api_Name        : /ViewFileForDownload,
 * @Description     : Import file from specified path
 * @Last_Error_Code : ERR_VIEWFILEFORDOWNLOAD_00008
 */

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqExchangeHelper = require('./helper/ExchangeHelper');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var async = require('async');
var ftpHelper = require('./helper/FTPHelper');
var serviceName = "ViewFileForDownload";
var fs = require('fs');
var path = require("path");
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');

var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
var isLatestPlatformVersion = false;
if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
    reqInstanceHelper.PrintInfo(serviceName, 'Platform Version - ' + serviceModel.PLATFORM_VERSION, null);
    isLatestPlatformVersion = true;
}

router.post('/ViewFileForDownload', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        var prct_id = '';
        var from_scheduler = false;
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        if (appRequest.body.objLogInfoFromExg) {
            reqInstanceHelper.PrintInfo(serviceName, 'Called fromexgimportdownload', objLogInfo)
            from_scheduler = true;
            objLogInfo = appRequest.body.objLogInfoFromExg;
            prct_id = appRequest.body.objLogInfoFromExg['prct_id'];
        }

        var CLIENT_ID = objSessionInfo.CLIENT_ID;
        objLogInfo.PROCESS = 'EXCHANGE_DOWNLOAD';
        objLogInfo.HANDLER_CODE = 'VIEW_FILEFOR_DOWNLOAD';
        objLogInfo.ACTION_DESC = 'ViewFileForDownload';
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
            var IS_FILE_FROM_CLIENT = reqBody.IS_FILE_FROM_CLIENT;
            var CLIENT_FILES = reqBody.CLIENT_FILES;
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
                    reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                        reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (err, prct_id_new) {
                            try {
                                if (err) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Error in GetProcessToken function', err);
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'Error Code', 'Error in GetProcessToken function ... ', err);
                                }

                                reqInstanceHelper.PrintInfo(serviceName, 'PRCT ID IS ' + prct_id, objLogInfo)

                                if (prct_id == "") {
                                    prct_id = prct_id_new;
                                }
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
                                        // There is no Restriction for FFG JSON
                                        reqInstanceHelper.PrintInfo(serviceName, 'IS_FILE_FROM_CLIENT - ' + IS_FILE_FROM_CLIENT, objLogInfo)
                                        if (IS_FILE_FROM_CLIENT) {
                                            var GetFilesForDownloadReqObj = {
                                                files: CLIENT_FILES,
                                                ffg_json: ffg_json
                                            };
                                            GetFilesForDownload(GetFilesForDownloadReqObj);
                                        } else {
                                            // reqFXDBInstance.GetTableFromFXDB(dep_cas_instance, 'ex_gateways', [], {
                                            //     'exg_code': GW_CODE,
                                            //     'client_id': objSessionInfo.CLIENT_ID,
                                            //     'app_id': objSessionInfo.APP_ID
                                            // }, objLogInfo, function (error, result) {

                                            var Condobj = {
                                                'exg_code': GW_CODE,
                                                'client_id': objSessionInfo.CLIENT_ID,
                                                'app_id': objSessionInfo.APP_ID
                                            }
                                            reqExchangeHelper.GetExGatewayDetails(dep_cas_instance, Condobj, objLogInfo, function (error, result) {
                                                if (error) {
                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, "ERR_VIEWFILEFORDOWNLOAD_00007", "Error while getting data from ex_gateways", error);
                                                } else {
                                                    if (result.rows.length > 0) {
                                                        var exGatewaysResponse = result.rows[0];
                                                        var gatewayType = exGatewaysResponse.gateway_type;
                                                        var ftpConfig = JSON.parse(exGatewaysResponse.gateway_config);
                                                        /*                                                         // FOR DEVELOPMENT
                                                                                                                ftpConfig = Object.assign(ftpConfig, { "ip": "192.168.2.203", "port": "22", "username": "sftpuser", "password": "", "passphrase": "Welcome@100", "cert_file_name": "cert\\rbs.pem", "cert_location_type": "SFTP" });
                                                                                                                ftpConfig.gateway_type =gatewayType= 'SFTP'; */
                                                        if (gatewayType === "FTP" || gatewayType === "SFTP") {
                                                            objRequest.gateway_type = gatewayType;
                                                            objRequest.cert_location_type = ftpConfig.cert_location_type;
                                                            objRequest.clt_cas_instance = clt_cas_instance;
                                                            objRequest.CLIENT_ID = CLIENT_ID;
                                                            reqExchangeHelper.GetPrivateKeyStoreFTPInfo(objRequest, objLogInfo, async function (error, arrKeyStoreFTPInfo) {
                                                                if (error) {
                                                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, "ERR_VIEWFILEFORDOWNLOAD_00008", "Error in GetPrivateKeyStoreFTPInfo", error);
                                                                } else {
                                                                    if (gatewayType == "SFTP") {
                                                                        var keystoresftpInfo = '';
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
                                                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_EXGDELETEFTPFILE_1001', 'Catch Error While parsing Data from Tenant Setup Json...', error);
                                                                            }
                                                                            ftpConfig.keystoresftpInfo = keystoresftpInfo;
                                                                        }
                                                                    }

                                                                    ftpConfig.FOLDERPATH = exGatewaysResponse.read_path;
                                                                    ftpConfig.gateway_type = gatewayType;
                                                                    ftpConfig.log_info = objLogInfo;
                                                                    try {
                                                                        ftpHelper.getFileList(ftpConfig, function (callbackFtpFiles) {
                                                                            if (callbackFtpFiles.STATUS === "SUCCESS") {
                                                                                var GetFilesForDownloadReqObj = {
                                                                                    files: callbackFtpFiles.DATA,
                                                                                    ffg_json: ffg_json
                                                                                };
                                                                                GetFilesForDownload(GetFilesForDownloadReqObj);
                                                                            } else {
                                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00004', 'There is some problem in FTP connection. Please contact administrator.', '', 'FAILURE');
                                                                            }
                                                                        })
                                                                    } catch (ex) {
                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, '', '', ex, 'FAILURE');
                                                                    }
                                                                }
                                                            });
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
                                                                    // console.log(files);
                                                                    var fileArr = []
                                                                    var tempFiles = [];
                                                                    for (var x = 0; x < files.length; x++) {
                                                                        tempFiles.push({
                                                                            "name": files[x]
                                                                        })
                                                                    }

                                                                    files = reqExchangeHelper.CheckMatchingPattern(tempFiles, ffg_json, objSessionInfo, pLogInfo).validFiles;
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
                                                                                    "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo)
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
                                                                                    var newPlatformFilters = " and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "'";
                                                                                    var query = "select ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED' or file_status = 'PARSING_FAILED' or file_status = 'FILE_UPDATION_INPROGRESS') and exffg_code= '" + FFG_CODE + "' ";
                                                                                    if (isLatestPlatformVersion) {
                                                                                        reqInstanceHelper.PrintInfo(serviceName, 'APP_ID and TENANT_ID filters are Added in the Query..', objLogInfo);
                                                                                        query = query + newPlatformFilters;
                                                                                    }
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
                                                                                        deleteobj = {
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
                                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00005', "Error while transferring files from read path to local", "");
                                                        }
                                                    } else {
                                                        var errorMsg = 'There is No Gateway Data Found...';
                                                        reqInstanceHelper.PrintInfo(serviceName, errorMsg, objLogInfo);
                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00006', errorMsg, '');
                                                    }
                                                }
                                            });
                                        }
                                    } else {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, callbackFFGroup.ERROR_CODE, callbackFFGroup.ERROR_MESSAGE, callbackFFGroup.ERROR_OBJECT);
                                    }

                                });

                                // Duplicate and File Naming Pattern verification process will be done here for the File from FTP or Client Side
                                function GetFilesForDownload(pGetFilesForDownloadReqObj, GetFilesForDownloadCB) {
                                    try {
                                        var data = [];
                                        var validationResult = reqExchangeHelper.CheckMatchingPattern(pGetFilesForDownloadReqObj.files, pGetFilesForDownloadReqObj.ffg_json, objSessionInfo, objLogInfo);
                                        data = validationResult.validFiles;
                                        if (validationResult.inValidFiles.length && IS_FILE_FROM_CLIENT) {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00004', 'Please select valid file(s)', '', 'FAILURE');
                                        } else if (!data.length) {
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, '', '', '');
                                        } else {
                                            for (var index in data) {
                                                data[index]["STATUS"] = "NOT DOWNLOADED";
                                                data[index]["size"] = Math.ceil(data[index]["size"] / 1024) + "KB";
                                            }
                                            var tempFiles = [];
                                            for (var i = 0; i < data.length; i++) {
                                                if (data[i].childfiles && data[i].childfiles.length) {
                                                    for (var j = 0; j < data[i].childfiles.length; j++) {
                                                        var tempObj = {
                                                            "file_name": data[i].childfiles[j]["name"],
                                                            "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                            "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                            "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID
                                                        }
                                                        tempFiles.push(tempObj);
                                                    }
                                                } else {
                                                    var tempObj = {
                                                        "file_name": data[i]["name"],
                                                        "CREATED_BY": objLogInfo.LOGIN_NAME,
                                                        "CREATED_DATE": reqDateFormatter.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                        "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID
                                                    }
                                                    tempFiles.push(tempObj);
                                                }
                                            }
                                            var prct_id = objLogInfo.PROCESS_INFO.PRCT_ID;
                                            reqTranDBInstance.InsertBulkTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", tempFiles, objLogInfo, null, function (result, error) {
                                                if (error) {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00001', 'Error While Inserting Data ino TMP_EX_HEADER_FILES...', error);
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00001', 'Error While Inserting Data ino TMP_EX_HEADER_FILES...', error);
                                                } else {
                                                    if (tempFiles[tempFiles.length - 1] == ",") {
                                                        tempFiles = tempFiles.slice(0, -1);
                                                    }
                                                    var TmpTableChk = "select distinct T2.file_name FROM TMP_EX_HEADER_FILES T1 INNER join TMP_EX_HEADER_FILES T2 ON T1.file_name = T2.file_name WHERE T2.prct_id = '" + prct_id + "' and T1.prct_id <> '" + prct_id + "'";
                                                    reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, TmpTableChk, objLogInfo, function (resultTmpTableChk, error) {
                                                        var newPlatformFilters = " and ehf.app_id = '" + APP_ID + "' and ehf.tenant_id = '" + TENANT_ID + "'";
                                                        var query = "select ehf.exhf_id,ehf.file_name,ehf.file_status,eh.exffg_code from ex_header_files ehf INNER join tmp_ex_header_files tmp on tmp.file_name=ehf.file_name inner join ex_header eh on eh.EXH_ID = ehf.EXH_ID where (file_status = 'DOWNLOADED' or file_status = 'DOWNLOAD' or file_status = 'UPDATE_IN_PROGRESS' or file_status = 'UPDATED' or file_status = 'PARSING_FAILED' or file_status = 'FILE_UPDATION_INPROGRESS') and exffg_code= '" + FFG_CODE + "' and tmp.prct_id= '" + prct_id + "'  "
                                                        if (isLatestPlatformVersion) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'APP_ID and TENANT_ID filters are Added in the Query..', objLogInfo);
                                                            query = query + newPlatformFilters;
                                                        }
                                                        reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                                            var filesFromTbl = result.rows;
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from TMP_EX_HEADER_FILES ' + filesFromTbl.length, objLogInfo);
                                                            var filesTemp = [];
                                                            var hf_arr = []
                                                            for (var f = 0; f < filesFromTbl.length; f++) {
                                                                filesTemp.push(filesFromTbl[f]["file_name"])
                                                                hf_arr.push({
                                                                    name: filesFromTbl[f]["file_name"],
                                                                    hf_id: filesFromTbl[f]["exhf_id"]
                                                                })
                                                            }
                                                            var tempfileArr = [];
                                                            for (var tempfileObj of tempFiles) {
                                                                tempfileArr.push(tempfileObj['file_name']);
                                                            }
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from FTP ' + tempfileArr.length, objLogInfo);
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Total Record Count from QUERY ' + filesTemp.length, objLogInfo);
                                                            var tresultTmpTableChk = resultTmpTableChk.rows;
                                                            var tresultTmpTableChkFiles = [];
                                                            for (var temp of tresultTmpTableChk) {
                                                                tresultTmpTableChkFiles.push(temp.file_name)
                                                            }
                                                            var remainingFiles = [];
                                                            remainingFiles = tempfileArr.diff(tresultTmpTableChkFiles);
                                                            remainingFiles = remainingFiles.diff(filesTemp);
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Remaining Files Count ' + remainingFiles.length, objLogInfo)
                                                            var resData = [];
                                                            for (var i in data) {
                                                                for (var j in remainingFiles) {
                                                                    if (data[i].childfiles && data[i].childfiles.length > 0) {
                                                                        for (var indexf in data[i].childfiles) {
                                                                            if (remainingFiles[j] != "" && remainingFiles[j] == data[i].childfiles[indexf]["name"]) {
                                                                                data[i].childfiles[indexf]["STATUS"] = "NOT DOWNLOADED"
                                                                                resData.push(data[i]);
                                                                            }
                                                                            if (remainingFiles[j] != "" && remainingFiles[j] == data[i]["name"]) {
                                                                                data[i]["STATUS"] = "NOT DOWNLOADED"
                                                                                resData.push(data[i]);
                                                                            }
                                                                        }
                                                                    } else {
                                                                        if (remainingFiles[j] != "" && remainingFiles[j] == data[i]["name"]) {
                                                                            data[i]["STATUS"] = "NOT DOWNLOADED"
                                                                            resData.push(data[i]);
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            for (var i = 0; i < resData.length; i++) {
                                                                for (var j = 0; j < hf_arr.length; j++) {
                                                                    if (resData[i]["name"] == hf_arr
                                                                    [j]["file_name"]) {
                                                                        resData[i]["hf_id"] = hf_arr[j]["hf_id"]
                                                                    }
                                                                }
                                                            }
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Eligible Files Count ' + resData.length, objLogInfo);

                                                            deleteobj = {
                                                                "prct_id": objLogInfo.PROCESS_INFO.PRCT_ID
                                                            };
                                                            if (!from_scheduler) {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Calling delete TMP_EX_HEADER_FILES', objLogInfo);
                                                                reqTranDBInstance.DeleteTranDB(tran_db_instance, "TMP_EX_HEADER_FILES", deleteobj, objLogInfo, function (result, error) {
                                                                    if (error) {
                                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                    }
                                                                    if (IS_FILE_FROM_CLIENT && filesTemp.length) {
                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, resData, objLogInfo, 'ERR_VIEWFILEFORDOWNLOAD_00003', 'The selected file(s) are already downloaded.', '', 'FAILURE');
                                                                    } else {
                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, resData, objLogInfo, '', '', '');
                                                                    }
                                                                });
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'Not Calling delete TMP_EX_HEADER_FILES', objLogInfo)
                                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, resData, objLogInfo, '', '', '');
                                                            }

                                                        });
                                                    });
                                                }
                                            });
                                        }
                                    } catch (error) {
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'Catch Error in GetProcessToken() function', error);
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'Error Code', 'Catch Error in GetProcessToken function ... ', error);
                            }
                        });
                    });
                });
            });

        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR-EXC-10000', 'Exception Occured While Calling ImportFile API ... ', error);
        }
    });
});

Array.prototype.diff = function (a) {
    return this.filter(function (i) {
        return a.indexOf(i) < 0;
    });
};


module.exports = router;