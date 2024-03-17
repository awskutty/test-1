/**
 * Description :  To save the transaction data to solr DYNAMIC_CORE
 */

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var util = require('util');
var reqMoment = require('moment');
var reqSolrAdmin = require('./SolrAdmin');
var reqTranDBInstance = require('../../../instance/TranDBInstance');
var reqDBInstance = require('../../../instance/DBInstance');
var reqInstanceHelper = require('../../InstanceHelper');


var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
var coreName = 'DYNAMIC_CORE';
if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
    coreName = 'TRAN';
}
// Global variable declaration

var mHeaders = {};
var objLogInfo = null;
var serviceName = 'SaveTranToSolar';

var isProcessing = false;
var processData = [];

// this returns true or false for need solr
function NeedSolrIndex(pClient, strAppId, pDTTCode, callback) {
    try {
        //reqCassandraInstance.GetCassandraConn(mHeaders, 'dep_cas', function (depClient) {
        var cond = new Object();
        cond.APP_ID = strAppId;
        cond.DTT_CODE = pDTTCode;
        //pClient.execute(SEL_SOLR_INDEX, [strAppId, pDTTCode], { prepare: true }, function (error, result) {
        reqDBInstance.GetTableFromFXDB(pClient, 'DTT_INFO', ['need_solr_index'], cond, objLogInfo, function (error, result) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
            } else {
                try {
                    var needSolr = false;
                    if (result.rows[0]) {
                        var dttInfo = result.rows[0];
                        if (dttInfo.need_solr_index == 'Y') {
                            needSolr = true;
                        }
                    }
                    return callback(needSolr);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                }
            }
        });
        //});
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, error, '', null);
    }
}

