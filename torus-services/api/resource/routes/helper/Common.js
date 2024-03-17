var reqPath = require('path');
//var reqMoment = require('moment');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
function annotationCheckInResult() {
    this.Result = "";
    this.AttachmentId = 0;
    this.RelativePath = "";
    this.ATCode = "";
    this.CheckOutBy = "";
    this.CheckOutByName = "";
    this.CheckOutDate = "";
}

function attachmentDetails() {
    this.FilePath = "";
    this.Userid = "";
    this.strURL = "";
    this.ATCode = "";
    this.ViewerType = "";
    this.ATData = "";
    this.WaterMarkText = "";
    this.font = "";
    this.fontsize = "";
    this.Actions = [];
    this.Transparency = "";
    this.PageNo = 1;
    this.AttId = 0;
    this.VWFTPA_ID = 0;
    this.LoadPageByPage = "";
    this.AccusoftHostName = "";
    this.NeedEncryption = "";
    this.ImageColor = "";
    this.ImageFormat = "";
    this.Dttadif_id = 0;
    this.Dttad_id = "";
    // Cassandra Details
    this.RS_DB_INFO = "";
    this.RS_STORAGE_TYPE = "";
    this.NeedAnnotation = "";
    this.CBOStampAnnotations = "";
    this.Annotations = [];
    this.GroupId = "";
    this.VersionNo = "";
    this.CheckOutBy = "";
    this.CheckOutByName = "";
    this.CheckOutDate = "";
    this.IsCurrent = "";
    this.OriginalFileName = "";
}

function saveAttachmentDetail() {
    this.RELATIVE_PATH = "";
    this.FILE_NAME = "";
    this.FILE_SIZE = "";
    this.RS_PATH = "";
    this.RS_CODE = "";

    this.TRN_ID = 0;
    this.DTT_CODE = "";

    this.ATMT_DTT_CODE = "";
    this.DTTA_ID = 0;
    this.DTTAD_ID = 0;
    this.DTTADIF_ID = 0;
    this.AT_CODE = "";
}

function annotation() {
    this.AnnotationId = 0;
    this.AnnotationType = "";
    this.AnnotationData = "";
    this.AnnotationText = "";
}

function guid() {
    try {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    } catch (error) {
        printError(error, '', null);
    }

    function s4() {
        try {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        } catch (error) {
            printError(error, '', null);
        }
    }
}

