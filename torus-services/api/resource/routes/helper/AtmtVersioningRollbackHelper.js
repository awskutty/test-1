/*
    @Description        : Helper file for AtmtVersioningRollback API
*/

// Require dependencies
var reqPath = require('path');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var objLogInfo = null;
var mSession = null;
var serviceName = 'AtmtVersioningRollbackHelper';

//This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// This will do attachment rollback
function doRollback(pParams, pHeaders, pObjLogInfo, callback) {
    objLogInfo = pObjLogInfo;
    try {
        var intUserId = parseInt(pParams.U_ID);
        var intCurrentTRNAID = parseInt(pParams.PARAMS.CURR_ATMT_ID);
        var strRollBackAtmtData = (pParams.PARAMS.ROLLBACK_DATA).toString();
        var lstAttDetails = JSON.parse(strRollBackAtmtData);
        var Item_Ids = [];
        var isleast = pParams.PARAMS.isleast;
        var resCasRelPath = [];
        for (var i = 0; i < lstAttDetails.length; i++) {
            var item = lstAttDetails[i];
            resCasRelPath.push(item.FilePath)
            Item_Ids.push(item.AttId);
        }
        if (isleast == 'Y') {
            Item_Ids = [];
        }
        reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (ResCasDBSession) {
                try {
                    mSession = pSession;
                    var logInfo = null;
                    var objCond = new Object();
                    objCond['TRNA_ID'] = intCurrentTRNAID;
                    reqTranDBInstance.GetTableFromTranDB(pSession, 'TRN_ATTACHMENTS', objCond, logInfo, function (pResultFromDb) {
                        try {
                            pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb);
                            if (pResultFromDb.length) {
                                pResultFromDb[0].IS_CURRENT = "Y";
                                var arrTableDetails = [];
                                var arrConditions = [];
                                var trnid = pResultFromDb[0].TRN_ID
                                var objTableDeleteDetails = new Object();
                                arrConditions.push({
                                    column: 'TRN_ID',
                                    value: Item_Ids
                                });
                                objTableDeleteDetails.tableName = 'TRN_ANNOTATIONS';
                                objTableDeleteDetails.conditions = arrConditions;
                                arrTableDetails.push(objTableDeleteDetails);
                                var objTableUpdateDetails = new Object();
                                arrConditions = [];
                                arrConditions.push({
                                    column: 'TRNA_ID',
                                    value: pResultFromDb[0].TRNA_ID
                                });
                                objTableUpdateDetails.tableName = 'TRN_ATTACHMENTS';
                                objTableUpdateDetails.values = pResultFromDb[0];
                                objTableUpdateDetails.conditions = arrConditions;
                                arrTableDetails.push(objTableUpdateDetails);
                                var objtrnCond = new Object();
                                objtrnCond['TRN_ID'] = trnid
                                objtrnCond['IS_CURRENT'] = "Y"
                                var CurtrnaId;


                                reqTranDBInstance.GetTableFromTranDB(pSession, 'TRN_ATTACHMENTS', objtrnCond, logInfo, function callbackres(result) {
                                    try {
                                        if (result) {
                                            CurtrnaId = result[0].trna_id;
                                            resCasRelPath.push(result[0].relative_path);
                                            Item_Ids.push(CurtrnaId)
                                            DeleteAtmt(Item_Ids);
                                        } else {
                                            return callback(prepareErrorData(error, 'ERR-RES-71001', 'Error in doRollback function'));
                                        }
                                    } catch (error) {
                                        return callback(prepareErrorData(error, 'ERR-RES-71005', 'Error in doRollback function'));
                                    }
                                })

                                function updateatmt() {
                                    reqTranDBInstance.UpdateTranDBWithAudit(pSession, 'TRN_ATTACHMENTS', {
                                        IS_CURRENT: 'Y',
                                        TRNA_ID: CurtrnaId
                                    }, {
                                        TRNA_ID: intCurrentTRNAID
                                    }, logInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                        reqTranDBInstance.Commit(pSession, true, function callbackres(res) {
                                            return callback(null, 'SUCCESS');
                                        });
                                    });
                                }

                                function DeleteAtmt(Item_Ids) {
                                    var DeleteAtmt = 'Delete from TRN_ATTACHMENTS WHERE TRNA_ID  IN (' + Item_Ids.toString() + ')';
                                    reqTranDBInstance.ExecuteSQLQuery(pSession, DeleteAtmt, logInfo, function (result) {
                                        try {
                                            if (result) {
                                                // updateatmt();
                                                DeleteResCasData();
                                            } else {
                                                reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                    return callback(null, result);
                                                });
                                            }
                                        } catch (error) {
                                            reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                return callback(prepareErrorData(error, 'ERR-RES-71006', 'Error in doRollback function'));
                                            });
                                        }
                                    });
                                }

                                function DeleteResCasData() {
                                    try {
                                        reqDBInstance.DeleteFXDB(ResCasDBSession, 'TRNA_DATA', { 'relative_path': resCasRelPath }, objLogInfo, function (perr, DelResult) {
                                            if (perr) {
                                                reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                    return callback(prepareErrorData(perr, 'ERR-RES-71016', 'Error in delete Rescas data function'));
                                                });
                                            } else {
                                                updateatmt();
                                            }
                                        })
                                    } catch (error) {
                                        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                            return callback(prepareErrorData(error, 'ERR-RES-71016', 'Exception occured in delete Rescas data function'));
                                        });
                                    }
                                }
                            } else {
                                var objTableDeleteDetails = new Object();
                                var arrConditions = [];
                                arrConditions.push({
                                    column: 'TRN_ID',
                                    value: Item_Ids
                                });
                                objTableDeleteDetails.tableName = 'TRN_ANNOTATIONS';
                                objTableDeleteDetails.conditions = arrConditions;
                                reqTranDBInstance.DeleteMulti(pSession, objTableDeleteDetails, function (result) {
                                    reqTranDBInstance.Commit(pSession, true, function callbackres(res) {
                                        return callback(null, result);
                                    });
                                });
                            }

                        } catch (error) {
                            reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                return callback(prepareErrorData(error, 'ERR-RES-71007', 'Error in doRollback function'));
                            });
                        }
                    });
                } catch (error) {
                    reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                        return callback(prepareErrorData(error, 'ERR-RES-71008', 'Error in doRollback function'));
                    });
                }
            })
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-RES-71009', 'Error in doRollback function'));
    }
}

function prepareErrorData(error, errorCode, errorMessage) {
    var errJson = {
        ERROR: error,
        ERROR_CODE: errorCode,
        ERROR_MESSAGE: errorMessage
    }
    return errJson;
}

module.exports = {
    DoRollback: doRollback,
    FinishApiCall: finishApiCall
}
    /******** End of File *******/