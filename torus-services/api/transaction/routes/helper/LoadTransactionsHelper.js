// Require dependencies
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqCommon = require('../../../../../torus-references/transaction/Common');
var serviceName = 'LoadTransactionsHelper';
var objLogInfo = null;
var mSession = null;

// This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// This is for load child level transaction data
function loadTransactions(pParams, pHeaders, pLogInfo, callback) {
    try {
        objLogInfo = pLogInfo;
        var data = new reqCommon.ItemSet();
        var strAPPId = pParams.APP_ID;
        var strDTCode = pParams.DT_CODE;
        var strUICGCODE = pParams.UICG_CODE;
        var strEVENTCODE = pParams.EVENT_CODE;
        var PARENT_TS_ID = pParams.PARENT_TS_ID;
        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
            try {
                var cond = new Object();
                cond.app_id = strAPPId;
                cond.dt_code = strDTCode;
                reqDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], cond, objLogInfo, function (error, result) {
                    if (error) {
                        return callback(prepareErrorData(error, 'ERR-TRX-100210', 'Error in loadTransactions function'));
                    } else {
                        try {
                            var objdtInfoR = result.rows;
                            var DTR = new Object();
                            if (objdtInfoR) {
                                DTR = JSON.parse(objdtInfoR[0].relation_json);
                            }
                            var dttR = new reqCommon.DttRelation();
                            if (PARENT_TS_ID != "" && PARENT_TS_ID != 0) {
                                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                                    try {
                                        var objCond = new Object();
                                        objCond['TS_ID'] = PARENT_TS_ID;
                                        reqTranDBInstance.GetTableFromTranDB(pSession, 'TRANSACTION_SET', objCond, objLogInfo, function (pResultFromDb) {
                                            try {
                                                pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb, objLogInfo);
                                                if (pResultFromDb.length) {
                                                    for (var i = 0; i < pResultFromDb.length; i++) {
                                                        var dataobj = pResultFromDb[i];
                                                        dttR = new reqLinq(DTR)
                                                            .Where(function (tmp) { return tmp.DTT_CODE == dataobj.DTT_CODE; })
                                                            .FirstOrDefault();
                                                        PrepareTranData(pSession, strDTCode, dataobj.TS_ID, dataobj.TRN_ID, dttR, function (data) {
                                                            try {
                                                                if (data.length) {
                                                                    var result = JSON.stringify(data);
                                                                    return callback(null, result);
                                                                } else {
                                                                    reqInstanceHelper.PrintWarn(serviceName, 'No data found', objLogInfo);
                                                                    return callback(null, null, 'No data found');
                                                                }
                                                            } catch (error) {
                                                                return callback(prepareErrorData(error, 'ERR-TRX-100211', 'Error in loadTransactions function'));
                                                            }
                                                        });
                                                    }
                                                } else {
                                                    reqInstanceHelper.PrintWarn(serviceName, 'No data found', objLogInfo);
                                                    return callback(null, null, 'No data found');
                                                }
                                            } catch (error) {
                                                return callback(prepareErrorData(error, 'ERR-TRX-100212', 'Error in loadTransactions function'));
                                            }
                                        });
                                    } catch (error) {
                                        return callback(prepareErrorData(error, 'ERR-TRX-100204', 'Error in loadTransactions function'));
                                    }
                                });
                            }
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-TRX-100205', 'Error in loadTransactions function'));
                        }
                    }
                });
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-TRX-100206', 'Error in loadTransactions function'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-TRX-100207', 'Error in loadTransactions function'));
    }
}

// 
function PrepareTranData(pSession, strDTCode, TS_ID, Key_Value, dttR, callback) {
    try {
        var data = [];
        var objCond = new Object();
        objCond[dttR.PRIMARY_COLUMN] = Key_Value;
        reqTranDBInstance.GetTableFromTranDB(pSession, dttR.TARGET_TABLE, objCond, objLogInfo, function (pResultFromDb) {
            try {
                pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb, objLogInfo);
                if (pResultFromDb.length) {
                    var item = pResultFromDb[0];
                    var tmpset = new reqCommon.ItemSet();
                    tmpset.DT_Code = strDTCode
                    tmpset.DTT_Code = dttR.DTT_CODE
                    tmpset.Key_Column = dttR.PRIMARY_COLUMN
                    tmpset.TS_Id = TS_ID
                    var tmpitem = new reqCommon.Item();
                    var itemKeys = Object.keys(item);
                    itemKeys.forEach(function (key) {
                        tmpitem[key.toUpperCase()] = item[key];
                    }, this);
                    tmpset.Items.push(tmpitem);
                    data.push(tmpset);
                    return callback(data);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100208', 'Error in PrepareTranData function', error);
                return callback(data);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100209', 'Error in PrepareTranData function', error);
        return callback(data);
    }
}

function prepareErrorData(error, errorCode, errorMessage){
    var errJson = {
        ERROR : error,
        ERROR_CODE : errorCode,
        ERROR_MESSAGE : errorMessage
    }
    return errJson;
}

module.exports = {
    LoadTransactions: loadTransactions,
    FinishApiCall: finishApiCall
}
/********* End of File *********/