//this is common function
function saveBurnedAtmt(pHeaders, pSession, TRNA_ID, pUserId, pAppUId, pLoginName, pClientId, pData, AT_CODE, pNewRelativePath, pOrgFileName, objLogInfo, callback) {
    var strResult = "FAILURE";
    var objAttDetails = new attachmentDetails();
    var strOrgExt = reqPath.extname(pNewRelativePath);
    try {
        if (TRNA_ID != 0) {
            var objCond = new Object();
            objCond['TRNA_ID'] = TRNA_ID;
            reqTranDBInstance.GetTableFromTranDB(pSession, 'TRN_ATTACHMENTS', objCond, objLogInfo, function (objTRNA) {
                objTRNA = arrKeyToUpperCase(objTRNA);
                if (objTRNA && objTRNA.length > 0) {
                    var htTRNATMT = new Object();
                    htTRNATMT.TRN_ID = objTRNA[0].TRN_ID;
                    htTRNATMT.DT_CODE = objTRNA[0].DT_CODE;
                    htTRNATMT.DTT_CODE = objTRNA[0].DTT_CODE;
                    htTRNATMT.DTTA_ID = objTRNA[0].DTTA_ID;
                    htTRNATMT.DTTAD_ID = objTRNA[0].DTTAD_ID;
                    htTRNATMT.DTTADIF_ID = objTRNA[0].DTTADIF_ID;
                    htTRNATMT.DTTAC_DESC = objTRNA[0].DTTAC_DESC;
                    htTRNATMT.FILE_SIZE = objTRNA[0].FILE_SIZE;
                    htTRNATMT.IS_CURRENT = "N";
                    htTRNATMT.IS_PROCESSED = '';
                    htTRNATMT.WATERMARK_CODE = objTRNA[0].WATERMARK_CODE;
                    htTRNATMT.SOURCE = objTRNA[0].SOURCE;
                    htTRNATMT.SOURCE_DETAILS = objTRNA[0].SOURCE_DETAILS;
                    htTRNATMT.RELATIVE_PATH = objTRNA[0].RELATIVE_PATH;
                    htTRNATMT.ORIGINAL_FILE_NAME = objTRNA[0].ORIGINAL_FILE_NAME;
                    htTRNATMT.AT_CODE = objTRNA[0].AT_CODE;
                    htTRNATMT.RESOURCE_SERVER_CODE = objTRNA[0].RESOURCE_SERVER_CODE;
                    htTRNATMT.SORT_ORDER = objTRNA[0].SORT_ORDER;
                    htTRNATMT.SYSTEM_ID = objTRNA[0].SYSTEM_ID;
                    htTRNATMT.ATMT_DTT_CODE = objTRNA[0].ATMT_DTT_CODE;
                    htTRNATMT.ATMT_TRN_ID = objTRNA[0].ATMT_TRN_ID;
                    htTRNATMT.ATMT_TS_ID = objTRNA[0].ATMT_TS_ID;
                    htTRNATMT.TOTAL_PAGES = objTRNA[0].TOTAL_PAGES;
                    htTRNATMT.IS_DELETED = objTRNA[0].IS_DELETED;
                    htTRNATMT.ANNOTATION_IMAGE_NAME = objTRNA[0].ANNOTATION_IMAGE_NAME;
                    htTRNATMT.COMMENT_TEXT = objTRNA[0].COMMENT_TEXT;
                    if (!objTRNA[0].GROUP_ID || objTRNA[0].GROUP_ID == '0') {
                        htTRNATMT.GROUP_ID = objTRNA[0].TRNA_ID;
                    } else {
                        htTRNATMT.GROUP_ID = objTRNA[0].GROUP_ID;
                    }
                    htTRNATMT.CREATED_BY = pUserId;
                    htTRNATMT.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                    if (objTRNA[0].VERSIONING) {
                        htTRNATMT.VERSIONING = objTRNA[0].VERSIONING;
                    } else {
                        htTRNATMT.VERSIONING = 1;
                    }
                    saveTRNAttachmentDetails(pHeaders, htTRNATMT, pUserId, pLoginName, pAppUId, "TRN_ATTACHMENTS", pClientId, objLogInfo, function (objTableInsertDetails) {
                        objAttDetails.AttId = objTRNA[0].TRNA_ID;
                        if (objTRNA[0].VERSIONING)
                            objTRNA[0].VERSIONING = objTRNA[0].VERSIONING + 1;
                        else
                            objTRNA[0].VERSIONING = 2;

                        var strFileName = reqPath.basename(objTRNA[0].RELATIVE_PATH);
                        var strFileExt = reqPath.extname(objTRNA[0].RELATIVE_PATH);
                        strFileName = strFileName.replace(strFileExt, "");
                        var versionWithPadding = '000';
                        getPad(3, '0', function (pad) {
                            versionWithPadding = pad.substring(0, pad.length - objTRNA[0].VERSIONING.toString().length) + objTRNA[0].VERSIONING;
                        });
                        if (strFileName.indexOf('_VER_') != -1) {
                            var strParts = strFileName.split("_VER_");
                            objTRNA[0].RELATIVE_PATH = strParts[0] + "_VER_" + versionWithPadding + strFileExt;
                        } else {
                            objTRNA[0].RELATIVE_PATH = strFileName + "_VER_" + versionWithPadding + strFileExt;
                        }
                        pNewRelativePath = objTRNA[0].RELATIVE_PATH;
                        objTRNA[0].FILE_SIZE = Buffer.byteLength(pData);
                        objTRNA[0].CHECKED_OUT_BY = "";
                        objTRNA[0].CHECKED_OUT_DATE = null;
                        objTRNA[0].CHECKED_OUT_BY_NAME = "";
                        var arrTableDetails = [];
                        var objTableUpdateDetails = new Object();
                        var arrConditions = [];
                        arrConditions.push({
                            column: 'TRNA_ID',
                            value: objTRNA[0].TRNA_ID
                        });
                        objTableUpdateDetails.tableName = 'TRN_ATTACHMENTS';
                        objTableUpdateDetails.values = objTRNA[0];
                        objTableUpdateDetails.conditions = arrConditions;
                        arrTableDetails.push(objTableInsertDetails);
                        arrTableDetails.push(objTableUpdateDetails);
                        reqTranDBInstance.TranInsertUpdate(pSession, arrTableDetails, function (result) {
                            if (result == 'SUCCESS') {
                                try {
                                    var strOldExt = reqPath.extname(pNewRelativePath);
                                    var strNewRelativePath = pNewRelativePath.replace(strOldExt, strOrgExt);
                                    reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (pClient) {
                                        if (!AT_CODE) {
                                            printInfo("AT_CODE is empty", objLogInfo);
                                        }
                                        objAttDetails.ATCode = AT_CODE.toString().toUpperCase();
                                        objAttDetails.FilePath = strNewRelativePath.toUpperCase().trim();
                                        var arr = [];
                                        var row = new Object();
                                        row.TRNAD_ID = ''; //guid();
                                        row.RELATIVE_PATH = strNewRelativePath.toUpperCase().trim();
                                        row.APP_ID = objLogInfo.APP_ID;
                                        row.TENANT_ID = objLogInfo.TENANT_ID;
                                        var dataType;
                                        if (AT_CODE.toString().toUpperCase() == 'IMG') {
                                            row.TEXT_DATA = pData.toString('base64');
                                            dataType = ['UUID', 'string', 'string', 'string', 'string'];
                                            arr.push(row);
                                        } else {
                                            row.BYTE_DATA = pData;
                                            dataType = ['UUID', 'string', 'blob', 'string', 'string'];
                                            arr.push(row);
                                        }
                                        if (pClient.DBConn && pClient.DBConn.DBType && pClient.DBConn.DBType.toLowerCase() == 'oracledb') {
                                            var reqTorusRdbms = require('../../../../../torus-references/instance/db/TorusRdbms');
                                            var trna_procedure = 'SP_PDF_DATA_PROCESSING';
                                            var bindParams = {
                                                pUID: {
                                                    dir: reqTorusRdbms.direction.BIND_IN,
                                                    type: reqTorusRdbms.type.STRING,
                                                    val: guid()
                                                },
                                                pRELATIVEPATH: {
                                                    dir: reqTorusRdbms.direction.BIND_IN,
                                                    type: reqTorusRdbms.type.STRING,
                                                    val: row.RELATIVE_PATH
                                                },
                                                pDATA: {
                                                    dir: reqTorusRdbms.direction.BIND_IN,
                                                    type: reqTorusRdbms.type.BUFFER,
                                                    val: row.BYTE_DATA
                                                }
                                            };
                                            reqTranDBInstance.ExecuteProcedure(pClient, trna_procedure, bindParams, objLogInfo, function (error, result) {
                                                if (error) {
                                                    printError(error, '', objLogInfo);
                                                    reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                        return callback(error);
                                                    });
                                                } else {
                                                    return callback(objAttDetails);
                                                }
                                            });
                                        } else {
                                            reqDBInstance.InsertFXDB(pClient, 'TRNA_DATA', arr, objLogInfo, function (error) {
                                                if (error) {
                                                    printError(error, '', objLogInfo);
                                                    reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                        return callback(error);
                                                    });
                                                } else {
                                                    return callback(objAttDetails);
                                                }
                                            }, dataType);
                                        }
                                    });
                                } catch (error) {
                                    printError(error, '', objLogInfo);
                                    reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                        return callback(error);
                                    });
                                }
                            } else {
                                reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                    return callback(result);
                                });
                            }
                        });
                    });
                }
            });
        }
    } catch (error) {
        printError(error, '', objLogInfo);
        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
            return callback(error);
        });
    }
}

