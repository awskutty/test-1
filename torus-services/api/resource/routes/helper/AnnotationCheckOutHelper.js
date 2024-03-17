/*
    @Description        : Helper file for AnnotationCheckOut API
*/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqCommon = require('./Common');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var objLogInfo = null;
var serviceName = 'DoAnnotationChkOutHelper';
var mSession = null;

//This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// This will do annotation check out
function doAnnotationChkOut(pParams, pHeaders, pObjLogInfo, callback) {
    objLogInfo = pObjLogInfo;
    var objAnnChkIn = new reqCommon.AnnotationCheckInResult();
    //objAnnChkIn.Result = "FAILURE";
    try {
        var htTrnAtmt = new Object();
        var intTRNAId = pParams.TRNA_ID;
        var tmpDate = Date.now();
        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
            try {
                var logInfo = null;
                var objCond = new Object();
                objCond['TRNA_ID'] = intTRNAId;
                reqTranDBInstance.GetTableFromTranDB(pSession, 'TRN_ATTACHMENTS', objCond, logInfo, function (pResultFromDb) {
                    try {
                        pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb);
                        htTrnAtmt.TRNA_ID = pParams.TRNA_ID;
                        if (pParams.NEED_UNDO == 'N') {


                            var CheckOutBy = pResultFromDb[0].CHECKED_OUT_BY;
                            var CheckOutByName = pResultFromDb[0].CHECKED_OUT_BY_NAME;
                            var CheckOutDate = pResultFromDb[0].CHECKED_OUT_DATE;
                            // Check already checked out by some other user
                            if (CheckOutBy && CheckOutBy != pParams.pUserId) {
                                objAnnChkIn.CheckOutBy = CheckOutBy;
                                objAnnChkIn.CheckOutByName = CheckOutByName;
                                objAnnChkIn.Message = 'Checked out by ' + CheckOutByName + ' on ' + CheckOutDate;
                                objAnnChkIn.Result = 'SUCCESS';
                                return callback(null, objAnnChkIn);

                            } else {

                                htTrnAtmt.CHECKED_OUT_BY = pParams.pUserId;
                                htTrnAtmt.CHECKED_OUT_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                htTrnAtmt.CHECKED_OUT_BY_NAME = pParams.pLoginName;
                            }
                        } else {
                            htTrnAtmt.CHECKED_OUT_BY = "";
                            htTrnAtmt.CHECKED_OUT_DATE = null;;
                            htTrnAtmt.CHECKED_OUT_BY_NAME = "";
                        }
                        htTrnAtmt.TRN_ID = pResultFromDb[0].TRN_ID;
                        htTrnAtmt.DT_CODE = pResultFromDb[0].DT_CODE;
                        htTrnAtmt.DTT_CODE = pResultFromDb[0].DTT_CODE;
                        htTrnAtmt.DTTA_ID = pResultFromDb[0].DTTA_ID;
                        htTrnAtmt.DTTAD_ID = pResultFromDb[0].DTTAD_ID;
                        htTrnAtmt.DTTADIF_ID = pResultFromDb[0].DTTADIF_ID;
                        htTrnAtmt.DTTAC_DESC = pResultFromDb[0].DTTAC_DESC;
                        htTrnAtmt.FILE_SIZE = pResultFromDb[0].FILE_SIZE;
                        htTrnAtmt.IS_CURRENT = "Y";
                        htTrnAtmt.WATERMARK_CODE = pResultFromDb[0].WATERMARK_CODE;
                        htTrnAtmt.SOURCE = pResultFromDb[0].SOURCE;
                        htTrnAtmt.SOURCE_DETAILS = pResultFromDb[0].SOURCE_DETAILS;
                        htTrnAtmt.RELATIVE_PATH = pResultFromDb[0].RELATIVE_PATH;
                        htTrnAtmt.ORIGINAL_FILE_NAME = pResultFromDb[0].ORIGINAL_FILE_NAME;
                        htTrnAtmt.AT_CODE = pResultFromDb[0].AT_CODE;
                        htTrnAtmt.RESOURCE_SERVER_CODE = pResultFromDb[0].RESOURCE_SERVER_CODE;
                        htTrnAtmt.SORT_ORDER = pResultFromDb[0].SORT_ORDER;
                        htTrnAtmt.SYSTEM_ID = pResultFromDb[0].SYSTEM_ID;
                        htTrnAtmt.ATMT_DTT_CODE = pResultFromDb[0].ATMT_DTT_CODE;
                        htTrnAtmt.ATMT_TRN_ID = pResultFromDb[0].ATMT_TRN_ID;
                        htTrnAtmt.ATMT_TS_ID = pResultFromDb[0].ATMT_TS_ID;
                        htTrnAtmt.TOTAL_PAGES = pResultFromDb[0].TOTAL_PAGES;
                        htTrnAtmt.IS_DELETED = pResultFromDb[0].IS_DELETED;
                        htTrnAtmt.ANNOTATION_IMAGE_NAME = pResultFromDb[0].ANNOTATION_IMAGE_NAME;
                        htTrnAtmt.COMMENT_TEXT = pResultFromDb[0].COMMENT_TEXT;
                        htTrnAtmt.VERSION_NO = pResultFromDb[0].VERSION_NO;
                        if (!pResultFromDb[0].GROUP_ID || pResultFromDb[0].GROUP_ID == '0') {
                            htTrnAtmt.GROUP_ID = pResultFromDb[0].TRNA_ID;
                        } else {
                            htTrnAtmt.GROUP_ID = pResultFromDb[0].GROUP_ID;
                        }
                        htTrnAtmt.CREATED_BY = pResultFromDb[0].CREATED_BY;
                        htTrnAtmt.CREATED_DATE = pResultFromDb[0].CREATED_DATE;
                        var objCond = new Object();
                        objCond['TRNA_ID'] = htTrnAtmt.TRNA_ID;
                        reqTranDBInstance.UpdateTranDBWithAudit(pSession, 'TRN_ATTACHMENTS', htTrnAtmt, objCond, logInfo, function (result) {
                            try {
                                //objAnnChkIn.Result = "SUCCESS";
                                if (pParams.NEED_UNDO == 'Y') {
                                    objAnnChkIn.CheckOutBy = "";
                                    objAnnChkIn.CheckOutByName = "";
                                    objAnnChkIn.Result = 'SUCCESS';
                                } else {
                                    objAnnChkIn.CheckOutBy = pParams.pUserId;
                                    objAnnChkIn.CheckOutByName = pParams.pLoginName;
                                    objAnnChkIn.CheckOutDate = tmpDate;
                                    objAnnChkIn.Result = 'SUCCESS';
                                }
                                return callback(null, objAnnChkIn);
                            } catch (error) {
                                return callback(prepareErrorData(error, 'ERR-RES-71705', 'Error in doAnnotationChkOut function'));
                            }
                        });
                    } catch (error) {
                        return callback(prepareErrorData(error, 'ERR-RES-71706', 'Error in doAnnotationChkOut function'));
                    }
                });
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-RES-71707', 'Error in doAnnotationChkOut function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-71701', 'Error in doAnnotationChkOut function'));
    }
}

// This is used to prepate error object
function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    };
    return errJson;
}

module.exports = {
    DoAnnotationChkOut: doAnnotationChkOut,
    FinishApiCall: finishApiCall
};
    /******** End of File *******/