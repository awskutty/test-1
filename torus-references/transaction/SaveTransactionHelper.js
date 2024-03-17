/*
    @Description        : Helper file for Save transaction API
*/

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var reqInstanceHelper = require('../common/InstanceHelper');
var reqSendMessage = require('../communication/core/SendMessage');
var reqTranDBInstance = require('../instance/TranDBInstance');
var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');
var reqCommon = require('./Common');
var reqDBInstance = require('../instance/DBInstance');
var reqDateFormatter = require('../common/dateconverter/DateFormatter');
var reqAuditLog = require('../log/audit/AuditLog');
var reqCacheRedisInstance = require('../instance/CacheRedisInstance');
var objSessionList = {};
var serviceName = 'SaveTransactionHelper';
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];

//This will call when unexpected close or finish
function finishApiCall(objLogInfo) {
    var session = objSessionList[objLogInfo.PRCT_ID];
    if (session) {
        reqTranDBInstance.CallRollback(session);
        objLogInfo = null;
        // objSessionList = null;
    }
}

// This will return dtt description
async function getDTTDescription(pClient, pAppID, pDTTCode, prvLoopDttCode, objLogInfo) {
    return new Promise((resolve, reject) => {
        try {
            var strDTTDesc = '';
            var additionalResobj = {
                dttDesc: ''
            };
            var failres = {
                status: 'FAILURE'
            };
            if (pDTTCode) {
                var cond = new Object();
                cond.APP_ID = pAppID;
                cond.DTT_CODE = pDTTCode;
                reqDBInstance.GetTableFromFXDB(pClient, 'DTT_INFO', [], cond, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100033', 'Error in reqDBInstance.GetTableFromFXDB callback', error);
                            failres.error = error;
                            resolve(failres);
                        } else {
                            if (result.rows) {
                                var objRow = result.rows[0];
                                if (objRow) {
                                    strDTTDesc = objRow.dtt_description;
                                    additionalResobj.dttDesc = strDTTDesc;
                                }
                                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                    //  insert tenant and appid value into 
                                    if (objRow.dtt_dfd_json.indexOf('TENANT_ID') > -1) {
                                        additionalResobj.TenantIdColmnavail = true;
                                    }
                                    if (objRow.dtt_dfd_json.indexOf('APP_ID') > -1) {
                                        additionalResobj.appIdColmnavail = true;
                                    }
                                }
                                objRow = null;
                            }
                        }
                        cond = null;
                        // return callback(strDTTDesc, additionalResobj);
                        resolve(additionalResobj);
                    } catch (error) {
                        cond = null;
                        objRow = null;
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100032', 'Error in reqDBInstance.GetTableFromFXDB callback', error);
                        failres.error = error;
                        resolve(failres);
                        // return callback(error);
                    }
                });
            } else {
                resolve(additionalResobj);
            }
        } catch (error) {
            cond = null;
            objRow = null;
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100031', 'Error in getDTTDescription function', error);
            // return callback(strDTTDesc);
            resolve(additionalResobj);
        }
    });


}

// This will assign inserted values
function assignInsertedValues(pSets, pDTTR, pItem, pResult, objLogInfo, callback) {
    try {
        var arrChildDTTR = pDTTR.CHILD_DTT_RELEATIONS;
        for (var i = 0; i < arrChildDTTR.length; i++) {
            var objChildDTTR = arrChildDTTR[i];
            var arrItemSet = new reqLinq(pSets)
                .Where(function (pIts) {
                    return pIts.DTT_Code == objChildDTTR.DTT_CODE;
                })
                .FirstOrDefault();
            if (arrItemSet) {
                var arrItems = arrItemSet.Items;
                for (var j = 0; j < arrItems.length; j++) {
                    var objItem = arrItems[j];
                    objItem[objChildDTTR.FOREIGN_COLUMN] = pItem[pDTTR.PRIMARY_COLUMN];
                    if (pItem.TS) {
                        objItem.TS['PARENT_TS_ID'] = pItem.TS['TS_ID'];
                    }
                }
            }
        }
        arrItems = null;
        pItem = null;
        objItem = null;
        arrItemSet = null;
        arrChildDTTR = null;
        objChildDTTR = null;
        return callback(pResult);
    } catch (error) {
        arrItems = null;
        objItem = null;
        arrItemSet = null;
        arrChildDTTR = null;
        objChildDTTR = null;
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100030', 'Error in assignInsertedValues function', error);
        return callback(error);
    }
}

