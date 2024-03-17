/****
 * Api_Name          : /DeleteItem
 * Description       : To delete the transaction data with the related attachment
 * Lase_Error_Code   : ERR-HAN-40340
 ****/

// Require dependencies
var reqExpress = require('express');
var reqAsync = require('async');
var reqLinq = require('node-linq').LINQ;
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqSrvHlpr = require('./ServiceHelper/ServiceHelper');
var reqSolrHelper = require('../../../../../torus-references/instance/SolrInstance');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var router = reqExpress.Router();

// Host api to Delete Item 
router.post('/ext/DeleteItem', function (appRequest, appResponse) {
    try {
        // Assign LogInfo values from appRequest and SessionValue , Insert Event Info 
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
            var objLogInfo = pLogInfo;
            var mTranDB;

            objLogInfo.HANDLER_CODE = 'DELETE_TRAN';

            // Close event when client closes the api request
            appResponse.on('close', function () {
                reqTranDBHelper.CallRollback(mTranDB);
                reqLogWriter.EventUpdate(objLogInfo);
            });
            appResponse.on('finish', function () {
                reqTranDBHelper.CallRollback(mTranDB);
            });
            appResponse.on('end', function () {
                reqTranDBHelper.CallRollback(mTranDB);
            });

            // Global variable declaration
            var strWftpaId = '';
            var strTokenId = '';
            var strAppId = '';
            var strUId = '';
            var strDTCode = '';
            var strLoginName = '';
            var strJsonDataSet = '';
            var arrTMPPI = [];
            var strResult = 'Success';
            var strInputParam = appRequest.body.PARAMS;
            var strReqHeader = appRequest.headers;
            var mDepCas;
            var DBType;
            var mOrm = 'knex';
            var objRelation = '';

            try {
                _PrintInfo("Begin");

                // Initialize DB
                _InitializeTrnDB(strReqHeader, function callbackInitializeDB(pStatus) {

                    // Initialize params
                    _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pStatusObj) {
                        try {
                            if (pStatusObj.Status == 'SUCCESS') {
                                //Prepare data
                                if (strJsonDataSet != '') {
                                    var arrSelRow = JSON.parse(strJsonDataSet);
                                    for (var i = 0; i < arrSelRow.length; i++) {
                                        var row = arrSelRow[i];
                                        var TempDT_CODE = '';
                                        var TempDTT_CODE = '';
                                        var TempITEMID = 0;
                                        var objRow = {}; //new reqHashTable()
                                        if (row['dt_code'] != undefined && row['dt_code'] != '')
                                            TempDT_CODE = row['dt_code'].toString();

                                        if (row['dtt_code'] != undefined && row['dtt_code'] != '')
                                            TempDTT_CODE = row['dtt_code'].toString();

                                        if (row['trn_id'] != undefined && row['trn_id'] != '')
                                            TempITEMID = parseInt(row['trn_id']);

                                        strDTCode = TempDT_CODE;
                                        objRow['DT_CODE'] = TempDT_CODE;
                                        objRow['DTT_CODE'] = TempDTT_CODE;
                                        objRow['ITEM_ID'] = TempITEMID;
                                        objRow['CREATED_BY'] = strUId;
                                        objRow['CREATED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                                        objRow['PRCT_ID'] = strTokenId;
                                        arrTMPPI.push(objRow);
                                    }
                                }

                                // Delete the Items
                                _DeleteItem(arrTMPPI, strDTCode, function callbackDeleteItem(pStatus) {
                                    _SendResponse(pStatus.Status, pStatus.ErrorCode, pStatus.ErrorMsg, pStatus.Error, pStatus.Warning);
                                });
                            } else { // Error in Initialize param
                                _SendResponse(pStatusObj.Status, pStatusObj.ErrorCode, pStatusObj.ErrorMsg, pStatusObj.Error, pStatusObj.Warning);
                            }
                        } catch (error) {
                            _SendResponse('FAILURE', 'ERR-HAN-40301', 'Error on DeleteItem ', error, null);
                        }
                    });
                });
            } catch (error) {
                _SendResponse(pStatus, 'ERR-HAN-40302', 'Error on DeleteItem API ', error, null);
            }

            // Delete item from TargetTable and ATMT table
            function _DeleteItem(pTMPPI, pDTCode, pCallback) {
                try {
                    // Get relation json
                    reqFXDBInstance.GetTableFromFXDB(mDepCas, 'DT_INFO', ['RELATION_JSON'], {
                        APP_ID: strAppId,
                        DT_CODE: pDTCode
                    }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                        if (pError)
                            _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40303', 'Error on querying DT_INFO table', pError, null, pCallback);
                        else {
                            try {
                                if (pResult.rows.length > 0) {
                                    var objRelationJson = JSON.parse(pResult.rows[0]['relation_json']);
                                    objRelation = objRelationJson;

                                    var delItmsLength = pTMPPI.length;
                                    var i = 0;
                                    if (delItmsLength) {
                                        deleteIt(pTMPPI[i]);
                                    }

                                    function deleteIt(pItem) {
                                        i++;
                                        var strItemId = pItem.ITEM_ID;
                                        var strDTCode = strInputParam.DT_CODE;//pItem.DT_CODE;
                                        var strDTTCode = strInputParam.DTT_CODE;//pItem.DTT_CODE;

                                        var strTemp = reqSrvHlpr.GetTargetTableAndKeyColumn(objRelationJson, strDTTCode, objLogInfo);
                                        if (strTemp.Status == 'SUCCESS') {
                                            var strDTTInfo = strTemp.Data.split(',');
                                            var strTargetTable = strDTTInfo[0];
                                            var strKeyColumn = strDTTInfo[1];
                                            var strDTTCategory = strDTTInfo[3];

                                            if (strItemId == 0 || strItemId == null || strItemId == undefined)
                                                strItemId = _FindKeyColumnValue(strKeyColumn, i - 1);

                                            switch (strDTTCategory) {
                                                case 'T':
                                                    // Delete Transaction category
                                                    _DeleteTransactionCategory(strTargetTable, strKeyColumn, strDTCode, strDTTCode, strItemId, function callbackDeleteTransactionCategory(pStatus) {
                                                        if (pStatus.Status == 'SUCCESS') {
                                                            if (i < delItmsLength) {
                                                                deleteIt(pTMPPI[i]);
                                                            } else {
                                                                return pCallback(pStatus);
                                                            }
                                                        } else
                                                            return pCallback(pStatus);

                                                    });
                                                    break;
                                                case 'M':
                                                    // Delete Master category
                                                    _DeleteMasterCategory(strTargetTable, strKeyColumn, strItemId, function callbackDeleteMasterCategory(pStatus) {
                                                        if (pStatus.Status == 'SUCCESS') {
                                                            if (i < delItmsLength) {
                                                                deleteIt(pTMPPI[i]);
                                                            } else {
                                                                return pCallback(pStatus);
                                                            }
                                                        } else
                                                            return pCallback(pStatus);
                                                    });
                                                    break;
                                            }
                                        } else { // Failure case in ketTaergettable and keycolumn
                                            pCallback(strTemp);
                                        }
                                    }
                                } else
                                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40304', '', null, 'DT_INFO not found', pCallback);
                            } catch (error) {
                                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40305', 'Error on _DeleteItem() function', error, null, pCallback);
                            }
                        }
                    });
                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40306', 'Error on _DeleteItem() function', error, null, pCallback);
                }
            }

            // Find keycolumn from selected transaction (JSON_DATASET)
            function _FindKeyColumnValue(pKeyColumn, pIndex) {
                var strItemId = '0';
                var objJsonData = JSON.parse(strJsonDataSet);
                Object.keys(objJsonData[pIndex]).forEach(function (key) {
                    if (key.toUpperCase() == pKeyColumn.toUpperCase()) {
                        strItemId = objJsonData[pIndex][key];
                    }
                });
                return strItemId;
            }

            // Delete Transaction category - DTT
            function _DeleteTransactionCategory(pTargetTable, pKeyColumn, pDTCode, pDTTCode, pItemId, pCallback) {
                try {
                    reqTranDBHelper.GetTableFromTranDB(mTranDB, 'TRANSACTION_SET', {
                        DT_CODE: pDTCode,
                        DTT_CODE: pDTTCode,
                        TRN_ID: pItemId
                    }, objLogInfo, function callbackGetTableFromTranDB(pResult, pError) {
                        var strLockedBy = '';
                        if (pError)
                            return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40307', 'Error on querying TRANSACTION_SET table', pError, null, pCallback);
                        else {
                            if (pResult.length > 0)
                                strLockedBy = pResult[0]['locked_by'];

                            if (strLockedBy == null || strLockedBy == undefined || strLockedBy == strUId || strLockedBy == '0' || strLockedBy == '') {
                                if (DBType == 'pg' || DBType == 'mysql') {
                                    var strQuery = "WITH RECURSIVE TRANLIST (DT_CODE,DTT_CODE,TS_ID,PARENT_TS_ID,TRN_ID,LOCKED_BY) AS  ( SELECT TS.DT_CODE, TS.DTT_CODE, TS.TS_ID, TS.PARENT_TS_ID, TS.TRN_ID, TS.LOCKED_BY FROM TRANSACTION_SET TS WHERE  DT_CODE='" + strDTCode + "' AND DTT_CODE ='" + pDTTCode + "' AND  TRN_ID IN ( " + pItemId + " )   UNION ALL  SELECT TS1.DT_CODE, TS1.DTT_CODE, TS1.TS_ID,TS1.PARENT_TS_ID, TS1.TRN_ID, TS1.LOCKED_BY FROM TRANLIST TL,TRANSACTION_SET TS1 WHERE TL.TS_ID=TS1.PARENT_TS_ID ) Select DT_CODE AS DT_CODE,DTT_CODE AS DTT_CODE, TS_ID AS TS_ID,PARENT_TS_ID AS PARENT_TS_ID ,TRN_ID as ITEM_ID,LOCKED_BY  AS LOCKED_BY from TRANLIST;";
                                } else {
                                    var strQuery = "SELECT TS.DT_CODE, TS.DTT_CODE, TS.TS_ID, TS.PARENT_TS_ID, TS.TRN_ID AS ITEM_ID, TS.LOCKED_BY from TRANSACTION_SET TS WHERE DT_CODE = '" + strDTCode + "' AND DTT_CODE ='" + pDTTCode + "' START WITH trn_id in ( " + pItemId + " ) " + " CONNECT BY PRIOR TS_ID = PARENT_TS_ID ORDER SIBLINGS BY TS_ID";
                                }

                                reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callback(pRes, pErr) {
                                    try {
                                        if (pErr)
                                            return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40308', 'Error on executing raw query', pErr, null, pCallback);
                                        else {
                                            var pRows = pRes;
                                            reqAsync.parallel({
                                                DeleteTargetTable: function (parCb) {
                                                    // Delete Targettable 
                                                    _DeleteTargetTable(pTargetTable, pKeyColumn, pRows, function callbackDeleteTranDB(pResult) {
                                                        parCb(null, pResult);
                                                    });
                                                },
                                                DeleteSolrIndex: function (parCb) {
                                                    // Delete solr index
                                                    _DeleteSolr(pRows, function callbackDeleteSolrIndex(pResult) {
                                                        parCb(null, pResult);
                                                    });
                                                },
                                                DeleteAttachment: function (parCb) {
                                                    // Delete Attachment
                                                    _DeleteAttachment(pRows, function callbackDeleteAttachment(pResult) {
                                                        parCb(null, pResult);
                                                    });
                                                },
                                                DeleteComment: function (parCb) {
                                                    // Delete Attachment
                                                    _DeleteComment(pRows, function callbackDeleteComment(pResult) {
                                                        parCb(null, pResult);
                                                    });
                                                },
                                                DeleteTransactionSet: function (parCb) {
                                                    // Delete Transaction Set
                                                    _DeleteTransactionSet(pRows, function callbackDeleteTransactionSet(pResult) {
                                                        parCb(null, pResult);
                                                    });
                                                }
                                            },
                                                function (err, results) {
                                                    //Results are all ready, containing the results of two different queries
                                                    if (results.DeleteTargetTable.Status == 'SUCCESS' && results.DeleteSolrIndex.Status == 'SUCCESS' && results.DeleteAttachment.Status == 'SUCCESS' && results.DeleteComment.Status == 'SUCCESS' && results.DeleteTransactionSet.Status == 'SUCCESS')
                                                        return _PrepareAndSendCallback('SUCCESS', null, null, null, null, pCallback);
                                                    else { // failure case if anyone from async parallel
                                                        if (results.DeleteTargetTable.Status == 'FAILURE')
                                                            return _PrepareAndSendCallback(results.DeleteTargetTable.Status, results.DeleteTargetTable.ErrorCode, results.DeleteTargetTable.ErrorMsg, results.DeleteTargetTable.Error, results.DeleteTargetTable.Warning, pCallback);
                                                        else if (results.DeleteSolrIndex.Status == 'FAILURE')
                                                            return _PrepareAndSendCallback(results.DeleteSolrIndex.Status, results.DeleteSolrIndex.ErrorCode, results.DeleteSolrIndex.ErrorMsg, results.DeleteSolrIndex.Error, results.DeleteSolrIndex.Warning, pCallback);
                                                        else if (results.DeleteAttachment.Status == 'FAILURE')
                                                            return _PrepareAndSendCallback(results.DeleteAttachment.Status, results.DeleteAttachment.ErrorCode, results.DeleteAttachment.ErrorMsg, results.DeleteAttachment.Error, results.DeleteAttachment.Warning, pCallback);
                                                        else if (results.DeleteComment.Status == 'FAILURE')
                                                            return _PrepareAndSendCallback(results.DeleteComment.Status, results.DeleteComment.ErrorCode, results.DeleteComment.ErrorMsg, results.DeleteComment.Error, results.DeleteComment.Warning, pCallback);
                                                        else if (results.DeleteTransactionSet.Status == 'FAILURE')
                                                            return _PrepareAndSendCallback(results.DeleteTransactionSet.Status, results.DeleteTransactionSet.ErrorCode, results.DeleteTransactionSet.ErrorMsg, results.DeleteTransactionSet.Error, results.DeleteTransactionSet.Warning, pCallback);
                                                    }
                                                });
                                        }
                                    } catch (error) {
                                        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40309', 'Error on _DeleteTransactionCategory() function', error, null, pCallback);
                                    }
                                });
                            } else {
                                return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40310', null, null, 'Already locked by another user', pCallback);
                            }
                        }
                    });
                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40311', 'Error on _DeleteTransactionCategory() function', error, null, pCallback);
                }
            }

            // Delete Master category - DTT
            function _DeleteMasterCategory(pTargetTable, pKeyColumn, pItemId, pCallback) {
                try {
                    if (pItemId != '') {
                        var strQuery = "DELETE FROM " + pTargetTable + " WHERE " + pKeyColumn + " IN (" + pItemId + ")";
                        reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                            if (pError) {
                                return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40312', 'Error on _DeleteMasterCategory() function', pError, null, pCallback);
                            } else {
                                return _PrepareAndSendCallback('SUCCESS', null, null, null, null, pCallback);
                            }
                        });
                    } else
                        return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40313', '', null, 'ItemID not found', pCallback);
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40314', 'Error on _DeleteMasterCategory() function', error, null, pCallback);
                }
            }

            // Delete Transaction Data from TargetTable (Transaction table)
            function _DeleteTargetTable(pTargetTable, pKeyColumn, pRowsToDelete, pCallback) {
                try {
                    var strParentDTT = '';
                    var arrDTTCode = [];
                    // Get all unique DTT_CODE
                    for (var i = 0; i < pRowsToDelete.rows.length; i++) {
                        if (arrDTTCode.indexOf(pRowsToDelete.rows[i]['dtt_code']) < 0)
                            arrDTTCode.push(pRowsToDelete.rows[i]['dtt_code']);
                    }

                    // separate parent data
                    var arrParentDTT = new reqLinq(pRowsToDelete.rows).Where(function (item) {
                        return item['parent_ts_id'] === 0;
                    }).ToArray();

                    // get the parent dtt_code
                    strParentDTT = (arrParentDTT.length > 0) ? arrParentDTT[0]['dtt_code'] : '';

                    var arrChildDTT = new reqLinq(pRowsToDelete.rows).Where(function (item) {
                        return item['parent_ts_id'] != 0;
                    }).ToArray();

                    reqAsync.parallel({
                        DeleteParentTable: function (cbPar) {
                            // Delete the parent targettable
                            var Item_Id = '';
                            for (var i = 0; i < arrParentDTT.length; i++) {
                                if (Item_Id == '')
                                    Item_Id = arrParentDTT[i]['item_id'];
                                else
                                    Item_Id = Item_Id + "," + arrParentDTT[i]['item_id'];
                            }
                            if (Item_Id != '') {
                                var strQuery = "DELETE FROM " + pTargetTable + " WHERE " + pKeyColumn + " IN (" + Item_Id + ")";
                                reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                                    var obj = {};
                                    if (pError)
                                        obj = _PrepareCallbackObject('FAILURE', 'ERR-HAN-40315', 'Error on executing deleting parent targettable ' + pTargetTable + ' with Item_ID ' + Item_Id, pError, null);
                                    else
                                        obj = _PrepareCallbackObject('SUCCESS', '', '', null, null);
                                    cbPar(null, obj);
                                });
                            } else {
                                obj = _PrepareCallbackObject('SUCCESS', '', '', null, null);
                                cbPar(null, obj);
                            }
                        },
                        DeleteChildTable: function (cbPar) {
                            if (arrChildDTT.length > 0) {
                                _DeleteChildTable(strParentDTT, arrDTTCode, arrChildDTT, pRowsToDelete, function callbackDeleteChildTable(pStatus) {
                                    cbPar(null, pStatus);
                                });
                            } else {
                                obj = _PrepareCallbackObject('SUCCESS', '', '', null, null);
                                cbPar(null, obj);
                            }
                        }
                    },
                        function (err, results) {
                            if (results.DeleteParentTable.Status == 'SUCCESS' && results.DeleteChildTable.Status == 'SUCCESS')
                                return _PrepareAndSendCallback('SUCCESS', '', '', null, null, pCallback);
                            else {
                                if (results.DeleteParentTable.Status == 'FAILURE')
                                    return _PrepareAndSendCallback(results.DeleteParentTable.Status, results.DeleteParentTable.ErrorCode, results.DeleteParentTable.ErrorMsg, results.DeleteParentTable.Error, results.DeleteParentTable.Warning, pCallback);
                                else
                                    return _PrepareAndSendCallback(results.DeleteChildTable.Status, results.DeleteChildTable.ErrorCode, results.DeleteChildTable.ErrorMsg, results.DeleteChildTable.Error, results.DeleteChildTable.Warning, pCallback);
                            }
                        });
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40316", 'Error on _DeleteTargetTable() function ', error, null, pCallback);
                }
            }

            //Delete Child Table
            function _DeleteChildTable(pParentDTT, pArrDTTCode, pArrChildDTT, pRowsToDelete, pCallback) {
                try {
                    reqAsync.forEachOf(pArrDTTCode, function (DTT, index, callback) {
                        if (pParentDTT != DTT) {
                            var strTemp = reqSrvHlpr.GetTargetTableAndKeyColumn(objRelation, DTT, objLogInfo);
                            if (strTemp.Status == 'SUCCESS') {
                                var strDTTInfo = strTemp.Data.split(',');

                                var strTargetTable = strDTTInfo[0];
                                var strKeyColumn = strDTTInfo[1];

                                // Delete the Child Targettable
                                var Item_Id = '';

                                var arrItemID = new reqLinq(pArrChildDTT).Select(function (item) {
                                    if (item['dtt_code'] === DTT)
                                        return item['item_id'];
                                }).ToArray();

                                if (arrItemID.length > 0) {
                                    var strQuery = "DELETE FROM " + strTargetTable + " WHERE " + strKeyColumn + " IN (" + arrItemID.join() + ")";
                                    reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                                        if (pError)
                                            _PrintError('ERR-HAN-40317', 'Error on deleting child TargetTable ', pError);
                                        callback(pError);
                                    });
                                } else
                                    callback(null);
                            } else {
                                _PrintError(strTemp.ErrorCode, strTemp.ErrorMsg, strTemp.Error);
                                callback(strTemp.Error);
                            }
                        } else
                            callback(null);
                    }, function (err, result) {
                        if (err)
                            return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40318", 'Error on _DeleteChildTable() function ', error, null, pCallback);
                        else
                            return _PrepareAndSendCallback('SUCCESS', "", '', null, null, pCallback);
                    });
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40319", 'Error on _DeleteChildTable() function ', error, null, pCallback);
                }
            }

            // Delete Attachment from TRN_ATTACHMENTS table
            function _DeleteAttachment(pRowsToDelete, pCallback) {
                try {
                    var Item_Id = '';
                    for (var i = 0; i < pRowsToDelete.rows.length; i++) {
                        if (Item_Id == '')
                            Item_Id = pRowsToDelete.rows[i]['item_id'];
                        else
                            Item_Id = Item_Id + "," + pRowsToDelete.rows[i]['item_id'];
                    }
                    if (Item_Id != '') {
                        var strQuery = "DELETE FROM TRN_ATTACHMENTS WHERE TRN_ID IN (" + Item_Id + ")";
                        reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                            if (pError) {
                                return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40320", 'Error on _DeleteAttachment() function', pError, null, pCallback);
                            } else
                                return _PrepareAndSendCallback('SUCCESS', "", '', null, null, pCallback);
                        });
                    } else
                        return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40321', '', null, 'ItemID not found', pCallback);
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40322", 'Error on _DeleteAttachment() function', error, null, pCallback);
                }
            }

            // Delete Comment
            function _DeleteComment(pRowsToDelete, pCallback) {
                try {
                    var Item_Id = '';
                    for (var i = 0; i < pRowsToDelete.rows.length; i++) {
                        if (Item_Id == '')
                            Item_Id = pRowsToDelete.rows[i]['ts_id'];
                        else
                            Item_Id = Item_Id + "," + pRowsToDelete.rows[i]['ts_id'];
                    }
                    if (Item_Id != '') {
                        var strQuery = "DELETE FROM TRANSACTION_COMMENTS WHERE TS_ID IN (" + Item_Id + ")";
                        reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                            if (pError) {
                                return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40323", 'Error on _DeleteComment() function', pError, null, pCallback);
                            } else
                                return _PrepareAndSendCallback('SUCCESS', "", '', null, null, pCallback);
                        });
                    } else
                        return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40324", '', null, 'ItemID not found', pCallback);

                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40325", 'Error on _DeleteComment() function', error, null, pCallback);
                }
            }

            // Delete Transaction set
            function _DeleteTransactionSet(pRowsToDelete, pCallback) {
                try {
                    var Item_Id = '';
                    for (var i = 0; i < pRowsToDelete.rows.length; i++) {
                        if (Item_Id == '')
                            Item_Id = pRowsToDelete.rows[i]['ts_id'];
                        else
                            Item_Id = Item_Id + "," + pRowsToDelete.rows[i]['ts_id'];
                    }
                    if (Item_Id != '') {
                        var strQuery = "DELETE FROM TRANSACTION_SET WHERE TS_ID IN (" + Item_Id + ")";
                        reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                            if (pError) {
                                return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40326", 'Error on _DeleteTransactionSet() function ', pError, null, pCallback);
                            } else
                                return _PrepareAndSendCallback('SUCCESS', '', '', null, null, pCallback);
                        });
                    } else
                        return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40327", '', null, 'ItemID not found', pCallback);
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40328", 'Error on _DeleteTransactionSet() function ', error, null, pCallback);
                }
            }

            // Delete from SOLR
            function _DeleteSolr(pRowsToDelete, pCallback) {
                try {
                    var TrnIds = '';
                    var arrTsIds = [];
                    var arrATMTInfo = [];
                    var arrDTTCode = [];
                    for (var i = 0; i < pRowsToDelete.rows.length; i++) {
                        var objTSID = {
                            dtt_code: pRowsToDelete.rows[i]['dtt_code'],
                            ts_id: pRowsToDelete.rows[i]['ts_id']
                        };
                        arrTsIds.push(objTSID);
                        var dtt = pRowsToDelete.rows[i]['dtt_code'];
                        if (arrDTTCode.indexOf(dtt) < 0)
                            arrDTTCode.push(dtt);

                        if (TrnIds == '')
                            TrnIds = pRowsToDelete.rows[i]['item_id'];
                        else
                            TrnIds = TrnIds + "," + pRowsToDelete.rows[i]['item_id'];
                    }

                    if (TrnIds != '') {
                        var strQuery = "SELECT RELATIVE_PATH, DTTA_ID, DTT_CODE FROM TRN_ATTACHMENTS WHERE TRN_ID IN ( " + TrnIds + ")";
                        reqTranDBHelper.ExecuteSQLQuery(mTranDB, strQuery, objLogInfo, function callback(pResult, pError) {
                            try {
                                if (pError) {
                                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40329", 'Error on _DeleteSolr() function ', pError, null, pCallback);
                                } else {
                                    for (var i = 0; i < pResult.rows.length; i++) {
                                        var objATMTInfo = {
                                            relative_path: pResult.rows[i]['relative_path'],
                                            dtta_id: pResult.rows[i]['dtta_id'],
                                            dtt_code: pResult.rows[i]['dtt_code']
                                        };
                                        arrATMTInfo.push(objATMTInfo);

                                        if (arrDTTCode.indexOf(pResult.rows[i]['dtt_code']) < 0)
                                            arrDTTCode.push(pResult.rows[i]['dtt_code']);
                                    }
                                    _DeleteSolrIndex(arrDTTCode, arrTsIds, arrATMTInfo, pCallback);
                                }
                            } catch (error) {
                                return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40330", "Error on _DeleteSolr() function ", error, null, pCallback);
                            }
                        });
                    } else
                        if (arrDTTCode.length > 0)
                            _DeleteSolrIndex(arrDTTCode, arrTsIds, arrATMTInfo, pCallback);
                        else
                            return _PrepareAndSendCallback('SUCCESS', "ERR-HAN-40331", "Error on _DeleteSolr() function ", null, 'Solr TranIndex not found', pCallback);
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40332", "Error on _DeleteSolr() function ", error, null, pCallback);
                }
            }

            // Delete from SOLR
            function _DeleteSolrIndex(pDTTCode, pTSIDs, pATMTInfo, pCallback) {
                try {
                    _NeedSolrIndex(pDTTCode, pTSIDs, pATMTInfo, function callback(TSIDIndex, ATMTIndex) {
                        reqAsync.parallel({
                            DeleteTranIndex: function (parCB) {
                                // Delete trans index on solr
                                if (TSIDIndex.length > 0)
                                    reqSolrHelper.SolrDelete(strReqHeader, 'dynamic_core', 'TS_ID', TSIDIndex, objLogInfo, function callbackDeleteTranIndex(pStatus) {
                                        parCB(null, pStatus);
                                    });
                                else
                                    parCB(null, 'SUCCESS');
                            },
                            DeleteATMTIndex: function (parCB) {
                                // Delete ATMT index on solr
                                if (ATMTIndex.length > 0)
                                    reqSolrHelper.SolrDelete(strReqHeader, 'static_core', 'filename', ATMTIndex, objLogInfo, function callbackDeleteATMTIndex(pStatus) {
                                        parCB(null, pStatus);
                                    });
                                else
                                    parCB(null, 'SUCCESS');
                            }
                        },
                            function callbackSOlrDelete(pErr, pResult) {
                                if (!pErr)
                                    return _PrepareAndSendCallback('SUCCESS', '', '', null, null, pCallback);
                                else {
                                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40333", 'Error on _DeleteSolrIndex() function ', pErr, null, pCallback);
                                }
                            });
                    });
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', "ERR-HAN-40334", 'Error on _DeleteSolrIndex() function ', error, null, pCallback);
                }
            }

            // Check NeedSolr Index for DTT
            function _NeedSolrIndex(pDTTs, pTsIds, pATMTInfo, pCallback) {
                var arrTranIndex = [];
                var arrATMTIndex = [];
                var obj = {};
                try {
                    reqFXDBInstance.GetTableFromFXDB(mDepCas, 'DTT_INFO', ['NEED_SOLR_INDEX', 'DTT_CODE', 'DTT_DFD_JSON'], {
                        APP_ID: strAppId,
                        DTT_CODE: pDTTs
                    }, objLogInfo, function callbackDTTInfo(pError, pResult) {
                        try {
                            if (pError) {
                                obj = _PrepareCallbackObject('FAILURE', "ERR-HAN-40335", 'Error on _NeedSolrIndex() function ', pError, null);
                                pCallback(arrTranIndex, arrATMTIndex, obj);
                            } else {
                                for (var i = 0; i < pResult.rows.length; i++) {
                                    var row = pResult.rows[i];
                                    var dttcode = row['dtt_code'];
                                    // Add  Tran index property to delete on solr
                                    for (var j = 0; j < pTsIds.length; j++) {
                                        if (pTsIds[j].dtt_code == dttcode && row['need_solr_index'] == 'Y')
                                            arrTranIndex.push(pTsIds[j].ts_id);

                                    }
                                    // Add ATMT solr index property
                                    for (var k = 0; k < pATMTInfo.length; k++) {
                                        if (pATMTInfo[k].dtt_code == dttcode) {
                                            var blnNeedIndex = _GetAttachmentIndex(row['dtt_dfd_json'], pATMTInfo[k].dtta_id);
                                            if (blnNeedIndex)
                                                arrATMTIndex.push(pATMTInfo[k].relative_path);
                                        }
                                    }
                                }
                                obj = _PrepareCallbackObject('SUCCESS', '', '', null, null);
                                pCallback(arrTranIndex, arrATMTIndex, obj);
                            }

                        } catch (error) {
                            obj = _PrepareCallbackObject('FAILURE', "ERR-HAN-40336", 'Error on _NeedSolrIndex() function ', error, null);
                            pCallback(arrTranIndex, arrATMTIndex, obj);
                        }
                    });
                } catch (error) {
                    obj = _PrepareCallbackObject('FAILURE', "ERR-HAN-40337", 'Error on _NeedSolrIndex() function ', error, null);
                    pCallback(arrTranIndex, arrATMTIndex, obj);
                }
            }

            // Get ATMT index to delete atmt from SOLR (STATIC CORE)
            function _GetAttachmentIndex(pDttDfdJson, pDttaId) {
                try {
                    var strDFDJSON = pDttDfdJson.replace(/\\/g, '');
                    var objDFDJson = JSON.parse(strDFDJSON);
                    if (objDFDJson.DTT_ATTACHMENT != null && objDFDJson.DTT_ATTACHMENT != undefined)
                        var DTTA = new reqLinq(objDFDJson.DTT_ATTACHMENT).Where(function (i) {
                            return i.DTTA_ID === pDttaId;
                        }).ToArray();

                    if (DTTA.length > 0) {
                        if (DTTA[0].NEED_SOLR_INDEX != undefined && DTTA[0].NEED_SOLR_INDEX != null && DTTA[0].NEED_SOLR_INDEX != "" && DTTA[0].NEED_SOLR_INDEX == 'Y')
                            return true;
                        else
                            return false;
                    } else
                        return false;
                } catch (error) {
                    _PrintError("ERR-HAN-40338", "_Error on GetAttachmentIndex() function ", error);
                    return false;
                }
            }

            // Initializing DB
            function _InitializeTrnDB(pHeaders, pCallback) {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                    mDepCas = pClient;
                    reqTranDBHelper.GetTranDBConn(pHeaders, false, function (pSession) {
                        mTranDB = pSession;
                        DBType = mTranDB.DBConn.DBType;
                        pCallback('Success');
                    });
                });
            }

            // Initializing Params
            function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
                try {
                    //Prepare Client Side Params
                    if (pClientParam['WFTPA_ID'] != undefined && pClientParam['WFTPA_ID'] != '')
                        strWftpaId = pClientParam['WFTPA_ID'].toString();

                    if (pClientParam['JSON_DATASET'] != undefined && pClientParam['JSON_DATASET'] != '')
                        strJsonDataSet = JSON.stringify(pClientParam['JSON_DATASET']);

                    if (pClientParam.LOGIN_NAME) {
                        reqFXDBInstance.GetFXDBConnection(strReqHeader, 'clt_cas', objLogInfo, function (cltClient) {
                            reqFXDBInstance.GetTableFromFXDB(cltClient, 'users', ['u_id', 'appur_sts'], { login_name: pClientParam.LOGIN_NAME }, objLogInfo, function (error, result) {
                                if (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'errcode', 'errmsg', error);
                                } else {
                                    var row = result.rows[0];
                                    strUId = row.u_id;
                                    var appur_sts = new reqLinq(JSON.parse(row.appur_sts))
                                        .Where(function (item) {
                                            return item.APP_CODE == pClientParam.APP_CODE;
                                        }).FirstOrDefault();
                                    strAppId = appur_sts.APP_ID;
                                    // var clustersystems = JSON.parse(appur_sts.CLUSTER_NODES)[0].clustersystems[0];
                                    // params.S_ID = clustersystems.data.s_id;
                                    // params.SYSTEM_DESC = clustersystems.data.sysDesc;
                                    strTokenId = strUId & "-" & (new Date()).getSeconds();
                                    strLoginName = pClientParam.LOGIN_NAME;
                                    _PrepareAndSendCallback('SUCCESS', null, null, null, null, pCallback);
                                }
                            });
                        });
                    } else {
                        if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                            strAppId = pSessionInfo['APP_ID'].toString();

                        if (pSessionInfo['U_ID'] != undefined && pSessionInfo['U_ID'] != '')
                            strUId = pSessionInfo['U_ID'].toString();

                        if (pSessionInfo['LOGIN_NAME'] != undefined && pSessionInfo['LOGIN_NAME'] != '')
                            strLoginName = pSessionInfo['LOGIN_NAME'].toString();
                        strTokenId = strUId & "-" & (new Date()).getSeconds();
                        _PrepareAndSendCallback('SUCCESS', null, null, null, null, pCallback);
                    }

                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40339', 'Error on _InitializeParams() function', error, null, pCallback);
                }
            }

            // Print Error Message
            function _PrintError(pErrCode, pMessage, pError) {
                reqInsHelper.PrintError('DeleteItem', pError, pErrCode, objLogInfo, pMessage);
            }

            // Print Information
            function _PrintInfo(pMessage) {
                reqInsHelper.PrintInfo('DeleteItem', pMessage, objLogInfo);
            }

            // Prepare and Send callback
            function _PrepareAndSendCallback(pStatus, pErrorCode, pErrorMsg, pErrorObj, pWarning, pCallback) {
                var objCallback = {
                    Status: pStatus,
                    ErrorCode: pErrorCode,
                    ErrorMsg: pErrorMsg,
                    Error: pErrorObj,
                    Warning: pWarning
                };
                return pCallback(objCallback);
            }

            // Prepare and Send callback
            function _PrepareCallbackObject(pStatus, pErrorCode, pErrorMsg, pErrorObj, pWarning) {
                var objCallback = {
                    Status: pStatus,
                    ErrorCode: pErrorCode,
                    ErrorMsg: pErrorMsg,
                    Error: pErrorObj,
                    Warning: pWarning
                };
                return objCallback;
            }

            // Send response
            function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
                var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
                return reqInsHelper.SendResponse('DeleteItem', appResponse, pResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
            }

        });
    } catch (error) {
        return reqInsHelper.SendResponse('DeleteItem', appResponse, 'FAILURE', null, 'ERR-HAN-40340', 'Error on DeleteItem api function ', error);
    }
}); // End of DeleteItem

module.exports = router;
    /********* End of Service **********/