//this is common function
function saveTRNAttachmentDetails(pHeaders, pHTTrnAttach, pUserId, pLoginName, pAppUId, strAttTableName, pClientId, objLogInfo, callback) {
    try {
        var sequenceno = 0;
        var intpaddingdigit = "";
        reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (pClient) {
            reqDBInstance.GetTableFromFXDB(pClient, 'USERS', [], {
                'LOGIN_NAME': pLoginName
            }, objLogInfo, function (error, result) {
                try {
                    if (error) {
                        printError(error, '', objLogInfo);
                    } else {
                        var users = result.rows;
                        for (var i = 0; i < users.length; i++) {
                            var rw = users[i];
                            if (rw.attachment_seq_no) {
                                sequenceno = rw.attachment_seq_no;
                            } else {
                                sequenceno = 1;
                            }
                            sequenceno = sequenceno + 1;
                            getPad(20, '0', function (pad) {
                                intpaddingdigit = pad.substring(0, pad.length - sequenceno.toString().length) + sequenceno;
                            });
                            var appUserId = '';
                            getPad(5, '0', function (pad) {
                                appUserId = pad.substring(0, pad.length - pAppUId.toString().length) + pAppUId;
                            });
                            if (!("GROUP_ID" in pHTTrnAttach) || !pHTTrnAttach.GROUP_ID) {
                                pHTTrnAttach.GROUP_ID = "GRP_" + appUserId + "_" + intpaddingdigit;
                            }
                        }
                        if (pClientId) {
                            var cond = new Object();
                            cond.CLIENT_ID = pClientId;
                            cond.LOGIN_NAME = pLoginName.toUpperCase();
                            cond.U_ID = pUserId;
                            var row = new Object();
                            row.ATTACHMENT_SEQ_NO = sequenceno;
                            reqDBInstance.UpdateFXDB(pClient, 'USERS', row, cond, objLogInfo, function (error) {
                                if (error) {
                                    printError(error, '', objLogInfo);
                                } else {
                                    var objTableInsertDetails = new Object();
                                    objTableInsertDetails.tableName = strAttTableName;
                                    objTableInsertDetails.values = pHTTrnAttach;
                                    return callback(objTableInsertDetails);
                                }
                            });
                        }
                    }
                } catch (error) {
                    printError(error, '', objLogInfo);
                }
            });
        });
    } catch (error) {
        printError(error, '', objLogInfo);
    }
}