// To insert target table and transaction prepared object to database
function saveSet(pSet, pSession, pDTTR, pItemSets, pResult, insertedArr, releaseLock, objLogInfo, callback) {
    try {

        var intTsId = 0;
        var newArrItems = [];
        var arrItems = pSet.Items ? pSet.Items : [];
        var arrPivot = [];
        var j = 0;
        insertItem(arrItems[j]);

        function insertItem(objItem) {
            try {
                var arrTableInsertDetails = [];
                var objTableSelectDetails = new Object();
                var arrTableUpdateDetails = [];
                var obj = new Object();
                var arrConditions = [];
                var insertedIds = {};
                j++;
                if (!objItem.Key_Value || objItem.Key_Value == 0) { // Insert Case (New Record)
                    var keyVal = objItem.Key_Value;
                    if ('$$HASHKEY' in objItem) {
                        delete objItem.$$HASHKEY;
                    }
                    if ('CHANGE_STATE' in objItem) {
                        delete objItem.CHANGE_STATE;
                    }
                    if ('Key_Value' in objItem) {
                        delete objItem.Key_Value;
                    }
                    var ts = objItem.TS;
                    var insertArr = [];
                    delete objItem[pDTTR.PRIMARY_COLUMN];
                    delete objItem.TS;
                    delete objItem.TS_ID;
                    if (objItem.PARENT_TS_ID) { // change it soon
                        delete objItem.PARENT_TS_ID; // this also make "pTableDetails[1].values.PARENT_TS_ID = 0"
                    }
                    if (objItem.TempHT) {
                        delete objItem.TempHT;
                    }
                    insertArr.push(objItem);
                    reqInstanceHelper.PrintInfo(serviceName, 'Inserting target table', objLogInfo);
                    reqTranDBInstance.InsertTranDBWithAudit(pSession, pDTTR.TARGET_TABLE, insertArr, objLogInfo, function (result, error) {
                        try {
                            if (error) {
                                return callback(prepareErrorData(error, 'ERR-TRX-100029', 'Error on target table insert query'));
                            } else {
                                var insertedTRNID = result[0][pDTTR.PRIMARY_COLUMN.toLowerCase()];
                                insertedIds = {};
                                insertedIds.trn_id = insertedTRNID;
                                if (pDTTR.CATEGORY != 'M') { // Transaction_set insert starts here. (Except for DTT Category 'M'(Master))
                                    var parentTSID = objItem.PARENT_TS_ID ? objItem.PARENT_TS_ID : (intTsId ? intTsId : 0);
                                    if (!ts['PARENT_TS_ID']) {
                                        ts['PARENT_TS_ID'] = parentTSID;
                                    }
                                    ts['TRN_ID'] = insertedTRNID;
                                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                        ts['TENANT_ID'] = objLogInfo.TENANT_ID;
                                        ts['APP_ID'] = objLogInfo.APP_ID;
                                    }
                                    var insertArr = [];
                                    delete ts['TS_ID'];
                                    insertArr.push(ts);
                                    reqInstanceHelper.PrintInfo(serviceName, 'Inserting TS table started ', objLogInfo);
                                    reqTranDBInstance.InsertTranDBWithAudit(pSession, 'TRANSACTION_SET', insertArr, objLogInfo, function (result, error) {
                                        try {
                                            if (error) {
                                                return callback(prepareErrorData(error, 'ERR-TRX-100028', 'Error on transaction set insert query'));
                                            } else {
                                                var insertedTSID = result[0][('TS_ID').toLowerCase()];
                                                insertedIds.ts_id = insertedTSID;
                                                ts['TS_ID'] = insertedTSID;
                                                objItem.TS_ID = insertedTSID;
                                                objItem.TS = ts;
                                                objItem[pDTTR.PRIMARY_COLUMN] = insertedTRNID;
                                                objItem.Key_Value = keyVal;
                                                insertedArr.push(insertedIds);
                                                successCall(result, objItem);
                                                insertedTSID = null;
                                            }
                                            insertedIds = null;
                                            keyVal = null;
                                            pItemSets = null;
                                            insertArr = null;

                                            pItemSets = null;
                                        } catch (error) {
                                            insertedIds = null;
                                            keyVal = null;
                                            return callback(prepareErrorData(error, 'ERR-TRX-100027', 'Error in reqTranDBInstance.InsertTranDB callback'));
                                        }
                                    });
                                } else {
                                    objItem[pDTTR.PRIMARY_COLUMN] = insertedTRNID;
                                    objItem.Key_Value = keyVal;
                                    insertedArr.push(insertedIds);
                                    successCall(result, objItem);
                                    insertedIds = null;
                                    keyVal = null;
                                    // arrItems = null;
                                    pItemSets = null;
                                }
                            }
                        } catch (error) {
                            insertedIds = null;
                            keyVal = null;
                            return callback(prepareErrorData(error, 'ERR-TRX-100026', 'Error in reqTranDBInstance.InsertTranDB callback'));
                        }
                    });
                } else {
                    var objCond = {};
                    objCond[pDTTR.PRIMARY_COLUMN] = objItem.Key_Value;
                    reqInstanceHelper.PrintInfo(serviceName, 'Quering target table against key value (for update case)', objLogInfo);
                    reqTranDBInstance.GetTableFromTranDB(pSession, pDTTR.TARGET_TABLE, objCond, objLogInfo, function (resultfromDb) {
                        try {
                            var objItemFromDB = {};
                            if (resultfromDb.length) {
                                resultfromDb = reqInstanceHelper.ArrKeyToUpperCase(resultfromDb, objLogInfo);
                                var isPsetHas = (pSet.Has_status == 'Y' || pSet.Has_processStatus == 'Y');
                                var arrItemKeys = Object.keys(objItem);
                                insertedIds = {};
                                if (isPsetHas) {
                                    objCond = {};
                                    objCond.TRN_ID = objItem.Key_Value;
                                    objCond.DT_CODE = pSet.DT_Code;
                                    objCond.DTT_CODE = pSet.DTT_Code;
                                    reqInstanceHelper.PrintInfo(serviceName, 'Query TS table for update', objLogInfo);
                                    reqTranDBInstance.GetTableFromTranDB(pSession, 'TRANSACTION_SET', objCond, objLogInfo, function (dttransaction) {
                                        try {
                                            if (dttransaction.length) {
                                                var objItemtrns = dttransaction[0];
                                                if (pSet.Has_status == 'Y') {
                                                    objItemtrns.status = pSet.Status;
                                                }
                                                if (pSet.Has_processStatus == 'Y') {
                                                    objItemtrns.process_status = pSet.ProcessStatus;
                                                }
                                                if (releaseLock == 'Y') {
                                                    objItemtrns.locked_by = null; //this is for remove lock
                                                    objItemtrns.locked_by_name = null; //this is for remove lock
                                                }
                                                objCond = {};
                                                objCond['ts_id'] = objItemtrns.ts_id;
                                                insertedIds.ts_id = objCond.ts_id;
                                                reqInstanceHelper.PrintInfo(serviceName, 'Updating TS table', objLogInfo);
                                                reqTranDBInstance.UpdateTranDBWithAudit(pSession, 'TRANSACTION_SET', objItemtrns, objCond, objLogInfo, function (result, error) {
                                                    try {
                                                        if (error) {
                                                            return callback(prepareErrorData(error, 'ERR-TRX-100025', 'Error in reqTranDBInstance.UpdateTranDB callback'));
                                                        } else {
                                                            updateItem(resultfromDb[0], arrItemKeys);
                                                        }
                                                        objCond = null;
                                                        objItemtrns = null;
                                                    } catch (error) {
                                                        objCond = null;
                                                        objItemtrns = null;
                                                        return callback(prepareErrorData(error, 'ERR-TRX-100024', 'Error in reqTranDBInstance.UpdateTranDB callback'));
                                                    }
                                                });
                                            } else { // Without Transaction set case
                                                updateItem(resultfromDb[0], arrItemKeys);
                                            }
                                        } catch (error) {
                                            objCond = null;
                                            objItemtrns = null;
                                            return callback(prepareErrorData(error, 'ERR-TRX-100023', 'Error in reqTranDBInstance.GetTableFromTranDB callback'));
                                        }
                                    });
                                } else {
                                    updateItem(resultfromDb[0], arrItemKeys);
                                }
                            } else {
                                return callback(prepareErrorData('No Data Found for ' + objItem.Key_Value, 'ERR-TRX-100022', 'Error in reqTranDBInstance.GetTableFromTranDB callback'));
                            }
                        } catch (error) {
                            return callback(prepareErrorData(error, 'ERR-TRX-100022', 'Error in reqTranDBInstance.GetTableFromTranDB callback'));
                        }
                    });
                }

                // Update target table in Update case
                function updateItem(objItemFromDB, arrItemKeys) {
                    try {
                        objItemFromDB = assignNewValues(arrItemKeys, objItemFromDB, objItem, pDTTR.PRIMARY_COLUMN, objLogInfo);
                        delete objItemFromDB.CREATED_BY;
                        delete objItemFromDB.CREATED_BY_NAME;
                        delete objItemFromDB.CREATED_DATE;
                        objCond = {};
                        objCond[pDTTR.PRIMARY_COLUMN] = objItem.Key_Value;
                        insertedIds.trn_id = objCond[pDTTR.PRIMARY_COLUMN];
                        reqInstanceHelper.PrintInfo(serviceName, 'Updating Target table', objLogInfo);
                        reqTranDBInstance.UpdateTranDBWithAudit(pSession, pDTTR.TARGET_TABLE, objItemFromDB, objCond, objLogInfo, function (result, error) {
                            try {
                                if (error) {
                                    return callback(prepareErrorData(error, 'ERR-TRX-100021', 'Error in reqTranDBInstance.UpdateTranDB callback'));
                                } else {
                                    insertedArr.push(insertedIds);
                                    successCall(result, objItemFromDB);
                                }

                            } catch (error) {
                                return callback(prepareErrorData(error, 'ERR-TRX-100020', 'Error in reqTranDBInstance.UpdateTranDB callback'));
                            }
                        });
                    } catch (error) {
                        insertedIds = null;
                        objCond = null;
                        return callback(prepareErrorData(error, 'ERR-TRX-100019', 'Error in updateItem function'));
                    }
                }

                // Prepare result object for client after save success, also check child dtt insert
                function successCall(result, newItems) {
                    try {
                        newArrItems.push(newItems);
                        if (result && j == arrItems.length) { // result success conditions
                            pSet.Items = newArrItems;
                            newArrItems = null;
                            if (pSet.Items.length == 1 && !pSet.Items[0].Key_Value) {
                                assignInsertedValues(pItemSets, pDTTR, pSet.Items[0], pResult, objLogInfo, function () {
                                    // pSet.Items[0]
                                    var childDTTRs = pDTTR.CHILD_DTT_RELEATIONS;
                                    if (childDTTRs.length) {
                                        var i = 0;
                                        doChildInsert(childDTTRs[i]);
                                    } else {
                                        var returnObj = {
                                            LAST_INSERT: insertedArr,
                                            STATUS: 'SUCCESS'
                                        };
                                        callback(returnObj, pSet);
                                        pDTTR = null;
                                        pSet = null;
                                        childDTTRs = null;
                                        return;

                                        //return callback('SUCCESS', pSet);
                                    }
                                    //this is for insert childs
                                    function doChildInsert(childDTTR) {
                                        i++;
                                        var ist = new reqLinq(pItemSets)
                                            .Where(function (pIts) {
                                                return pIts.DTT_Code == childDTTR.DTT_CODE;
                                            })
                                            .FirstOrDefault();
                                        if (ist) {
                                            saveSet(ist, pSession, childDTTR, pItemSets, pResult, insertedArr, releaseLock, objLogInfo, function (result) {
                                                if (i < childDTTRs.length) {
                                                    doChildInsert(childDTTRs[i]);
                                                } else {
                                                    var returnObj = {
                                                        LAST_INSERT: insertedArr,
                                                        STATUS: 'SUCCESS'
                                                    };
                                                    childDTTRs = null;
                                                    //insertedArr = null;
                                                    callback(returnObj, pSet);
                                                    pSet = null;
                                                    pDTTR = null;
                                                    return;
                                                    //return callback('SUCCESS', pSet);
                                                }
                                            });
                                        } else {
                                            if (i < childDTTRs.length) {
                                                doChildInsert(childDTTRs[i]);
                                            } else {
                                                var returnObj = {
                                                    LAST_INSERT: insertedArr,
                                                    STATUS: 'SUCCESS'
                                                };
                                                childDTTRs = null;
                                                callback(returnObj, pSet);
                                                pSet = null;
                                                pDTTR = null;
                                                return;
                                                //return callback('SUCCESS', pSet);
                                            }
                                        }
                                    }
                                });
                            } else {
                                var returnObj = {
                                    LAST_INSERT: insertedArr,
                                    STATUS: 'SUCCESS'
                                };
                                callback(returnObj, pSet);
                                pSet = null;
                                pDTTR = null;
                                return;
                                //return callback('SUCCESS', pSet);
                            }
                        } else if (j == arrItems.length) {
                            return callback(result);
                        } else {
                            insertItem(arrItems[j]);
                        }
                    } catch (error) {
                        newArrItems = null;
                        return callback(prepareErrorData(error, 'ERR-TRX-100018', 'Error in successCall function'));
                    }
                }
            } catch (error) {
                newArrItems = null;
                return callback(prepareErrorData(error, 'ERR-TRX-100017', 'Error in insertItem function'));
            }
        }
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-TRX-100016', 'Error in saveSet function'));
    }
}

