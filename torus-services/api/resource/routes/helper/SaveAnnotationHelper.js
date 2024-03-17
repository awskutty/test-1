/*
    @Description        : Helper file for Save Annotation
*/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var objLogInfo = null;
var mSession = null;
var serviceName = 'SaveAnnotationHelper';

//This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// This will do delete old annotations from trn_annotations and insert new changes
function saveAnnotation(pParams, pHeaders, pObjLogInfo, callback) {
    objLogInfo = pObjLogInfo;
    try {
        reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
            try {
                mSession = pSession;
                var objCond = new Object();
                objCond['TRN_ID'] = pParams.TRNA_ID;
                reqTranDBInstance.DeleteTranDB(pSession, 'TRN_ANNOTATIONS', objCond, objLogInfo, function (result, error) {
                    try {
                        if (error) {
                            reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                return callback(prepareErrorData(error, 'ERR-RES-71509', 'Error in saveAnnotation function'));
                            });
                        } else {
                            if (result == 'SUCCESS') {
                                var htTrnAnn = new Object();
                                htTrnAnn.TRN_ID = pParams.TRNA_ID;
                                htTrnAnn.ANNOTATION_TYPE = "";
                                htTrnAnn.ANNOTATION_TEXT = "";
                                htTrnAnn.ANNOTATION_DATA = pParams.ANNOTATION_DATA.toString();
                                htTrnAnn.CREATED_BY = pParams.U_ID;
                                htTrnAnn.CREATED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                htTrnAnn.APP_ID = objLogInfo.APP_ID;
                                htTrnAnn.TENANT_ID = objLogInfo.TENANT_ID
                                var arrValues = [];
                                arrValues.push(htTrnAnn);
                                reqTranDBInstance.InsertTranDBWithAudit(pSession, 'TRN_ANNOTATIONS', arrValues, objLogInfo, function (result, error) {
                                    try {
                                        if (error) {
                                            reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                return callback(prepareErrorData(error, 'ERR-RES-71511', 'Error in saveAnnotation function'));
                                            });
                                        } else {
                                            reqTranDBInstance.Commit(pSession, true, function callbackres(res) {
                                                return callback(null, 'SUCCESS');
                                            });
                                        }
                                    } catch (error) {
                                        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                            return callback(prepareErrorData(error, 'ERR-RES-71505', 'Error in saveAnnotation function'));
                                        });
                                    }
                                });
                            } else {
                                reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                    return callback(prepareErrorData(error, 'ERR-RES-71501', 'Error in saveAnnotation function'));
                                });
                            }
                        }
                    } catch (error) {
                        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                            return callback(prepareErrorData(error, 'ERR-RES-71506', 'Error in saveAnnotation function'));
                        });
                    }
                });
            } catch (error) {
                reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                    return callback(prepareErrorData(error, 'ERR-RES-71507', 'Error in saveAnnotation function'));
                });
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-71508', 'Error in saveAnnotation function'));
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
    SaveAnnotation: saveAnnotation,
    FinishApiCall: finishApiCall
};
/******** End of File *******/