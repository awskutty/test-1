/*
    @Description        : Helper file for SaveMail API
*/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqCommon = require('./Common');
var objLogInfo = null;
var mSession = null;
var serviceName = 'SaveMail';
var reqAuditLog = require('../../../../../torus-references/log/audit/AuditLog');

//this will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// Save mail from eml tables to target table
function SaveMail(pRequest, pHeaders, pLogInfo, callback) {
    try {
        objLogInfo = pLogInfo;
        var strEmldId = pRequest.EMLD_ID;
        var strUserid = pRequest.U_ID;
        var strSystemid = pRequest.S_ID;
        var strDTDesc = '';
        var strAPPId = pRequest.APP_ID;
        var strLoginName = pRequest.LOGIN_NAME;
        var strSystemDesc = pRequest.SYSTEM_DESC;
        var strTrnfId = pRequest.TRNF_ID;
        var strAtmtDtCode = pRequest.ATMT_DT_CODE;
        var strAtmtDttCode = pRequest.ATMT_DTT_CODE;
        var objItem = {};
        var arrTrnAttachments = [];
        var condition = {
            emld_id: strEmldId
        };
        reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
            try {
                mSession = pSession;
                reqTranDBInstance.GetTableFromTranDB(pSession, 'EML_ATTACHMENTS', condition, objLogInfo, function (result, error) {
                    try {
                        if (error) {
                            return callback(prepareErrorData(error, 'ERR-HAN-43504', 'Error in SaveMail function'));
                        } else {
                            arrTrnAttachments = reqInstanceHelper.ArrKeyToUpperCase(result, objLogInfo);
                            var arrDTTRelation = [];
                            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                                try {
                                    reqAuditLog.GetProcessToken(mSession, objLogInfo, function (err, prct_id) {
                                        try {
                                            if (err) {
                                                return callback(prepareErrorData(error, 'Error Code', 'Error in GetProcessToken function'));
                                            }
                                            objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                            reqDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], {
                                                app_id: strAPPId,
                                                dt_code: strAtmtDtCode
                                            }, objLogInfo, function (error, result) {
                                                try {
                                                    if (error) {
                                                        return callback(prepareErrorData(error, 'ERR-HAN-43505', 'Error in SaveMail function'));
                                                    } else {
                                                        try {
                                                            var objDTInfo = result.first();
                                                            if (objDTInfo) {
                                                                arrDTTRelation = JSON.parse(objDTInfo.relation_json);
                                                                strDTDesc = objDTInfo.dt_description;
                                                            } else {
                                                                return callback(null, null, 'Entity relation not found');
                                                            }
                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-HAN-43506', 'Error in SaveMail function'));
                                                        }
                                                        objItem.CREATED_BY = strUserid;
                                                        objItem.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                                        objItem.CREATED_BY_NAME = strLoginName;
                                                        objItem.SYSTEM_ID = strSystemid;
                                                        objItem.SYSTEM_NAME = strSystemDesc;
                                                        objItem.STATUS = pRequest.Status;
                                                        objItem.PROCESS_STATUS = pRequest.ProcessStatus;
                                                        objItem.DT_CODE = strAtmtDtCode;
                                                        objItem.DT_DESCRIPTION = strDTDesc;
                                                        objItem.DTT_CODE = strAtmtDttCode;
                                                        objItem.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                                        objItem.VERSION_NO = '0';
                                                        var objTSitem = {};
                                                        objTSitem.STATUS = pRequest.Status;
                                                        objTSitem.PROCESS_STATUS = pRequest.ProcessStatus;
                                                        objTSitem.CREATED_BY = strUserid;
                                                        objTSitem.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                                        objTSitem.DTT_CODE = strAtmtDttCode;
                                                        objTSitem.DT_CODE = strAtmtDtCode;
                                                        objTSitem.DT_DESCRIPTION = strDTDesc;
                                                        objTSitem.CREATED_BY_NAME = strLoginName;
                                                        objTSitem.SYSTEM_ID = strSystemid;
                                                        objTSitem.SYSTEM_NAME = strSystemDesc;
                                                        objTSitem.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                                        objTSitem.VERSION_NO = '0';
                                                        objTSitem.GROUP_ID = 'GRP_' + strUserid + ((Date.now() * 10000) + 621355968000000000);
                                                        objTSitem.PARENT_TS_ID = 0;
                                                        getDTTDescription(pClient, strAPPId, strAtmtDttCode, function CallbackGetDTTDescription(pDesc) {
                                                            try {
                                                                objItem.DTT_DESCRIPTION = pDesc;
                                                                objTSitem.DTT_DESCRIPTION = pDesc;
                                                                objItem.TS = objTSitem;
                                                                reqCommon.DoFilterRecursiveArr(arrDTTRelation, strAtmtDttCode, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (objDTTR) {
                                                                    var count = 0;
                                                                    doTrnAtmtInsert(pHeaders, pSession, objItem, objDTTR, pRequest, arrTrnAttachments[count], arrTrnAttachments, count, function (error, result) {
                                                                        if (error) {
                                                                            return callback(prepareErrorData(error, 'ERR-HAN-43507', 'Error in SaveMail function'));
                                                                        } else {
                                                                            reqTranDBInstance.Commit(pSession, true, function (res) {
                                                                                return callback(null, 'Email Moved Successfully.');
                                                                            });
                                                                        }
                                                                    });
                                                                });
                                                            } catch (error) {
                                                                return callback(prepareErrorData(error, 'ERR-HAN-43508', 'Error in SaveMail function'));
                                                            }
                                                        });
                                                    }
                                                } catch (error) {
                                                    return callback(prepareErrorData(error, 'ERR-HAN-43509', 'Error in SaveMail function'));
                                                }
                                            });

                                        } catch (error) {
                                            return callback(prepareErrorData(error, 'Error Code', 'Catch Error in GetProcessToken function'));
                                        }
                                    });

                                } catch (error) {
                                    return callback(prepareErrorData(error, 'ERR-HAN-43510', 'Error in SaveMail function'));
                                }
                            });
                        }
                    } catch (error) {
                        return callback(prepareErrorData(error, 'ERR-HAN-43511', 'Error in SaveMail function'));
                    }
                });
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-HAN-43512', 'Error in SaveMail function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-HAN-43513', 'Error in SaveMail function'));
    }
}