// function is_array(arrVal) {
//     return (Object.prototype.toString.call(arrVal) === '[object Array]');
// }

// For multi select combo object
function makeMultiSelectComboAsLast(arrMeta, targetCol) {
    var lastElmt = arrMeta[arrMeta.length - 1];
    var multiSelectComboPos = 0;
    for (var i = 0; i < arrMeta.length; i++) {
        var obj = arrMeta[i];
        if (targetCol.toUpperCase() == obj.TARGET_COLUMN.toUpperCase()) {
            multiSelectComboPos = i;
            break;
        }
    }
    var multiSelectCombo = arrMeta[multiSelectComboPos];
    arrMeta[arrMeta.length - 1] = multiSelectCombo;
    arrMeta[multiSelectComboPos] = lastElmt;
    lastElmt = null;
    obj = null;
    multiSelectCombo = null;
    multiSelectComboPos = null;
}

// Read meta data for casting based on data types
function mapDataTypesAndDataBinding(arrFromClient, pHeaders, objLogInfo) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Mapping data types from meta data', objLogInfo);
        var arrMeta = arrFromClient[0].Meta;
        var defaultVal = null;
        var dataBindings = arrFromClient[0].DataBindings;
        var arrItems = {};
        var multiSelectCombo = '';
        var multiSelectComboItems = [];
        for (var h = 0; h < arrFromClient.length; h++) {
            arrItems = arrFromClient[h].Items;
            multiSelectCombo = arrFromClient[h].MultiSelectedItem;
            if (multiSelectCombo) {
                makeMultiSelectComboAsLast(arrMeta, multiSelectCombo);
            }
            for (var i = 0; i < arrItems.length; i++) {
                var itm = arrItems[i];
                if (arrMeta) {
                    for (var j = 0; j < arrMeta.length; j++) {
                        var obj = arrMeta[j];
                        if (obj.TARGET_COLUMN.indexOf('memory') > -1) {
                            //delete memory control here
                            delete itm[obj.TARGET_COLUMN];
                        } else {
                            if (itm[obj.TARGET_COLUMN] === '') {
                                itm[obj.TARGET_COLUMN] = defaultVal;
                            }
                            if (obj.DATA_TYPE == 'DATETIME' && itm[obj.TARGET_COLUMN]) {
                                itm[obj.TARGET_COLUMN] = reqDateFormatter.GetDateAt12AM(pHeaders, objLogInfo, itm[obj.TARGET_COLUMN]);
                            }
                            if (!obj.CTLR_CODE == 'LBL' && obj.TARGET_COLUMN == '') {
                                delete itm[obj.TARGET_COLUMN];
                            }

                            //for multiselect combo array process start
                            if (obj.CTLR_CODE == 'MULTI_SELECT_CBO' && itm[obj.TARGET_COLUMN]) {
                                if (multiSelectCombo.toUpperCase() == obj.TARGET_COLUMN.toUpperCase()) {
                                    var comboValueItm = JSON.parse(JSON.stringify(itm));
                                    for (var m = 0; m < itm[obj.TARGET_COLUMN].length; m++) {
                                        var strVal = itm[obj.TARGET_COLUMN][m].toString();
                                        comboValueItm[obj.TARGET_COLUMN] = strVal;
                                        multiSelectComboItems.push(JSON.parse(JSON.stringify(comboValueItm)));
                                    }
                                    comboValueItm = null;
                                } else {
                                    var strArrValues = '';
                                    for (var l = 0; l < itm[obj.TARGET_COLUMN].length; l++) {
                                        var strVal = itm[obj.TARGET_COLUMN][l].toString();
                                        if (l == 0) {
                                            strArrValues += strVal;
                                        } else {
                                            strArrValues += ',';
                                            strArrValues += strVal;
                                        }
                                    }
                                    itm[obj.TARGET_COLUMN] = strArrValues;
                                    strArrValues = null;
                                    strVal = null;
                                }
                            }
                            //for multiselect combo array process end
                        }
                    }

                } else {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100015', 'Meta DATA_TYPE not found', null);
                }
                if (dataBindings) {
                    for (var k = 0; k < dataBindings.length; k++) {
                        var data = dataBindings[k];
                        if (!data.enableCellEdit && !data.field) {
                            delete itm[data.field];
                        }
                        if (data.type && data.type == 'date') {
                            itm[data.field] = reqDateFormatter.ConvertDate(itm[data.field], pHeaders);
                        }
                    }

                }


            }
        }
        if (multiSelectCombo) {
            arrFromClient[0].Items = multiSelectComboItems;
        }
        multiSelectComboItems = null;
        obj = null;
        data = null;
        dataBindings = null;
        itm = null;
        arrMeta = null;
        arrItems = null;
        multiSelectCombo = null;
        reqInstanceHelper.PrintInfo(serviceName, 'Mapping data types completed', objLogInfo);
    } catch (error) {
        dataBindings = null;
        data = null;
        comboValueItm = null;
        obj = null;
        arrMeta = null;
        arrItems = null;
        multiSelectCombo = null;
        multiSelectComboItems = null;
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100014', 'Error in mapDataTypesAndDataBinding function', error);
    }
}