// this initiate solr insert for transaction
function tranIndex(pJson, pObjLogInfo, callback) {
    try {
        if (pObjLogInfo) {
            objLogInfo = pObjLogInfo;
        }
        processData.push(pJson);
        if (!isProcessing) {
            if (processData.length) {
                processMessage(processData.shift());
            } else {
                isProcessing = false;
            }
        }
        function processMessage(msg) {
            isProcessing = true;
            var strAppId = msg.AppId;
            var objRelation = msg.Relation;
            var strDttCode = objRelation.DTT_CODE;
            mHeaders = msg.headers;
            reqDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', null, function (pClient) {
                try {
                    NeedSolrIndex(pClient, strAppId, strDttCode, function (NeedSolr) {
                        try {
                            if (NeedSolr) {
                                var objHList = msg.TranData;
                                if (objHList) {
                                    //reqTranDBInstance.GetTranDBConn(strAppId, function (pSession) {
                                    try {
                                        var objItems = objHList.Items;
                                        reqTranDBInstance.GetTranDBConn(mHeaders, false, function (pSession) {
                                            try {
                                                //var session = pJson.Session;
                                                var arrInsertItems = new reqLinq(objItems)
                                                    .Where(function (item) {
                                                        return item.Key_Value == 0;
                                                    })
                                                    .ToArray();

                                                var arrUpdateItems = new reqLinq(objItems)
                                                    .Where(function (item) {
                                                        return item.Key_Value != 0;
                                                    })
                                                    .ToArray();
                                                getIndexingColumns(pClient, objRelation, strAppId, function (pIndexCols) {
                                                    try {
                                                        var strKeyColumn = objHList.Key_Column.toString();
                                                        var arrIndexLists = [];
                                                        var objRow = null;
                                                        var objCol = null;
                                                        var objNewRow = null;
                                                        var intKeyVal = 0;
                                                        if (strKeyColumn == "") {
                                                            strKeyColumn = objRelation.PRIMARY_COLUMN.toString();
                                                        }
                                                        if (!(Object.keys(pIndexCols)).length) {
                                                            console.log('No Index Columns');
                                                            if (processData.length) {
                                                                return processMessage(processData.shift());
                                                            } else {
                                                                isProcessing = false;
                                                            }
                                                            return callback("SUCCESS");
                                                        }
                                                        if (arrInsertItems && arrInsertItems.length) {
                                                            arrIndexLists = [];
                                                            for (var i = 0; i < arrInsertItems.length; i++) {
                                                                objRow = arrInsertItems[i];
                                                                intKeyVal = 0;
                                                                objNewRow = new Object();
                                                                var arrIndexColKeys = Object.keys(pIndexCols);
                                                                for (var j = 0; j < arrIndexColKeys.length; j++) {
                                                                    objCol = arrIndexColKeys[j];
                                                                    if (objCol in objRow) {
                                                                        objNewRow[objCol] = objRow[objCol] ? objRow[objCol] : '';
                                                                        if (pIndexCols[objCol] == 'DATETIME') {
                                                                            if (objNewRow[objCol]) {
                                                                                objNewRow[objCol] = reqMoment(new Date(objNewRow[objCol])).format('YYYY-MM-DD HH:mm:ss');
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                                if (!('DT_CODE' in objNewRow)) {
                                                                    objNewRow.DT_CODE = objHList.DT_Code;
                                                                }
                                                                if (!('DTT_CODE' in objNewRow)) {
                                                                    objNewRow.DTT_CODE = objHList.DTT_Code;
                                                                }
                                                                if (strKeyColumn in objRow) {
                                                                    intKeyVal = objRow[strKeyColumn];
                                                                }
                                                                // if (!('TRN_ID' in objNewRow)) {
                                                                //     objNewRow.TRN_ID = intKeyVal;
                                                                // }
                                                                if (!objNewRow.TRN_ID) {
                                                                    objNewRow.TRN_ID = intKeyVal;
                                                                }
                                                                else if (typeof objNewRow.TRN_ID == 'string') {
                                                                    objNewRow.STR_TRN_ID = objNewRow.TRN_ID;
                                                                    objNewRow.TRN_ID = intKeyVal;
                                                                }
                                                                _AddStaticColumn(objRow, objNewRow, true);
                                                                arrIndexLists.push(objNewRow);
                                                            }
                                                            insertDataIndex(arrIndexLists, pSession, function (pResult) {
                                                                if (processData.length) {
                                                                    return processMessage(processData.shift());
                                                                } else {
                                                                    isProcessing = false;
                                                                }
                                                                return callback(pResult);
                                                            });
                                                        }
                                                        if (arrUpdateItems && arrUpdateItems.length) {
                                                            arrIndexLists = [];
                                                            for (var k = 0; k < arrUpdateItems.length; k++) {
                                                                objRow = arrUpdateItems[k];
                                                                intKeyVal = 0;
                                                                objNewRow = new Object();
                                                                var IndexColsKeys = Object.keys(pIndexCols);
                                                                for (var l = 0; l < IndexColsKeys.length; l++) {
                                                                    objCol = IndexColsKeys[l];
                                                                    if (objCol in objRow) {
                                                                        objNewRow[objCol] = objRow[objCol] ? objRow[objCol] : '';
                                                                    }
                                                                }
                                                                if ('DT_CODE' in objRow) {
                                                                    objRow.DT_CODE = objHList.DT_Code;
                                                                }
                                                                if ('DTT_CODE' in objRow) {
                                                                    objRow.DTT_CODE = objHList.DTT_Code;
                                                                }
                                                                if (strKeyColumn in objRow) {
                                                                    intKeyVal = objRow[strKeyColumn]; //dRow.Item[KeyColumn];
                                                                }
                                                                // if (!('TRN_ID' in objNewRow)) {
                                                                //     objNewRow.TRN_ID = intKeyVal;
                                                                // }
                                                                if (!objNewRow.TRN_ID) {
                                                                    objNewRow.TRN_ID = intKeyVal;
                                                                } else if (typeof objNewRow.TRN_ID == 'string') {
                                                                    objNewRow.STR_TRN_ID = objNewRow.TRN_ID;
                                                                    objNewRow.TRN_ID = intKeyVal;
                                                                }
                                                                _AddStaticColumn(objRow, objNewRow, false);
                                                                arrIndexLists.push(objNewRow);
                                                            }
                                                            updateDataIndex(arrIndexLists, pSession, function (pResult) {
                                                                if (processData.length) {
                                                                    return processMessage(processData.shift());
                                                                } else {
                                                                    isProcessing = false;
                                                                }
                                                                return callback(pResult);
                                                            });
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                                                    }
                                                });
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                                    }
                                    //});
                                } else {
                                    console.log("No TranData found.");
                                    if (processData.length) {
                                        return processMessage(processData.shift());
                                    } else {
                                        isProcessing = false;
                                    }
                                    return callback("SUCCESS"); // change it (ask is it correct?)
                                }
                            } else {
                                console.log(" No need solr indexing for '" + strDttCode + "'");
                                if (processData.length) {
                                    return processMessage(processData.shift());
                                } else {
                                    isProcessing = false;
                                }
                                return callback("SUCCESS");
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
    }
}

// Add the audit columns to new row
function _AddStaticColumn(pItem, pNewRow, pBlnSave) {
    if (pBlnSave) {
        if ('CREATED_BY' in pItem)
            pNewRow.CREATED_BY = pItem['CREATED_BY'];
        if ('CREATED_DATE' in pItem)
            pNewRow.CREATED_DATE = reqMoment(new Date(pItem['CREATED_DATE'])).format('YYYY-MM-DD HH:mm:ss');
        if ('CREATED_BY_NAME' in pItem)
            pNewRow.CREATED_BY_NAME = pItem['CREATED_BY_NAME'];
    } else {
        if ('MODIFIED_BY' in pItem)
            pNewRow.MODIFIED_BY = pItem['MODIFIED_BY'];
        if ('MODIFIED_DATE' in pItem)
            pNewRow.MODIFIED_DATE = reqMoment(new Date(pItem['MODIFIED_DATE'])).format('YYYY-MM-DD HH:mm:ss');
        if ('MODIFIED_BY_NAME' in pItem)
            pNewRow.MODIFIED_BY_NAME = pItem['MODIFIED_BY_NAME'];
    }
    if ('SYSTEM_NAME' in pItem) {
        pNewRow.SYSTEM_NAME = pItem['SYSTEM_NAME'];
    }
    if ('SYSTEM_ID' in pItem) {
        pNewRow.SYSTEM_ID = pItem['SYSTEM_ID'];
    }
    if ('STATUS' in pItem) {
        pNewRow.STATUS = pItem['STATUS'];
    }
    if ('PROCESS_STATUS' in pItem) {
        pNewRow.PROCESS_STATUS = pItem['PROCESS_STATUS'];
    }
    if ('DT_DESCRIPTION' in pItem) {
        pNewRow.DT_DESCRIPTION = pItem['DT_DESCRIPTION'];
    }
    if ('DTT_DESCRIPTION' in pItem) {
        pNewRow.DTT_DESCRIPTION = pItem['DTT_DESCRIPTION'];
    }
}

// this is for solr update by indexed column 
function updateDataIndex(pIndexList, pSession, callback) {
    try {
        for (var i = 0; i < pIndexList.length; i++) {
            var objRow = pIndexList[i];
            //var TSID = 0;
            _GetTSId(pSession, objRow, function callbackGetTSId(pTSID, pObjRow) {
                getDocumentFromId(pTSID, pObjRow, function (pDoc, pRow) {
                    try {
                        if (pDoc && pDoc['id'] && pDoc['id']) {
                            pRow.id = pDoc['id'];
                        } else {
                            pRow.id = "";
                        }

                        insertIndex([pRow], function (pResult) {
                            return callback(pResult);
                        });
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                    }
                });
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
    }
}

// Get the TS Id from DB for trn_id and dtt_code condition
function _GetTSId(pSession, objRow, pCallback) {
    var TSID = 0;
    if ('TS_ID' in objRow) {
        if (objRow.TS_ID || parseInt(objRow.TS_ID) == 0) {
            _GetTSIdFromDB(pSession, {
                TRN_ID: objRow.TRN_ID,
                DTT_CODE: objRow.DTT_CODE
            }, function callbackTsIS(pTsId) {
                TSID = pTsId;
                objRow.TS_ID = pTSID;
                pCallback(TSID, objRow);
            });
        } else {
            TSID = objRow.TS_ID;
            pCallback(TSID, objRow);
        }
    } else {
        _GetTSIdFromDB(pSession, {
            TRN_ID: objRow.TRN_ID,
            DTT_CODE: objRow.DTT_CODE
        }, function callbackTsIS(pTsId) {
            TSID = pTsId;
            objRow.TS_ID = TSID;
            pCallback(TSID, objRow);
        });
    }
}

// Query transcation set for ts_id
function _GetTSIdFromDB(pSession, objCond, pCallback) {
    var TSID = 0;
    reqTranDBInstance.GetTableFromTranDB(pSession, 'TRANSACTION_SET', objCond, null, function (pResultFromDb) {
        try {
            if (pResultFromDb) {
                pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb);
            }
            var arrTranSet = pResultFromDb;
            if (arrTranSet && arrTranSet.length && arrTranSet[0].TS_ID) {

                TSID = arrTranSet[0].TS_ID;
            } else {
                console.log('error');
            }
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
        }
        pCallback(TSID);
    });
}

// this is for solr insert by indexed column
function insertDataIndex(pIndexList, pSession, callback) {
    try {
        const strFieldQuery = "select * from solr_dtt_fields where app_id = ? and core_name = ? and field_name = ?";
        for (var i = 0; i < pIndexList.length; i++) {
            var objRow = pIndexList[i];
            var TSID = 0;
            if ('TRN_ID' in objRow) {
                // var objTableSelectDetails = new Object();
                // var arrConditions = [];
                // arrConditions.push({ column: 'TRN_ID', value: objRow.TRN_ID });
                // arrConditions.push({ column: 'DTT_CODE', value: objRow.DTT_CODE });
                // objTableSelectDetails.tableName = 'TRANSACTION_SET';
                // objTableSelectDetails.conditions = arrConditions;
                var objCond = new Object();
                objCond['TRN_ID'] = objRow.TRN_ID;
                objCond['DTT_CODE'] = objRow.DTT_CODE;
                reqTranDBInstance.GetTableFromTranDB(pSession, 'TRANSACTION_SET', objCond, objLogInfo, function (pResultFromDb) {
                    try {
                        pResultFromDb = reqInstanceHelper.ArrKeyToUpperCase(pResultFromDb);
                        var arrTranSet = pResultFromDb;
                        if (arrTranSet && arrTranSet.length && arrTranSet[0].TS_ID) {
                            TSID = arrTranSet[0].TS_ID;
                        }
                        objRow.TS_ID = TSID;
                        insertIndex(pIndexList, function (pResult) {
                            return callback(pResult);
                        });
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                    }
                });
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
    }
}

// this will call solr insert with solr admin 
function insertIndex(pIndexList, callback) {
    try {
        var content = {};
        for (var i = 0; i < pIndexList.length; i++) {
            var objRow = pIndexList[i];
            var arrObjRowKeys = Object.keys(objRow);
            for (var j = 0; j < arrObjRowKeys.length; j++) {
                var objCol = arrObjRowKeys[j];
                if (objCol.toString().toUpperCase() == "ID" && objRow[objCol] == "") {
                    continue;
                }
                if (util.isDate(objRow[objCol])) {
                    var strDate = '';
                    var dtVal = Date.parse(objRow[objCol]);
                    strDate = dtVal.toString();
                    strDate = strDate + "Z";
                    content[objCol] = strDate;
                } else {
                    content[objCol] = objRow[objCol];
                }
            }
        }
        // This is to Insert the String type TRN ID in to the Dynamic Solr Core
        if (content.STR_TRN_ID) {
            content.TRN_ID = content.STR_TRN_ID;
            delete content.STR_TRN_ID;
        }
        console.log(JSON.stringify(content), 'Dynamic Core Content');
        reqSolrAdmin.InsertToSolr(content, coreName, mHeaders, function (pResult) {
            console.log('Core Insert Status - ' + pResult);
            return callback(pResult);
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
    }
}

// this is for select indexed column
function getIndexingColumns(pClient, pRelation, strAppId, callback) {
    try {
        var objResultCols = new Object();
        const strQuery = "select dtt_dfd_json from dtt_info where app_id = ? and dtt_code = ?";
        //reqCassandraInstance.GetCassandraConn(mHeaders, 'dep_cas', function (depClient) {
        var cond = new Object();
        cond.APP_ID = strAppId;
        cond.DTT_CODE = pRelation.DTT_CODE;
        //pClient.execute(strQuery, [strAppId, pRelation.DTT_CODE], { prepare: true }, function (error, result) {
        reqDBInstance.GetTableFromFXDB(pClient, 'DTT_INFO', ['dtt_dfd_json'], cond, objLogInfo, function (error, result) {
            if (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, error.stack, '', null);
            } else {
                try {
                    var objTable = result.rows[0];
                    if (objTable) {
                        if (objTable.dtt_dfd_json) {
                            var strJSON = objTable.dtt_dfd_json;
                            strJSON = strJSON.toString().replace(/\\/g, '');
                            var objDttDfdJson = JSON.parse(strJSON);
                            var arrDataFormates = objDttDfdJson.DATA_FORMATS;
                            for (var i = 0; i < arrDataFormates.length; i++) {
                                var objDF = arrDataFormates[i];
                                if (objDF.DF_DETAILS) {
                                    var arrDFDetails = objDF.DF_DETAILS;
                                    for (var j = 0; j < arrDFDetails.length; j++) {
                                        var objDFD = arrDFDetails[j];
                                        // if (objDFD.DF_SEARCH && objDFD.TARGET_COLUMN != '') {
                                        //     objResultCols[objDFD.TARGET_COLUMN] = objDFD.DATA_TYPE;
                                        // }
                                        if (objDFD.DF_SEARCH && objDFD.DF_SEARCH.BINDING_NAME && objDFD.DF_SEARCH.BINDING_NAME != "" && objDFD.TARGET_COLUMN != "") {
                                            objResultCols[objDFD.TARGET_COLUMN] = objDFD.DATA_TYPE;
                                        }
                                    }
                                }
                            }
                            if ((Object.keys(objResultCols)).length) {
                                objResultCols.TS_ID = "NUMBER";
                                objResultCols.TRN_ID = "NUMBER";
                                objResultCols.DT_CODE = "TEXT";
                                objResultCols.DTT_CODE = "TEXT";
                            }
                            return callback(objResultCols);
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                }
            }
        });
        //});
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
    }
}

// this is not yet completed
function getDocumentFromId(pTSID, pRow, callback) {
    try {
        if (pTSID == 0) {
            //return callback(null, pRow);
            reqInstanceHelper.PrintInfo(serviceName, 'Quering Solr With TRN_ID and DTT_CODE', objLogInfo);
            reqSolrAdmin.GetFilteredDocuments(mHeaders, coreName, {
                TRN_ID: pRow.TRN_ID,
                DTT_CODE: pRow.DTT_CODE
            }, function (SolrDocs) {
                try {
                    if (SolrDocs) {
                        return callback(SolrDocs.response.docs[0], pRow);
                    } else {
                        return callback(null, pRow);
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                }
            });
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'Quering Solr With TS_ID', objLogInfo);
            reqSolrAdmin.GetFilteredDocuments(mHeaders, coreName, {
                TS_ID: pTSID
            }, function (SolrDocs) {
                try {
                    if (SolrDocs) {
                        return callback(SolrDocs.response.docs[0], pRow);
                    } else {
                        return callback(null, pRow);
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, error, '', null);
    }
}

module.exports = {
    TranIndex: tranIndex
};
/********* End of File *************/