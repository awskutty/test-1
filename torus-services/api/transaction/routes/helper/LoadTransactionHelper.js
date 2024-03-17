/***
    @Description        : Helper file for Save transaction API
    @Changed_for        : AppId filter removed from  DT_INFO query 

***/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqEncryptionInstance = require('../../../../../torus-references/common/crypto/EncryptionInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqCommon = require('../../../../../torus-references/transaction/Common');
var reqServiceHelper = require('../../../../../torus-references/common/serviceHelper/ServiceHelper')
var serviceName = 'LoadTransactionHelper';
var objLogInfo = null;
var mSession = null;
var reqLINQ = require('node-linq').LINQ;

// This will call when unexpected close or finish
function finishApiCall() {
    if (mSession) {
        reqTranDBInstance.CallRollback(mSession);
    }
}

// To get the transaction row for the selected key column value
function loadTransaction(pParams, pHeaders, pLogInfo, callback) {
    try {
        objLogInfo = pLogInfo;
        var strAPPId = pParams.APP_ID;
        var strDTCode = pParams.DT_CODE;
        var strDTTCode = pParams.DTT_CODE;
        var Key_Column = pParams.KEYCOLUMN;
        var Key_Value = pParams.KEYVALUE;
        var ChangedetectType = pParams.CHANGE_DETECTION;
        //var strUICGCODE = pParams.UICG_CODE;
        //var strEVENTCODE = pParams.EVENT_CODE;
        var arrPwdCtrls = pParams.PWDCtrls ? pParams.PWDCtrls.split(',') : [];
        var CurPrctId = '';
        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (pcltsession) {
                try {
                    var cond = new Object();
                    // cond.app_id = strAPPId;
                    cond.dt_code = strDTCode;
                    reqDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], cond, objLogInfo, function (error, result) {
                        try {
                            if (error) {
                                return callback(prepareErrorData(error, 'ERR-TRX-100105', 'Error in reqDBInstance.GetTableFromFXDB callback'));
                            } else {
                                var objdtInfoR = result.rows[0];
                                var DTR = [];
                                if (objdtInfoR) {
                                    if (objdtInfoR.relation_json) {
                                        DTR = JSON.parse(objdtInfoR.relation_json);
                                    } else {
                                        return callback(null, null, 'Entity relation not found');
                                    }
                                } else {
                                    return callback(null, null, 'Entity relation not found');
                                }
                                // Get dtt_info
                                reqInstanceHelper.PrintInfo(serviceName, 'Recursive finding for child DTT relations', objLogInfo);
                                reqCommon.DoFilterRecursiveArr(DTR, strDTTCode, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, async function (dttR) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Check and get encrypted column details.', objLogInfo);
                                        var DecryptColumn = await reqServiceHelper.getEncryptColumnDetails(pcltsession, strDTTCode, objLogInfo);
                                        reqInstanceHelper.PrintInfo(serviceName, 'Got the encrypted column details. ' + (DecryptColumn.length ? 'Encrypted columns available for this dtt | ' : 'There is no encrypted columns for this dtt | ') + strDTTCode, objLogInfo);
                                        if (dttR) {
                                            if (DecryptColumn.length) {
                                                var dttinfo = await getdttInfo(dttR);
                                                var arrColumndetails = dttinfo.DATA_FORMATS[0].DF_DETAILS;
                                                var column = dttR.PRIMARY_COLUMN + ',CREATED_BY_NAME,CREATED_CLIENTIP,CREATED_DATE,CREATED_BY,CREATED_TZ,CREATED_TZ_OFFSET,CREATED_BY_SESSIONID,ROUTINGKEY,APP_ID,CREATED_DATE_UTC,TENANT_ID';
                                                for (var i = 0; i < arrColumndetails.length; i++) {
                                                    if (arrColumndetails[i].TARGET_COLUMN != '') {
                                                        column += ",";
                                                        column += arrColumndetails[i].TARGET_COLUMN;
                                                    } else {
                                                        continue;
                                                    }
                                                }
                                                for (var j = 0; j < DecryptColumn.length; j++) {
                                                    if (column.indexOf(DecryptColumn[j].trim()) > -1) {
                                                        column = column.replaceAll(DecryptColumn[j], `fn_pcidss_decrypt(${DecryptColumn[j]},'${process.env.PCIDSS_KEY}') as ${DecryptColumn[j]} `)
                                                    }
                                                }
                                            }



                                            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                                                try {
                                                    mSession = pSession;
                                                    if (DecryptColumn.length) {
                                                        getDataByRawQuery()
                                                    } else {
                                                        getDataByObjQry()
                                                    }

                                                    function getDataByRawQuery() {
                                                        try {
                                                            var rawqry = `SELECT ${column} FROM ${dttR.TARGET_TABLE} WHERE ${Key_Column} = ${Key_Value} `;
                                                            reqTranDBInstance.ExecuteSQLQuery(pSession, rawqry, objLogInfo, function (pResultFromDb, err) {
                                                                agterGetDatafromTable(pResultFromDb.rows)
                                                            })
                                                        } catch (err) {
                                                            return callback(prepareErrorData(error, 'ERR-TRX-100122', 'Exception occured | ' + err));
                                                        }
                                                    }

                                                    function getDataByObjQry() {
                                                        try {
                                                            var objCond = new Object();
                                                            objCond[Key_Column] = Key_Value;
                                                            reqTranDBInstance.GetTableFromTranDB(pSession, dttR.TARGET_TABLE, objCond, objLogInfo, function (pResultFromDb) {
                                                                agterGetDatafromTable(pResultFromDb)
                                                            })
                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-TRX-100121', 'Exception occured | ' + error));
                                                        }
                                                    }
                                                    function agterGetDatafromTable(pResultFromDb) {
                                                        try {
                                                            pResultFromDb = pResultFromDb
                                                            pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb, objLogInfo);
                                                            if (pResultFromDb.length) {
                                                                var tmpset = new reqCommon.ItemSet();
                                                                tmpset.DT_Code = strDTCode;
                                                                tmpset.DTT_Code = strDTTCode;
                                                                tmpset.Key_Column = Key_Column;
                                                                reqCommon.ByteValToString(pResultFromDb[0], objLogInfo, function (result) {
                                                                    try {
                                                                        //decrypt password if password field given
                                                                        CurPrctId = pResultFromDb[0].PRCT_ID;
                                                                        for (var l = 0; l < arrPwdCtrls.length; l++) {
                                                                            var strPwd = arrPwdCtrls[l];
                                                                            if ((strPwd in result) && result[strPwd]) {
                                                                                try {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Decrypting password field - ' + strPwd, objLogInfo);
                                                                                    var strDecPwd = reqEncryptionInstance.DoDecrypt(result[strPwd].toLowerCase());
                                                                                    result[strPwd] = strDecPwd;
                                                                                } catch (error) {
                                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100106', 'Error in reqCommon.ByteValToString callback', error);
                                                                                    delete result[strPwd];
                                                                                }
                                                                            }
                                                                        }
                                                                        tmpset.Items.push(result);
                                                                        if (ChangedetectType) {
                                                                            if (ChangedetectType == 'IV_CHANGE_DETECTION') {
                                                                                var allComlumns = Object.keys(result);
                                                                                var IVColumns = [];
                                                                                // Get IV Columns only
                                                                                for (var colidx = 0; colidx < allComlumns.length; colidx++) {
                                                                                    if (allComlumns[colidx].toLowerCase().startsWith('iv_')) {
                                                                                        IVColumns.push(allComlumns[colidx])
                                                                                    }
                                                                                }

                                                                                // Check all the IV (normal) column is null or empty to find the version 
                                                                                var initalVersion = true
                                                                                for (var ivcolindx = 0; ivcolindx < IVColumns.length; ivcolindx++) {
                                                                                    if (result[IVColumns[ivcolindx].split('IV_')[1]]) {
                                                                                        initalVersion = false
                                                                                        break
                                                                                    }
                                                                                }


                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Is initial version | ' + initalVersion, objLogInfo);
                                                                                if (!initalVersion) {
                                                                                    // Compare IV column with actual column value.
                                                                                    var changedData = {};
                                                                                    var changedColumns = [];
                                                                                    for (var ivcolidx = 0; ivcolidx < IVColumns.length; ivcolidx++) {
                                                                                        if (result[IVColumns[ivcolidx]] != result[IVColumns[ivcolidx].split('IV_')[1]]) {
                                                                                            changedData[IVColumns[ivcolidx].toLowerCase()] = result[IVColumns[ivcolidx].split('IV_')[1]];
                                                                                            changedColumns.push(IVColumns[ivcolidx])
                                                                                        }
                                                                                    }

                                                                                    var changedDataDtl = {
                                                                                        changedColumns: changedColumns,
                                                                                        changedRows: [changedData]
                                                                                    };
                                                                                    tmpset.DataDiff = changedDataDtl
                                                                                }
                                                                                return callback(null, tmpset);
                                                                            } else {
                                                                                // Going to get the previous version from HST TRAN DATA 
                                                                                _getPreviousVersionData(ChangedetectType, function (res) {
                                                                                    var previosVersionData = res;
                                                                                    if (previosVersionData) {
                                                                                        _compareversiondata(ChangedetectType, previosVersionData, function (diffData) {
                                                                                            tmpset.DataDiff = diffData;
                                                                                            return callback(null, tmpset);
                                                                                        });
                                                                                    } else {
                                                                                        tmpset.DataDiff = {};
                                                                                        return callback(null, tmpset);
                                                                                    }
                                                                                });
                                                                            }
                                                                        } else {
                                                                            return callback(null, tmpset);
                                                                        }
                                                                    } catch (error) {
                                                                        return callback(prepareErrorData(error, 'ERR-TRX-100107', 'Error in reqCommon.ByteValToString callback'));
                                                                    }
                                                                });
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(serviceName, 'No data found', objLogInfo);
                                                                return callback(null, null, 'No data found');
                                                            }
                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-TRX-100108', 'Error in reqTranDBInstance.GetTableFromTranDB callback'));
                                                        }
                                                    }


                                                    function _getPreviousVersionData(ptype, pCallback) {
                                                        try {
                                                            // var strqry = `select * from ${dttR.TARGET_TABLE} where dtt_code = '${strDTTCode}' and tenant_id = '${objLogInfo.TENANT_ID}' and app_id = '${objLogInfo.APP_ID}' and ${Key_Column} = '${Key_Value}'  `;
                                                            var strqry = `select * from HST_TRAN_DATA where dtt_code='${strDTTCode}' and tenant_id = '${objLogInfo.TENANT_ID}' and app_id='${objLogInfo.APP_ID}' and tran_id ='${Key_Value}'  `;
                                                            reqTranDBInstance.ExecuteSQLQuery(pSession, strqry, objLogInfo, function (res, err) {
                                                                try {
                                                                    if (err) {
                                                                        return callback(prepareErrorData(err, 'ERR-TRX-100131', 'Error in query hst trn data funtion callbackfunction '));
                                                                    } else {
                                                                        if (res.rows.length) {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Got the result from hst table. Rows count ' + res.rows.length, objLogInfo);
                                                                            var rows = res.rows;
                                                                            var orderbyrows = new reqLINQ(rows).OrderByDescending(function (item) {
                                                                                return item.prct_id;
                                                                            }).ToArray();
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Change detection Type | ' + ptype, objLogInfo);
                                                                            if (ptype == 'CHANGE_DATA_PREV_VERSION') {
                                                                                // Getting the current PRCTID row
                                                                                var curRow = new reqLINQ(rows).Where(function (item) {
                                                                                    return item.prct_id == CurPrctId;
                                                                                }).ToArray();
                                                                                var curjsonData = "";
                                                                                if (curRow.length) {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Got the current data row ', objLogInfo);
                                                                                    curjsonData = curRow[0].new_data_json;
                                                                                }
                                                                                // Getting the previous process rows
                                                                                var prevVersionRows = new reqLINQ(rows).Where(function (item) {
                                                                                    return item.prct_id < CurPrctId;
                                                                                }).ToArray();
                                                                                var oldjsonData = '';
                                                                                if (prevVersionRows.length) {
                                                                                    reqInstanceHelper.PrintInfo(serviceName, 'Got the previos process data row ', objLogInfo);
                                                                                    var orderbyprevVersionRows = new reqLINQ(prevVersionRows).OrderByDescending(function (item) {
                                                                                        return item.prct_id;
                                                                                    }).ToArray();
                                                                                    if (orderbyprevVersionRows.length) {
                                                                                        oldjsonData = orderbyprevVersionRows[0].new_data_json;
                                                                                    }
                                                                                }
                                                                                var compareRows = [{
                                                                                    old_data_json: oldjsonData,
                                                                                    new_data_json: curjsonData
                                                                                }];

                                                                                pCallback(compareRows);
                                                                            } else {
                                                                                pCallback(orderbyrows);
                                                                            }
                                                                        } else {
                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Hst Data - No rows found ', objLogInfo);
                                                                            pCallback('');
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    return callback(prepareErrorData(error, 'ERR-TRX-100131', 'Error in _getPreviousVersionData callbackfunction '));
                                                                }
                                                            });

                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-TRX-100130', 'Error in _getPreviousVersionData '));
                                                        }
                                                    }

                                                    function _compareversiondata(changeDetectType, PrevVersion, callback) {
                                                        try {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Version compare in progress', objLogInfo);
                                                            var fullChangedData = [];
                                                            var changedColumns = [];

                                                            var changedData = {};

                                                            for (var prvdata = 0; prvdata < PrevVersion.length; prvdata++) {
                                                                // var keys = Object.keys(curVersion);

                                                                if (changeDetectType != 'CHANGE_DATA_PREV_VERSION') {
                                                                    changedData = {};
                                                                }
                                                                if (PrevVersion[prvdata].old_data_json) {
                                                                    var oldDataJson = JSON.parse(PrevVersion[prvdata].old_data_json);
                                                                    var newdataJson = JSON.parse(PrevVersion[prvdata].new_data_json);
                                                                    var keys = Object.keys(oldDataJson);
                                                                    for (var i = 0; i < keys.length; i++) {
                                                                        if (oldDataJson[keys[i]] != newdataJson[keys[i]]) {
                                                                            changedData[keys[i]] = oldDataJson[keys[i]];
                                                                            if (changedColumns.indexOf(keys[i]) == -1) {
                                                                                changedColumns.push(keys[i].toUpperCase());
                                                                            }
                                                                        }
                                                                    }
                                                                    if (changeDetectType != 'CHANGE_DATA_PREV_VERSION') {
                                                                        fullChangedData.push(changedData);
                                                                    }
                                                                }

                                                            }
                                                            if (changeDetectType == 'CHANGE_DATA_PREV_VERSION') {
                                                                fullChangedData.push(changedData);
                                                            }
                                                            var changedDataDtl = {
                                                                changedColumns: changedColumns,
                                                                changedRows: fullChangedData
                                                            };
                                                            callback(changedDataDtl);

                                                        } catch (error) {
                                                            return callback(prepareErrorData(error, 'ERR-TRX-100129', 'Error in _compareversiondata '));
                                                        }
                                                    }
                                                } catch (error) {
                                                    return callback(prepareErrorData(error, 'ERR-TRX-100109', 'Error in reqTranDBInstance.GetTranDBConn callback'));
                                                }
                                            });
                                        } else {
                                            reqInstanceHelper.PrintWarn(serviceName, 'No dt_info found', objLogInfo);
                                            return callback(null, null, 'No dt_info found');
                                        }
                                    } catch (error) {
                                        return callback(prepareErrorData(error, 'ERR-TRX-100110', 'Error in reqCommon.DoFilterRecursiveArr callback'));
                                    }
                                });
                            }
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-TRX-100111', 'Error in reqDBInstance.GetTableFromFXDB callback'));
                        }
                    });

                    function getdttInfo(dttR) {
                        return new Promise((resolve, reject) => {
                            reqDBInstance.GetTableFromFXDB(pClient, 'dtt_info', [], { DTT_Code: dttR.DTT_CODE }, objLogInfo, function (pErr, pRes) {
                                if (pRes.rows.length) {
                                    var dfsJson = pRes.rows[0].dtt_dfd_json.replaceAll("\\", '');
                                    var parsedvalue = JSON.parse(dfsJson);
                                    console.log(parsedvalue);
                                    resolve(parsedvalue)
                                } else {
                                    console.log(pErr)
                                }
                            })
                        })
                    }
                } catch (error) {
                    return callback(prepareErrorData(error, 'ERR-TRX-100112', 'Error in reqDBInstance.GetFXDBConnection callback'));
                }
            })
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-TRX-100104', 'Error in loadTransaction function'));
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
    LoadTransaction: loadTransaction,
    FinishApiCall: finishApiCall
};
/********* End of File *********/