// Save transaction data to database
function saveTransaction(pRequest, pHeaders, objLogInfo, callback) {
    try {
        var insertedArr = [];
        var releaseLock = 'Y';
        var isTenantIdavail = false;
        var isappIdavail = false;
        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
            try {

                reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
                    // var objsession = {}
                    objSessionList[objLogInfo.PRCT_ID] = pSession;
                    // arrSessionList.push(objsession)
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'Tran DB connection successfull', objLogInfo);
                        reqAuditLog.GetProcessToken(pSession, objLogInfo, function (error, prct_id) {
                            try {
                                if (error) {
                                    return callback(prepareErrorData(error, 'Error Code', 'Error in GetProcessToken function'));
                                }
                                objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                                reqInstanceHelper.PrintInfo(serviceName, 'Assigning input params from Request', objLogInfo);
                                var strResult = 'SUCCESS';
                                var strUserid = pRequest.U_ID;
                                var strSystemid = pRequest.S_ID;
                                var strDTCode = pRequest.DT_CODE;
                                var strDTTCode = pRequest.DTT_CODE;
                                var strAPPId = pRequest.APP_ID;
                                var intKeyValue = pRequest.KEYVALUE;
                                var intTsId = pRequest.TS_ID ? pRequest.TS_ID : 0;
                                var strLoginName = pRequest.LOGIN_NAME;
                                var strSystemDesc = pRequest.SYSTEM_DESC;
                                releaseLock = pRequest.RELEASE_LOCK ? pRequest.RELEASE_LOCK : 'Y';
                                var strDTDesc = '';
                                var arrFromClient = [];
                                var objDTTRelation = new reqCommon.DttRelation();
                                arrFromClient = pRequest.JSON_DATASET;
                                if (typeof arrFromClient == 'string') {
                                    arrFromClient = JSON.parse(arrFromClient);
                                }
                                mapDataTypesAndDataBinding(arrFromClient, pHeaders, objLogInfo);
                                if (arrFromClient[0].Items) {
                                    arrFromClient[0].Items = reqInstanceHelper.ArrKeyToUpperCase(arrFromClient[0].Items, objLogInfo);
                                }
                                var isStrDTCode = (strDTCode && arrFromClient && arrFromClient.length > 0);
                                if (isStrDTCode) {
                                    strDTCode = arrFromClient[0].DT_Code;
                                }
                                var cond = new Object();
                                cond.APP_ID = strAPPId;
                                cond.DT_CODE = strDTCode;
                                reqInstanceHelper.PrintInfo(serviceName, 'Getting relation json from DT_INFO', objLogInfo);
                                reqDBInstance.GetTableFromFXDB(pClient, 'DT_INFO', [], cond, objLogInfo, async function (error, result) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100001', 'Error in reqDBInstance.GetTableFromFXDB callback', error);
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'DT_INFO table result count - ' + result.rows.length, objLogInfo);
                                            var objDTInfo = result.rows[0];
                                            cond = null;
                                            if (objDTInfo) {
                                                objDTTRelation = JSON.parse(objDTInfo.relation_json);
                                                strDTDesc = objDTInfo.dt_description;
                                                objDTInfo = null;
                                            } else {
                                                objDTInfo = null;
                                                strDTDesc = null;
                                                strResult = null;
                                                strUserid = null;
                                                strSystemid = null;
                                                strDTCode = null;
                                                strDTTCode = null;
                                                strAPPId = null;
                                                intKeyValue = null;
                                                intTsId = null;
                                                strLoginName = null;
                                                strSystemDesc = null;
                                                releaseLock = null;
                                                strDTDesc = null;
                                                arrFromClient = null;
                                                objDTTRelation = null;
                                                isTenantIdavail = null;
                                                isappIdavail = null;
                                                return callback(null, null, 'Entity relation not found');
                                            }
                                        }
                                        reqInstanceHelper.PrintInfo(serviceName, 'Calling FilterRecursiveArray function', objLogInfo);
                                        reqCommon.DoFilterRecursiveArr(objDTTRelation, strDTTCode, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, async function (objDTTR) {
                                            try {
                                                assignParentIds(arrFromClient, strDTTCode, intKeyValue, intTsId, objDTTR, false, objLogInfo);
                                                if (objDTTR) {
                                                    var objChildDTTR = objDTTR.CHILD_DTT_RELEATIONS;
                                                    for (var i = 0; i < objChildDTTR.length; i++) {
                                                        var objResult = objChildDTTR[i];
                                                        assignParentIds(arrFromClient, objResult.DTT_CODE, intKeyValue, intTsId, objResult, true, objLogInfo);
                                                    }
                                                    objChildDTTR = null;
                                                }
                                            } catch (error) {
                                                objChildDTTR = null;
                                                return callback(prepareErrorData(error, 'ERR-TRX-100034', 'Error in reqCommon.DoFilterRecursiveArr callback'));
                                            }
                                        });
                                        var jCount = 0;
                                        var j = 0;
                                        reqInstanceHelper.PrintInfo(serviceName, 'Preparing data for insert from input.', objLogInfo);
                                        arrFromClientLoop(arrFromClient[j]);

                                        async function arrFromClientLoop(objItemSet) {
                                            j++;
                                            var arrPwdCtrls = objItemSet.PWDCtrls ? objItemSet.PWDCtrls.split(',') : [];
                                            var arrDecCtrls = objItemSet.DecCtrls ? objItemSet.DecCtrls.split(',') : [];
                                            var arrItems = objItemSet.Items ? objItemSet.Items : [];
                                            var prvLoopDttCode = '';
                                            var prvdttDataObj = '';
                                            var addionalResboj = '';
                                            var kCount = 0;
                                            if (arrItems.length) {
                                                for (var k = 0; k < arrItems.length; k++) {

                                                    var objItem = arrItems[k];
                                                    if (arrPwdCtrls.length) { // encrypt password controls
                                                        for (var l = 0; l < arrPwdCtrls.length; l++) {
                                                            var strPwd = arrPwdCtrls[l];
                                                            if ((strPwd in objItem) && objItem[strPwd]) {
                                                                try {
                                                                    var strDecPwd = reqEncryptionInstance.DecryptPassword(objItem[strPwd]);
                                                                    var strEncPwd = reqEncryptionInstance.DoEncrypt(strDecPwd);
                                                                    objItem[strPwd] = strEncPwd;
                                                                } catch (error) {
                                                                    delete objItem[strPwd];
                                                                }
                                                            }
                                                        }
                                                    }
                                                    if (arrDecCtrls.length) { // Decimal control conversion to float
                                                        for (var m = 0; m < arrDecCtrls.length; m++) {
                                                            var strDec = arrDecCtrls[m];
                                                            if (objItem[strDec]) {
                                                                var containsDot = ((objItem[strDec]).toString()).indexOf('.');
                                                                var isStrDec = ((strDec in objItem) && objItem[strDec] && (containsDot == -1));
                                                                if (isStrDec) {
                                                                    objItem[strDec] = parseFloat(objItem[strDec]);
                                                                }
                                                            }
                                                        }
                                                        strDec = null;
                                                        arrDecCtrls = null;
                                                    }


                                                    if (objItemSet.DTT_Code != prvLoopDttCode) {
                                                        addionalResboj = await getDTTDescription(pClient, strAPPId, objItemSet.DTT_Code, prvLoopDttCode, objLogInfo);
                                                    }
                                                    // prvdttDataObj = addionalResboj;
                                                    prvLoopDttCode = objItemSet.DTT_Code;
                                                    if (addionalResboj.status == 'FAILURE') {
                                                        return callback(prepareErrorData(addionalResboj.error, 'ERR-TRX-100045', 'Error while get DTTDescription'));
                                                    }
                                                    if (!objItem.Key_Value || objItem.Key_Value == 0) { // Insert Case (New Record)
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Key value is EMPTY. Hence this is an insert case', objLogInfo);
                                                        // objItem.CREATED_BY = strUserid;
                                                        // objItem.CREATED_DATE = reqDateFormatter.GetCurrentDate(pHeaders);
                                                        // objItem.CREATED_BY_NAME = strLoginName;
                                                        objItem.SYSTEM_ID = strSystemid;
                                                        objItem.SYSTEM_NAME = strSystemDesc;
                                                        objItem.STATUS = objItemSet.Status;
                                                        objItem.PROCESS_STATUS = objItemSet.ProcessStatus;
                                                        objItem.DT_CODE = objItemSet.DT_Code;
                                                        objItem.DT_DESCRIPTION = strDTDesc;
                                                        objItem.DTT_CODE = objItemSet.DTT_Code;
                                                        objItem.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                                        objItem.VERSION_NO = 0;
                                                        var objTSitem = {};
                                                        if (objItem.TS) {
                                                            objTSitem = objItem.TS;
                                                        }
                                                        objTSitem['STATUS'] = objItemSet.Status;
                                                        objTSitem['PROCESS_STATUS'] = objItemSet.ProcessStatus;
                                                        // objTSitem['CREATED_BY'] = strUserid;
                                                        objTSitem['DTT_CODE'] = objItemSet.DTT_Code;
                                                        objTSitem['DT_CODE'] = objItemSet.DT_Code;
                                                        objTSitem['DT_DESCRIPTION'] = strDTDesc;
                                                        // objTSitem['CREATED_BY_NAME'] = strLoginName;
                                                        objTSitem['SYSTEM_ID'] = strSystemid;
                                                        objTSitem['SYSTEM_NAME'] = strSystemDesc;
                                                        objTSitem['PRCT_ID'] = objLogInfo.PROCESS_INFO.PRCT_ID;
                                                        objTSitem['VERSION_NO'] = 0;
                                                        if (intTsId == 0) {
                                                            objTSitem.GROUP_ID = 'GRP_' + strUserid + ((Date.now() * 10000) + 621355968000000000); //DateAndTime.Now.Ticks
                                                            afterGetGroupId();
                                                        } else {
                                                            getGRPID(intTsId, strAPPId, pHeaders, objLogInfo, function (pGroupId) {
                                                                try {
                                                                    objTSitem.GROUP_ID = pGroupId;
                                                                    // objTSitem.GROUP_ID = await getGRPID(intTsId, strAPPId, pHeaders, objLogInfo);
                                                                    afterGetGroupId();
                                                                } catch (error) {
                                                                    strDec = null;
                                                                    arrDecCtrls = null;
                                                                    return callback(prepareErrorData(error, 'ERR-TRX-100035', 'Error in getGRPID callback'));
                                                                }
                                                            });
                                                        }

                                                        function afterGetGroupId() {
                                                            try {
                                                                if (objTSitem) {
                                                                    if ("PARENT_TS_ID" in objItem && !objTSitem.PARENT_TS_ID || (objTSitem.PARENT_TS_ID && objTSitem.PARENT_TS_ID == 0)) {
                                                                        objTSitem['PARENT_TS_ID'] = objItem.PARENT_TS_ID;
                                                                    } else if (!objTSitem['PARENT_TS_ID']) {
                                                                        objTSitem.PARENT_TS_ID = 0;
                                                                    }
                                                                } else {
                                                                    var objTs = new Object();
                                                                    objTs.PARENT_TS_ID = 0;
                                                                    objTSitem = objTs;
                                                                }
                                                                objItem.TS = objTSitem;
                                                                // getDTTDescription(pClient, strAPPId, objItemSet.DTT_Code, objLogInfo, function CallbackGetDTTDescription(pDesc, addionalResboj) {
                                                                try {
                                                                    if (objItem.TS) {
                                                                        objTSitem = objItem.TS;
                                                                    }
                                                                    if (addionalResboj && addionalResboj.TenantIdColmnavail) {
                                                                        isTenantIdavail = addionalResboj.TenantIdColmnavail;
                                                                    }
                                                                    if (addionalResboj && addionalResboj.appIdColmnavail) {
                                                                        isappIdavail = addionalResboj.appIdColmnavail;
                                                                    }
                                                                    if (addionalResboj.dttDesc) {
                                                                        objItem.DTT_DESCRIPTION = addionalResboj.dttDesc;
                                                                        objTSitem.DTT_DESCRIPTION = addionalResboj.dttDesc;
                                                                    }
                                                                    objItem.TS = objTSitem;
                                                                    kCount++;
                                                                    if (kCount >= arrItems.length) {
                                                                        if (j < arrFromClient.length) {
                                                                            arrFromClientLoop(arrFromClient[j]);
                                                                        } else {
                                                                            objItem = null;
                                                                            objTSitem = null;
                                                                            afterLoopEnd();

                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    objItem = null;
                                                                    objTSitem = null;
                                                                    return callback(prepareErrorData(error, 'ERR-TRX-100036', 'Error in CallbackGetDTTDescription function'));
                                                                }
                                                                // });
                                                            } catch (error) {
                                                                objItem = null;
                                                                objTSitem = null;
                                                                return callback(prepareErrorData(error, 'ERR-TRX-100037', 'Error in afterGetGroupId function'));
                                                            }
                                                        }
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Key value is found. Hence this is an Update case', objLogInfo);
                                                        if (objItemSet.Has_status == 'Y') {
                                                            objItem.STATUS = objItemSet.Status;
                                                        }
                                                        if (objItemSet.Has_processStatus == 'Y') {
                                                            objItem.PROCESS_STATUS = objItemSet.ProcessStatus;
                                                        }
                                                        objItem.PRCT_ID = objLogInfo.PROCESS_INFO.PRCT_ID;
                                                        kCount++;
                                                        if (kCount >= arrItems.length) {
                                                            if (j < arrFromClient.length) {
                                                                await arrFromClientLoop(arrFromClient[j]);
                                                            } else {
                                                                objItem = null;
                                                                objTSitem = null;
                                                                objItemSet = null;
                                                                afterLoopEnd();
                                                            }
                                                        }
                                                    }
                                                }
                                            } else {
                                                objItemSet = null;
                                                arrItems = null;
                                                arrPwdCtrls = null;
                                                arrDecCtrls = null;
                                                arrItems = null;
                                                kCount = null;
                                                objItem = null;
                                                objTSitem = null;
                                                objItemSet = null;
                                                objDTInfo = null;
                                                strDTDesc = null;
                                                strResult = null;
                                                strUserid = null;
                                                strSystemid = null;
                                                strDTCode = null;
                                                strDTTCode = null;
                                                strAPPId = null;
                                                intKeyValue = null;
                                                intTsId = null;
                                                strLoginName = null;
                                                strSystemDesc = null;
                                                releaseLock = null;
                                                strDTDesc = null;
                                                arrFromClient = null;
                                                objDTTRelation = null;
                                                isTenantIdavail = null;
                                                isappIdavail = null;
                                                return callback(null, null, 'save failure check multiselectcbo, items and meta data');
                                            }
                                        }

                                        function afterLoopEnd() {
                                            try {
                                                reqInstanceHelper.PrintInfo(serviceName, 'Prepared data for insert.', objLogInfo);
                                                if (objDTTRelation.length) {
                                                    for (var i = 0; i < objDTTRelation.length; i++) {
                                                        var objDTTR = objDTTRelation[i];
                                                        var itemSet = new reqLinq(arrFromClient)
                                                            .Where(function (pIts) {
                                                                return pIts.DTT_Code == objDTTR.DTT_CODE;
                                                            })
                                                            .FirstOrDefault();
                                                        if (!itemSet) {
                                                            reqCommon.DoFilterRecursiveArr(objDTTRelation, arrFromClient[0].DTT_Code, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (cItemSet) {
                                                                try {
                                                                    itemSet = new reqLinq(arrFromClient)
                                                                        .Where(function (pIts) {
                                                                            return pIts.DTT_Code == cItemSet.DTT_CODE;
                                                                        })
                                                                        .FirstOrDefault();
                                                                    objDTTR = cItemSet;
                                                                } catch (error) {
                                                                    return callback(prepareErrorData(error, 'ERR-TRX-100038', 'Error in reqCommon.DoFilterRecursiveArr callback'));
                                                                }
                                                            });
                                                        }
                                                        if (itemSet && itemSet.Items) {
                                                            i = objDTTRelation.length;
                                                            for (var itm = 0; itm < itemSet.Items.length; itm++) {
                                                                if (isTenantIdavail) {
                                                                    itemSet.Items[itm]["TENANT_ID"] = objLogInfo.TENANT_ID;
                                                                }
                                                                if (isappIdavail) {
                                                                    itemSet.Items[itm]["APP_ID"] = objLogInfo.APP_ID;
                                                                }
                                                            }
                                                            reqInstanceHelper.PrintInfo(serviceName, 'saveSet Begin', objLogInfo);
                                                            saveSet(itemSet, pSession, objDTTR, arrFromClient, strResult, insertedArr, releaseLock, objLogInfo, function (pResult, newItemSet) { //ist[0] first or default select first
                                                                try {
                                                                    reqInstanceHelper.PrintInfo(serviceName, 'saveSet End', objLogInfo);
                                                                    if (pResult && pResult.STATUS == 'SUCCESS') {
                                                                        reqTranDBInstance.Commit(pSession, true, function callbackres(res) {
                                                                            // Call communication mail service (asynchrounous)
                                                                            SendMail(itemSet.Items, itemSet.Key_Column, objLogInfo);
                                                                            var ClearCache = pRequest.CLEAR_CACHE;
                                                                            reqInstanceHelper.PrintInfo(serviceName, ClearCache ? 'Cache Type |' + ClearCache : " Cache not available", objLogInfo);
                                                                            if (ClearCache) {
                                                                                reqInstanceHelper.PrintInfo(serviceName, 'Clear cache setup available. Calling clearRedisCache asynchronously', objLogInfo);
                                                                                clearRedisCache(ClearCache);
                                                                            }
                                                                            // ClearCache = null;
                                                                            newItemSet = null;
                                                                            objDTTR = null;
                                                                            itemSet = null;
                                                                            arrFromClient = null;
                                                                            insertedArr = null;
                                                                            pRequest = null;
                                                                            pHeaders = null;

                                                                            return callback(null, pResult);
                                                                        });
                                                                    } else {
                                                                        reqTranDBInstance.Commit(pSession, false, function callbackres(res) {
                                                                            return callback(pResult);
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    objDTTR = null;
                                                                    itemSet = null;
                                                                    return callback(prepareErrorData(error, 'ERR-TRX-100039', 'Error in saveSet callback'));
                                                                }
                                                            });
                                                        }
                                                    }
                                                } else {
                                                    objDTTRelation = null;
                                                    return callback(null, null, 'Entity relation json not found');
                                                }
                                            } catch (error) {
                                                objDTTR = null;
                                                itemSet = null;
                                                objDTTRelation = null;
                                                return callback(prepareErrorData(error, 'ERR-TRX-100041', 'Error in afterLoopEnd function'));
                                            }
                                        }
                                    } catch (error) {
                                        objDTInfo = null;
                                        strDTDesc = null;
                                        strResult = null;
                                        strUserid = null;
                                        strSystemid = null;
                                        strDTCode = null;
                                        strDTTCode = null;
                                        strAPPId = null;
                                        intKeyValue = null;
                                        intTsId = null;
                                        strLoginName = null;
                                        strSystemDesc = null;
                                        releaseLock = null;
                                        strDTDesc = null;
                                        arrFromClient = null;
                                        objDTTRelation = null;
                                        isTenantIdavail = null;
                                        isappIdavail = null;
                                        return callback(prepareErrorData(error, 'ERR-TRX-100042', 'Error in reqDBInstance.GetTableFromFXDB callback'));
                                    }
                                });
                            } catch (error) {

                                strDTDesc = null;
                                strResult = null;
                                strUserid = null;
                                strSystemid = null;
                                strDTCode = null;
                                strDTTCode = null;
                                strAPPId = null;
                                intKeyValue = null;
                                intTsId = null;
                                strLoginName = null;
                                strSystemDesc = null;
                                releaseLock = null;
                                strDTDesc = null;
                                arrFromClient = null;
                                objDTTRelation = null;
                                isTenantIdavail = null;
                                isappIdavail = null;
                                return callback(prepareErrorData(error, 'Error Code', 'Catch Error in GetProcessToken function'));
                            }
                        });

                    } catch (error) {
                        return callback(prepareErrorData(error, 'ERR-TRX-100040', 'Error in reqTranDBInstance.GetTranDBConn callback'));
                    }
                });
            } catch (error) {
                return callback(prepareErrorData(error, 'ERR-TRX-100013', 'Error in reqDBInstance.GetFXDBConnection callback'));
            }
        });
    } catch (error) {
        return callback(prepareErrorData(error, 'ERR-TRX-100012', 'Error in saveTransaction function'));
    }

    // Call send mail core function for saved data
    function SendMail(pItems, pKeyColumn, objLogInfo) {
        try {
            var arrATMTData = [];
            for (var i = 0; i < pItems.length; i++) {
                var item = pItems[i];
                var objData = {};
                objData.dt_code = item.DT_CODE;
                objData.dtt_code = item.DTT_CODE;
                objData.trn_id = item[pKeyColumn];
                arrATMTData.push(objData);
            }
            objData = null;
            item = null;
            reqInstanceHelper.PrintInfo(serviceName, 'Calling send mail asyncronusly');
            reqSendMessage.SendMailFromAction(pRequest, pHeaders, arrATMTData, objLogInfo);
        } catch (error) {
            objData = null;
            item = null;
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100011', 'Error in SendMail function', error);
            return callback(prepareErrorData(error, 'ERR-TRX-100011', 'Error in SendMail function'));
        }
    }


    function clearRedisCache(clearMode) {
        try {
            reqCacheRedisInstance.GetRedisConnection(pHeaders, function (pRedisClient) {
                reqInstanceHelper.PrintInfo(serviceName, 'Cache type | ' + clearMode, objLogInfo);
                if (clearMode == 'ALL') {
                    doClearCache();
                } else if (clearMode == 'META') {
                    doClearCache('db0');
                } else if (clearMode == 'TRAN') {
                    doClearCache('db1');
                }

                function doClearCache(db) {
                    reqCacheRedisInstance.ClearCache(pHeaders, {
                        db: db,
                        clearAll: (db ? false : true)
                    }, objLogInfo, function (result) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, 'Clear cache Result ' + result, objLogInfo);
                        } catch (error) {
                            reqInstanceHelper.PrintInfo(serviceName, 'Clear cache Exception occured  ' + error, objLogInfo);
                        }
                    });
                }
            });
        } catch (error) {
            reqInstanceHelper.PrintInfo(serviceName, 'Clear cache Exception occured  ' + error, objLogInfo);
        }
    }

}