// Get dtt_info for the dtt_code
function getDTTDescription(pClient, pAppID, pDTTCode, callback) {
    try {
        var strDTTDesc = '';
        if (pDTTCode) {
            reqDBInstance.GetTableFromFXDB(pClient, 'DTT_INFO', [], {
                app_id: pAppID,
                dtt_code: pDTTCode
            }, objLogInfo, function (error, result) {
                try {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43514', 'Error in getDTTDescription function', error);
                        return callback(strDTTDesc);
                    } else {
                        try {
                            if (result.rows) {
                                var objRow = result.rows[0];
                                if (objRow) {
                                    strDTTDesc = objRow.dtt_description;
                                }
                            }
                            return callback(strDTTDesc);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43515', 'Error in getDTTDescription function', error);
                            return callback(strDTTDesc);
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43516', 'Error in getDTTDescription function', error);
                    return callback(strDTTDesc);
                }
            });
        } else {
            reqInstanceHelper.PrintWarn(serviceName, 'DTT_CODE is empty', objLogInfo);
            return callback(strDTTDesc);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43517', 'Error in getDTTDescription function', error);
        return callback(strDTTDesc);
    }
}

// Insert into ts and trna
function doTrnAtmtInsert(pHeaders, pSession, objItem, pDTTR, pRequest, currentObj, arrTrnAttachments, count, callback) {
    count++;
    try {
        var transactionSet = objItem.TS;
        delete objItem.TS;
        var insertArr = [];
        insertArr.push(objItem);
        reqTranDBInstance.InsertTranDBWithAudit(pSession, pDTTR.TARGET_TABLE, insertArr, objLogInfo, function (result) {
            try {
                var insertedVal = result[0];
                var trnId = insertedVal[pDTTR.PRIMARY_COLUMN.toLowerCase()];
                if (pDTTR.CATEGORY != 'M') {
                    var insertArr = [];
                    transactionSet.TRN_ID = trnId;
                    insertArr.push(transactionSet);
                    reqTranDBInstance.InsertTranDBWithAudit(pSession, 'TRANSACTION_SET', insertArr, objLogInfo, function (result) {
                        try {
                            var insertedVal = result[0];
                            var tsId = insertedVal.ts_id;
                            insertTrnAtmt(pHeaders, pSession, trnId, tsId, pRequest, currentObj, function (error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43518', 'Error in doTrnAtmtInsert function', error);
                                        return callback(error);
                                    } else {
                                        if (count < arrTrnAttachments.length) {
                                            objItem.TS = transactionSet;
                                            doTrnAtmtInsert(pHeaders, pSession, objItem, pDTTR, pRequest, arrTrnAttachments[count], arrTrnAttachments, count, callback);
                                        } else {
                                            updateEmailDataStatus(pSession, pRequest.EMLD_ID, function (result) {
                                                return callback(null, result);
                                            });
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43519', 'Error in doTrnAtmtInsert function', error);
                                    return callback(error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43520', 'Error in doTrnAtmtInsert function', error);
                            return callback(error);
                        }
                    });
                } else {
                    insertTrnAtmt(pHeaders, pSession, trnId, 0, pRequest, currentObj, function (error, result) {
                        try {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43521', 'Error in doTrnAtmtInsert function', error);
                                return callback(error);
                            } else {
                                if (count < arrTrnAttachments.length) {
                                    doTrnAtmtInsert(pHeaders, pSession, objItem, pDTTR, pRequest, arrTrnAttachments[count], arrTrnAttachments, count, callback);
                                } else {
                                    updateEmailDataStatus(pSession, pRequest.EMLD_ID, function (result) {
                                        return callback(null, result);
                                    });
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43522', 'Error in doTrnAtmtInsert function', error);
                            return callback(error);
                        }
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43523', 'Error in doTrnAtmtInsert function', error);
                return callback(error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43524', 'Error in doTrnAtmtInsert function', error);
        return callback(error);
    }
}

// Update Email data status as TRN_CREATED
function updateEmailDataStatus(pSession, emldId, callback) {
    try {
        var row = {
            status: 'TRN_CREATED'
        };
        var condition = {
            emld_id: emldId
        };
        reqTranDBInstance.UpdateTranDBWithAudit(pSession, 'EMAIL_DATA', row, condition, null, function (result, error) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43525', 'Error in updateEmailDataStatus function', error);
                return callback(error);
            } else {
                return callback('SUCCESS');
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43526', 'Error in updateEmailDataStatus function', error);
        return callback(error);
    }
}

// Insert into trn_attachments
function insertTrnAtmt(pHeaders, pSession, strTrnId, strTsId, pRequest, currentObj, callback) {
    try {
        var objTabValue = {};
        objTabValue.RELATIVE_PATH = currentObj.RELATIVE_PATH.toUpperCase();
        objTabValue.ORIGINAL_FILE_NAME = currentObj.ORIGINAL_FILE_NAME;
        objTabValue.FILE_SIZE = currentObj.FILE_SIZE;
        objTabValue.RESOURCE_SERVER_CODE = currentObj.RS_CODE;
        if (currentObj.AT_CODE != '') {
            objTabValue.AT_CODE = currentObj.AT_CODE;
        } else {
            objTabValue.AT_CODE = 'UNKNOWN';
        }
        objTabValue.COMMENT_TEXT = currentObj.COMMENT;
        objTabValue.ATMT_DTT_CODE = pRequest.ATMT_DTT_CODE;
        objTabValue.DTTADIF_ID = currentObj.DTTADIF_ID;
        objTabValue.DTTAC_DESC = currentObj.DTTAC_DESC;
        if (currentObj.ATMT_DTT_CODE != '') {
            objTabValue.ATMT_TS_ID = strTsId;
            objTabValue.ATMT_TRN_ID = strTrnId;
        } else {
            objTabValue.ATMT_TS_ID = '0';
            objTabValue.ATMT_TRN_ID = '0';
        }
        objTabValue.TOTAL_PAGES = '0';
        objTabValue.IS_CURRENT = 'Y';
        objTabValue.IS_DELETED = 'N';
        objTabValue.SOURCE = 'SCAN';
        objTabValue.SOURCE_DETAILS = 'FROM FOLDER';
        objTabValue.CREATED_BY = pRequest.U_ID;
        objTabValue.CREATED_BY_NAME = objLogInfo.USER_NAME;
        objTabValue.SYSTEM_ID = pRequest.S_ID;
        objTabValue.SYSTEM_NAME = objLogInfo.SYSTEM_DESC;
        objTabValue.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
        objTabValue.DT_CODE = pRequest.DT_CODE;
        objTabValue.DTT_CODE = pRequest.DTT_CODE;
        objTabValue.VERSION_NO = '0';
        objTabValue.TRN_ID = pRequest.TRNF_ID;
        objTabValue.GROUP_ID = 'GRP_' + pRequest.U_ID + ((Date.now() * 10000) + 621355968000000000);
        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
            try {
                GetAttachmentTitle(pClient, pRequest.DTT_CODE, pRequest.APP_ID, function (strDttAtmt) {
                    try {
                        if (strDttAtmt) {
                            objTabValue.ATTACHMENT_TITLE = strDttAtmt.ATTACH_TITLE;
                            if (currentObj.DTTA_ID) {
                                objTabValue.DTTA_ID = currentObj.DTTA_ID;
                            } else {
                                objTabValue.DTTA_ID = strDttAtmt.DTTA_ID;
                            }
                            if (currentObj.DTTAD_ID) {
                                objTabValue.DTTAD_ID = currentObj.DTTAD_ID;
                            } else {
                                objTabValue.DTTAD_ID = strDttAtmt.DTTAD_ID;
                            }
                        }
                        GetATDescription(pClient, function (strATDesc) {
                            try {
                                objTabValue.AT_DESCRIPTION = strATDesc;
                                var arrTableIns = [];
                                arrTableIns.push(objTabValue);
                                reqTranDBInstance.InsertTranDBWithAudit(pSession, 'TRN_ATTACHMENTS', arrTableIns, objLogInfo, function (result) {
                                    return callback(null, result);
                                });
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43527', 'Error in insertTrnAtmt function', error);
                                return callback(error);
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43528', 'Error in insertTrnAtmt function', error);
                        return callback(error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43529', 'Error in insertTrnAtmt function', error);
                return callback(error);
            }
        });

        // Query attachment_types for given at_code
        function GetATDescription(pClient, callback) {
            var strATDesc = '';
            try {
                var strATCode = currentObj.AT_CODE;
                reqDBInstance.GetTableFromFXDB(pClient, 'attachment_types', ['at_code', 'at_description'], {
                    at_code: strATCode
                }, objLogInfo, function (error, pResult) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43530', 'Error in GetATDescription function', error);
                            return callback(strATDesc);
                        } else if (pResult) {
                            if (pResult.rows.length) {
                                strATDesc = pResult.rows[0].at_description;
                                return callback(strATDesc);
                            } else {
                                return callback(strATDesc);
                            }
                        }
                    } catch (error) {
                        return callback(strATDesc);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43531', 'Error in GetATDescription function', error);
                return callback(strATDesc);
            }
        }

        // Query dtt_info
        function GetAttachmentTitle(pClient, strDttCode, strAppId, callback) {
            try {
                reqDBInstance.GetTableFromFXDB(pClient, 'dtt_info', ['app_id', 'dtt_code', 'dtt_description', 'dtt_dfd_json'], {
                    dtt_code: strDttCode,
                    app_id: strAppId
                }, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43532', 'Error in GetAttachmentTitle function', error);
                        } else {
                            var strDttInfoDFDJson = result.rows[0].dtt_dfd_json.toString().replace(/\\/g, '');
                            var strDttDfdJson = JSON.parse(strDttInfoDFDJson);
                            var objDttAtmt = {};
                            if (strDttDfdJson.DTT_ATTACHMENT) {
                                var arrDttAtmt = strDttDfdJson.DTT_ATTACHMENT;
                                for (var i = 0; i < arrDttAtmt.length; i++) {
                                    if (currentObj.DTTA_ID == arrDttAtmt[i].DTTA_ID) {
                                        return callback(arrDttAtmt[i]);
                                    }
                                }
                                reqInstanceHelper.PrintWarn(serviceName, 'No DTT_ATTACHMENT found', objLogInfo);
                                return callback(null);
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43533', 'Error in GetAttachmentTitle function', error);
                        return callback(null);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43534', 'Error in GetAttachmentTitle function', error);
                return callback(null);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-43535', 'Error in insertTrnAtmt function', error);
        return callback(error);
    }
}

function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    };
    return errJson;
}

module.exports = {
    SaveMail: SaveMail,
    FinishApiCall: finishApiCall
};
    /******** End of File *******/