//this is common function
function getPad(padCount, padChar, callback) {
    var pad = '';
    for (var j = 0; j < padCount; j++) {
        pad += padChar;
    }
    return callback(pad);
}

// this will return object with keys in uppercase
function arrKeyToUpperCase(pArr) {
    var arrForReturn = [];
    for (var i = 0; i < pArr.length; i++) {
        var obj = pArr[i];
        var objNew = new Object();
        for (var key in obj) {
            var strUpperCaseKey = key.toUpperCase();
            objNew[strUpperCaseKey] = obj[key];
        }
        arrForReturn.push(objNew);
    }
    return arrForReturn;
}

function printError(pError, pErrorCode, pLogInfo) {
    console.log(pError.stack);
    reqLogWriter.TraceError(pLogInfo, pError.stack, pErrorCode);
}

function printInfo(pInfo, pLogInfo) {
    console.log(pInfo);
    reqLogWriter.TraceInfo(pLogInfo, pInfo);
}

module.exports = {
    AnnotationCheckInResult: annotationCheckInResult,
    AttachmentDetails: attachmentDetails,
    SaveAttachmentDetail: saveAttachmentDetail,
    Annotation: annotation,
    SaveBurnedAtmt: saveBurnedAtmt,
    ArrKeyToUpperCase: arrKeyToUpperCase,
    PrintError: printError,
    PrintInfo: printInfo,
    Guid: guid
};