// This will return grpid
function getGRPID(pTsId, pAppId, pHeaders, objLogInfo, callback) {
    try {
        // return new Promise((resolve, reject) => {

        var strGrpId = '';
        if (pTsId > 0) {
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                try {
                    var objCond = new Object();
                    objCond['TS_ID'] = pTsId;
                    reqTranDBInstance.GetTableFromTranDB(pSession, 'TRANSACTION_SET', objCond, objLogInfo, function (pResultFromDb, error) {
                        try {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100010', 'Error in reqTranDBInstance.GetTableFromTranDB callback', error);
                                return callback(error);
                            } else {

                                if (pResultFromDb.length) {
                                    pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb, objLogInfo);
                                    var objItem = pResultFromDb[0];
                                    strGrpId = objItem['GROUP_ID'];
                                    return callback(strGrpId);
                                    // resolve(strGrpId);
                                }
                                objItem = null;
                            }
                            objCond = null;

                        } catch (error) {
                            objItem = null;
                            objCond = null;
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100009', 'Error in reqTranDBInstance.GetTableFromTranDB callback', error);
                            return callback(error);
                        }
                    });
                } catch (error) {
                    objCond = null;
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100008', 'Error in reqTranDBInstance.GetTranDBConn callback', error);
                    return callback(error);
                }
            });
        }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100007', 'Error in getGRPID function', error);
        return callback(error);
    }
}

// This will assign parant ids
function assignParentIds(pSets, pDTT, pValue, pParentTsId, pDTTR, pChild, objLogInfo) {
    try {
        if (pDTTR) {
            var objItemSet = new reqLinq(pSets)
                .Where(function (iset) {
                    return iset.DTT_Code == pDTTR.DTT_CODE;
                })
                .FirstOrDefault();
            if (objItemSet) {
                var arrItems = objItemSet.Items;
                for (var i = 0; i < arrItems.length; i++) {
                    var objItem = arrItems[i];
                    if (!pChild) {
                        if (objItem[pDTTR.PRIMARY_COLUMN]) {
                            objItem.Key_Value = objItem[pDTTR.PRIMARY_COLUMN];
                        } else {
                            objItem.Key_Value = pValue;
                            objItem[pDTTR.PRIMARY_COLUMN] = pValue;
                        }
                    } else {
                        if (objItem[pDTTR.PRIMARY_COLUMN]) {
                            objItem.Key_Value = objItem[pDTTR.PRIMARY_COLUMN];
                        }
                        if (!objItem[pDTTR.FOREIGN_COLUMN] || objItem[pDTTR.FOREIGN_COLUMN] == 0) {
                            objItem[pDTTR.FOREIGN_COLUMN] = pValue;
                            var objTs = {};
                            if (objItem.TS) {
                                objTs = objItem.TS;
                            }
                            objTs.PARENT_TS_ID = pParentTsId;
                            objItem.TS = objTs;
                        }
                    }
                }
                objItem = null;
                arrItems = null;
            }
        }
    } catch (error) {
        objItem = null;
        arrItems = null;
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100006', 'Error in assignParentIds function', error);
    }
}

// Assign new values to the array object
function assignNewValues(arrItemKeys, existingItem, newItem, primaryCol, objLogInfo) {
    try {
        for (var l = 0; l < arrItemKeys.length; l++) {
            var strKey = arrItemKeys[l].toUpperCase();
            var isItemKey = ((existingItem.hasOwnProperty(strKey)) && primaryCol != strKey);
            if (isItemKey) {
                existingItem[strKey] = newItem[strKey];
            }
        }
        strKey = null;
        isItemKey = null;
        return existingItem;
    } catch (error) {
        strKey = null;
        isItemKey = null;
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-TRX-100005', 'Error in assignNewValues function', error);
        return error;
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
    SaveTransaction: saveTransaction,
    FinishApiCall: finishApiCall
};
/******** End of File *******/