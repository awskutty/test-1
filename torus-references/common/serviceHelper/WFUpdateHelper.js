/****
 * Created by Shanthi on 7/1/2016.
 * Descriptions : Workflow update status
 ****/

// Require dependencies
var reqAsync = require('async');
var reqLinq = require('node-linq').LINQ;
var reqDateFormat = require('dateformat');
var reqTranDBHelper = require('../../instance/TranDBInstance');
var reqFXDBInstance = require('../../instance/DBInstance');
var objSpRecordLock = require('./RecordLock');
var objSpRecordUnLock = require('./RecordUnLock');
var reqInsHelper = require('../../common/InstanceHelper');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');

var header;
function WFUpdate(pDtCode, pDttCode, pActionId, pEventCode, pReleaseLock, pAppId, pTokenId, pUID, pAppSTSId, pSTSId, pApprId, pCurrentDate, pSTPCID, pNeedComment, pCommentText, pTranSess, pCasClient, pLoginName, pAppUId, pSystemDesc, pSCode, pLogInfo, strReqHeader, metadata, ModelItem, pSid, pPSid, pCallbackWFUpdate) {
    var objLogInfo;
    var tpmpItemDttcode = '';
    var qryInfoDttCode = '';
    header = strReqHeader;
    objLogInfo = pLogInfo;

    try {

        function clearVariable() {
            pDttCode = null;
            pActionId = null;
            pEventCode = null;
            pReleaseLock = null;
            pAppId = null;
            pTokenId = null;
            pUID = null;
            pAppSTSId = null;
            pSTSId = null;
            pApprId = null;
            pCurrentDate = null;
            pSTPCID = null;
            pNeedComment = null;
            pCommentText = null;
            pTranSess = null;
            pCasClient = null;
            pLoginName = null;
            pAppUId = null;
            pSystemDesc = null;
            pSCode = null;
            strReqHeader = null;
            metadata = null;
            ModelItem = null;
            pSid = null;
            pPSid = null;
            tpmpItemDttcode = null;
        }



        _PrintInfo(objLogInfo, 'Query TMP_PROCESS_ITEMS table');
        reqTranDBHelper.GetTableFromTranDB(pTranSess, 'TMP_PROCESS_ITEMS', {
            prct_id: pTokenId
        }, objLogInfo, function callbackTmpProcessItems(pRes, pErr) {
            try {
                if (pErr) {
                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40016', 'Error on querying TMP_PROCESS_ITEMS', pErr, null, pCallbackWFUpdate);
                } else {
                    tpmpItemDttcode = pRes[0].dtt_code;
                    var TPITable;
                    var QueryData;
                    //Get Query Details from  QRY_INFO table ,event code as where condition
                    _PrintInfo(objLogInfo, 'Getting the WFUpdate query with following params - Appid:' + pAppId + ',WFTPAID:' + pActionId + ',EventCode:' + pEventCode + 'Process:WF_UPDATE');
                    reqFXDBInstance.GetTableFromFXDB(pCasClient, 'QRY_INFO', [], {
                        APP_ID: pAppId,
                        WFTPA_ID: pActionId,
                        EVENT_CODE: pEventCode,
                        PROCESS: 'WF_UPDATE',
                        DS_CODE: objLogInfo.DSCODE
                    }, objLogInfo, function callbackQryInfo(pError, pResult) {
                        try {
                            if (pError) {
                                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40017', 'Error on querying QRY_INFO table', pError, null, pCallbackWFUpdate);
                            } else {
                                QueryData = pResult;

                                if (QueryData == null || QueryData == undefined || QueryData.rows.length == 0) {
                                    //If qery not available for given event code again query the same table using event code as "DEFAULT"
                                    _PrintInfo(objLogInfo, 'Query not found for given event code.Getting the WFUpdate query with following params - Appid:' + pAppId + ',WFTPAID:' + pActionId + ',EventCode:DEFAULT, Process:WF_UPDATE');
                                    reqFXDBInstance.GetTableFromFXDB(pCasClient, 'QRY_INFO', [], {
                                        APP_ID: pAppId,
                                        WFTPA_ID: pActionId,
                                        EVENT_CODE: 'DEFAULT',
                                        PROCESS: 'WF_UPDATE'
                                    }, objLogInfo, function callbackQryInfo(pError, pResult) {
                                        try {
                                            if (pError) {
                                                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40018', 'Error on querying QRY_INFO table', pError, null, pCallbackWFUpdate);
                                            } else {
                                                QueryData = pResult;
                                                pResult = null;
                                                if (QueryData == null || QueryData == undefined || QueryData.rows.length == 0) {
                                                    _PrintInfo(objLogInfo, 'Query Result from QRY_INFO table ' + QueryData.rows.length);
                                                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40019', null, null, 'Query not found for WFUpdate', pCallbackWFUpdate);
                                                } else {
                                                    /* After get the result from query info table  call _PrepareQuery.
                                                    Here we can prepare the  TMP_FINAL table insert  and prepare query execute stuts update query 
                                                    */
                                                    _PrepareQuery(pTranSess, pAppId, pDtCode, pDttCode, pTokenId, QueryData, pUID, pAppSTSId, pSTSId, pLoginName, TPITable, pApprId, pActionId, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, tpmpItemDttcode, qryInfoDttCode, objLogInfo, function callbackPrepareQuery(pRes, pBlnStatus) {
                                                        try {
                                                            QueryData = undefined;
                                                            //Check Release Lock parameter. if "Y" then call Unlock function.else call afterunlock function
                                                            if (pReleaseLock == 'Y') {
                                                                //after update status unlock the trasnactions 
                                                                objSpRecordUnLock.RecordUnLock(pAppId, pUID, pSTSId, pTokenId, 'PROCESS_LOCK', '', reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo), pTranSess, pLoginName, objLogInfo, '', {}, function (res, err) {
                                                                    _PrintInfo(objLogInfo, 'Record unlocked...');
                                                                    if (!err) {
                                                                        afterUnlock();
                                                                    } else if (err) {
                                                                        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40020', 'Error in RecordUnLock() function ', err, null, pCallbackWFUpdate);
                                                                    }
                                                                });
                                                            } else {
                                                                afterUnlock();
                                                            }
                                                            //After unlock call the wfupdate's callback function
                                                            function afterUnlock() {
                                                                clearVariable();
                                                                pCallbackWFUpdate(pRes, pBlnStatus);
                                                            }
                                                        } catch (error) {
                                                            _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40021', 'Error in WFUpdate() function ', error, null, pCallbackWFUpdate);
                                                        }
                                                    });
                                                }
                                            }
                                        } catch (error) {
                                            _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40022', 'Error in WFUpdate() function ', error, null, pCallbackWFUpdate);
                                        }
                                    });
                                } else
                                    /* After get the result from query info table  call _PrepareQuery.
                                       Here we can prepare the  TMP_FINAL table insert  and prepare query execute stuts update query 
                                                       */
                                    _PrepareQuery(pTranSess, pAppId, pDtCode, pDttCode, pTokenId, QueryData, pUID, pAppSTSId, pSTSId, pLoginName, TPITable, pApprId, pActionId, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, tpmpItemDttcode, qryInfoDttCode, objLogInfo, function callbackPrepareQuery(pRes, pBlnStatus) {
                                        try {
                                            //Check Release Lock parameter. if "Y" then call Unlock function.else call afterunlock function
                                            if (pReleaseLock == 'Y') {
                                                //Release Lock Helper function call
                                                objSpRecordUnLock.RecordUnLock(pAppId, pUID, pSTSId, pTokenId, 'PROCESS_LOCK', '', reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo), pTranSess, pLoginName, objLogInfo, '', {}, function (res, err) {
                                                    _PrintInfo(objLogInfo, 'Record unlocked...');
                                                    if (!err) {
                                                        afterUnlock();
                                                    } else if (err) {
                                                        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40023', 'Error in RecordUnLock() function ', err, null, pCallbackWFUpdate);
                                                    }
                                                });
                                            } else {
                                                afterUnlock();
                                            }
                                            //After unlock call the wfupdate's callback function
                                            function afterUnlock() {
                                                clearVariable();
                                                pCallbackWFUpdate(pRes, pBlnStatus);
                                            }

                                        } catch (error) {
                                            _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40024', 'Error in WFUpdate() function ', error, null, pCallbackWFUpdate);
                                        }
                                    });
                            }
                        } catch (error) {
                            _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40025', 'Error in WFUpdate() function ', error, null, pCallbackWFUpdate);
                        }
                    });
                }
            } catch (error) {
                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40026', 'Error in WFUpdate() function ', error, null, pCallbackWFUpdate);
            }
        });
    } catch (error) {
        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40028', 'Error in WFUpdate() function ', error, null, pCallbackWFUpdate);
    }

}
//TMP_FINAL_ITEMS Table insert function
function _InsertTempFinalItems(pTranDB, pAppId, pDTTCode, pTokenId, pQryInfoDttCode, objLogInfo, pCallback) {
    var blnError = false;
    try {
        /*  TMP_FINAL_ITEMS table insert, execute this function async series.
            Before insert delete TMP_FINAL_ITEMS and then insert 
        */
        reqAsync.series([
            //Clear  TMP_FINAL_ITEMS table belonging tp Prct_id
            function (parCb) {
                var strQry = "DELETE FROM TMP_FINAL_ITEMS WHERE  PRCT_ID ='" + pTokenId + "'";
                reqTranDBHelper.ExecuteSQLQuery(pTranDB, strQry, objLogInfo, function (results, err) {
                    if (err)
                        blnError = true;
                    parCb(null, err);
                });
            },
            function (parCb) {
                // Prepare and insert the value into TMP_FINAL_ITEMS table from TMP_PROCESS_ITEMS table record belongs to given token id 
                var strQry = "INSERT INTO TMP_FINAL_ITEMS  (TS_ID, TRN_ID, DTT_CODE, GROUP_ID, PRCT_ID)  SELECT TS.TS_ID,TS.TRN_ID,TS.DTT_CODE,TS.GROUP_ID," + "'" + pTokenId + "'" + " FROM TRANSACTION_SET TS INNER JOIN TMP_PROCESS_ITEMS TPI ON TS.TRN_ID = TPI.ITEM_ID AND TS.DT_CODE = TPI.DT_CODE AND TS.DTT_CODE = TPI.DTT_CODE WHERE TPI.PRCT_ID = '" + pTokenId + "'";
                _PrintInfo(objLogInfo, "TMP_FINAL_ITEMS INSERT 1 Start Time :" + reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                _PrintInfo(objLogInfo, 'insert str query is ' + strQry);
                reqTranDBHelper.ExecuteSQLQuery(pTranDB, strQry, objLogInfo, function (results, err) {
                    if (err) {
                        blnError = true;
                    } else {
                        _PrintInfo(objLogInfo, "TMP_FINAL_ITEMS INSERT 1 End Time :" + reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                        if (pQryInfoDttCode != '') {
                            /* prepare and insert the value into TMP_FINAL_ITEMS table from TMP_PROCESS_ITEMS table record belongs to given token id 
                             and  transaction_set table dtt_code match with qry_info table's dtt_code */

                            strQry = "INSERT INTO TMP_FINAL_ITEMS (TS_ID,TRN_ID,DTT_CODE,GROUP_ID,PRCT_ID) SELECT TS_ID,TRN_ID,TS.DTT_CODE,GROUP_ID,'" + pTokenId + "' AS PRCT_ID FROM TRANSACTION_SET TS WHERE GROUP_ID IN (SELECT GROUP_ID FROM TRANSACTION_SET TS INNER JOIN TMP_PROCESS_ITEMS TPI ON TS.TRN_ID=TPI.ITEM_ID AND TS.DT_CODE=TPI.DT_CODE AND TS.DTT_CODE=TPI.DTT_CODE WHERE TPI.PRCT_ID='" + pTokenId + "' AND TS.DTT_CODE='" + pDTTCode + "') AND TS.DTT_CODE IN(" + pQryInfoDttCode + ")";
                            _PrintInfo(objLogInfo, "TMP_FINAL_ITEMS INSERT 2 Start Time :" + reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                            _PrintInfo(objLogInfo, 'insert str query2 is ' + strQry);
                            reqTranDBHelper.ExecuteSQLQuery(pTranDB, strQry, objLogInfo, function (results, err) {
                                if (err) {
                                    blnError = true;
                                } else {
                                    _PrintInfo(objLogInfo, "TMP_FINAL_ITEMS INSERT 2 End Time :" + reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                                    parCb(null, err);
                                }
                            });
                        } else {
                            parCb(null, err);
                        }
                    }
                });
            },
            function (parCb) {
                var strQry = "SELECT count(*) FROM TMP_FINAL_ITEMS WHERE DTT_CODE='" + pDTTCode + "' AND PRCT_ID ='" + pTokenId + "'";
                reqTranDBHelper.ExecuteSQLQuery(pTranDB, strQry, objLogInfo, function (results, err) {
                    if (err)
                        blnError = true;
                    parCb(results, err);
                });
            },
        ],
            function (results, err) {
                //Results are all ready, containing the results of two different queries
                if (blnError) {
                    _PrintError(objLogInfo, "ERR-HAN-40029", 'Error on _InsertTempFinalItems() function', err);
                    pCallback(null, err);
                } else
                    pCallback(results, err);
            });
    } catch (error) {
        _PrintError(objLogInfo, "ERR-HAN-40030", "Error on _InsertTempFinalItems() function ", error);
        pCallback(null, error);
    }
}

function _PrepareQuery(pTranSess, pAppId, pDtCode, pDTTCode, pTokenId, pQueryList, pUId, pAppSTSId, pSTSId, pLoginName, pTmpProcessItems, pApprId, pActionId, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, pTpmpItemDttcode, pQryInfoDttCode, objLogInfo, pCallback) {
    var FinalCount = 0;
    try {
        //Get the DTT_CODE from qry_info table
        for (var row = 0; row < pQueryList.rows.length; row++) {
            if (pTpmpItemDttcode != pQueryList.rows[row].dtt_code) {
                if (pQryInfoDttCode != '') {
                    pQryInfoDttCode = pQryInfoDttCode + ",'" + pQueryList.rows[row].dtt_code + "'";
                } else {
                    pQryInfoDttCode = "'" + pQueryList.rows[row].dtt_code + "'";
                }
            }
        }

        //TMP_FINAL_ITEMS Table insert function call
        _InsertTempFinalItems(pTranSess, pAppId, pDTTCode, pTokenId, pQryInfoDttCode, objLogInfo, function callbackInsertTempFinal(pResult) {
            try {
                if (pResult != null && pResult.rows.length > 0)
                    FinalCount = pResult.rows.length;
                _PrintInfo(objLogInfo, 'Finalcount ' + FinalCount);

                if (FinalCount > 0) {
                    //call record lock process to lock the trasnaction to the user for the tmp_final_items table reocrds.
                    objSpRecordLock.RecordLock(pAppId, pTokenId, pUId, pSTSId, 'PROCESS_LOCK', '', '', reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo), '', pTranSess, pLoginName, objLogInfo, header, '', '', {}, function (res) {
                        _PrintInfo(objLogInfo, 'Record locked...');
                        //after lock going to update the status
                        _statusupdate(pQueryList, pTranSess, pAppId, pDtCode, pDTTCode, pTokenId, FinalCount, pUId, pAppSTSId, pSTSId, pApprId, pActionId, pLoginName, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, objLogInfo, function callbackstatusupdate(ErrStatusObject, Blnres) {
                            // Check  pNeedComment param from appRequest if "Y" call tranaction comment table insert function 
                            if (Blnres && (pNeedComment == 'Y' || pNeedComment == '')) {
                                // Transaction Comments insert function call 
                                _InsertTransactionComments(pSTPCID, pCommentText, pTokenId, pAppSTSId, pUId, pDtCode, pDTTCode, pLoginName, pTranSess, objLogInfo, function callbackInsertTransactionComment(pRes, pBlnErrStatus) {
                                    clearPrepareqryVariable();
                                    pCallback(ErrStatusObject, pBlnErrStatus);
                                });
                            } else
                                pCallback(ErrStatusObject, Blnres);
                        });
                    });
                } else {
                    _statusupdate(pQueryList, pTranSess, pAppId, pDtCode, pDTTCode, pTokenId, FinalCount, pUId, pAppSTSId, pSTSId, pApprId, pActionId, pLoginName, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, objLogInfo, function callbackstatusupdate(ErrStatusObject, Blnres) {
                        // Check  pNeedComment param from appRequest if "Y" call tranaction comment table insert function 
                        if (Blnres && (pNeedComment == 'Y' || pNeedComment == '')) {
                            // Transaction Comments insert function call 
                            _InsertTransactionComments(pSTPCID, pCommentText, pTokenId, pAppSTSId, pUId, pDtCode, pDTTCode, pLoginName, pTranSess, objLogInfo, function callbackInsertTransactionComment(pResObj, pBlnErrStatus) {
                                clearPrepareqryVariable();
                                pCallback(ErrStatusObject, pBlnErrStatus);
                            });
                        } else
                            clearPrepareqryVariable();
                        pCallback(ErrStatusObject, Blnres);
                    });
                }

                function clearPrepareqryVariable() {
                    pTranSess = undefined;
                    pAppId = undefined;
                    pDtCode = undefined;
                    pDTTCode = undefined;
                    pTokenId = undefined;
                    pQueryList = undefined;
                    pUId = undefined;
                    pAppSTSId = undefined;
                    pSTSId = undefined;
                    pLoginName = undefined;
                    pTmpProcessItems = undefined;
                    pApprId = undefined;
                    pActionId = undefined;
                    pNeedComment = undefined;
                    pCommentText = undefined;
                    pSTPCID = undefined;
                    pAppUId = undefined;
                    pSystemDesc = undefined;
                    pSCode = undefined;
                    metadata = undefined;
                    ModelItem = undefined;
                    pSid = undefined;
                    pPSid = undefined;
                    pTpmpItemDttcode = undefined;
                }
            } catch (error) {
                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40031', 'Error on _PrepareQuery() function', error, null, pCallback);
            }
        });
    } catch (error) {
        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40032', 'Error on _PrepareQuery() function', error, null, pCallback);
    }
}

function _statusupdate(pQueryList, pTranSess, pAppId, pDtCode, pDTTCode, pTokenId, FinalCount, pUId, pAppSTSId, pSTSId, pApprId, pActionId, pLoginName, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, objLogInfo, callback) {
    try {
        if (pQueryList == null || pQueryList == undefined || pQueryList.rows.length == 0) {
            _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40033', 'Query Not found for WFUpdate', null, 'Query Not found for WFUpdate', callback);
        }
        //sort the query list using sort_order column 
        var resQrys = new reqLinq(pQueryList.rows)
            .OrderBy(function (row) {
                return row.sort_order;
            }).ToArray();
        var QryCount = resQrys.length;
        var count = 0;

        _PrintInfo(objLogInfo, 'No.of Queries found ' + resQrys.length);

        var strError = '';
        var strWarning = '';
        var updatedRows = [];


        //Prepare and execute the query 
        reqAsync.forEachSeries(resQrys, function (rowQry, asyncallback) {
            // var rowQry = resQrys[i]
            if (rowQry['main_qry_type'] != 'P' && FinalCount > 0) {
                //  'U' type query handling Handling TS, Trn query
                //get the trn_query and ts query for update 
                _PrepareUpdateQuery(pTranSess, pAppId, rowQry['main_qry_text'], rowQry['trn_qry_text'], rowQry['main_qry_type'], rowQry['main_qry_mode'], pDtCode, pDTTCode, pTokenId, FinalCount, pUId, pAppSTSId, pSTSId, pApprId, pActionId, pLoginName, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSid, pPSid, objLogInfo, function callbackPrepareUpdateQry(pRes, err, warn) {
                    if (err)
                        strError = strError + err;
                    if (warn)
                        strWarning = strWarning + warn;
                    updatedRows = pRes;
                    asyncallback(strError, strWarning);
                });
            }
            // Process EQ query handling  main_qry_type is "P" 
            if (rowQry['trn_qry_text'] != '' && rowQry['main_qry_type'] == 'P') {
                _PrepareProcessQuery(pTranSess, rowQry['trn_qry_text'], rowQry['main_qry_type'], pAppId, pDtCode, pDTTCode, pTokenId, pApprId, pLoginName, pActionId, pUId, pSTSId, pAppSTSId, pAppUId, pSystemDesc, pSCode, pSid, pPSid, objLogInfo, function callbackProcessQuery(pRes, err) {
                    try {
                        if (pRes.Status == 'FAILURE')
                            strError = strError + pRes.ErrorMsg;

                        asyncallback(strError, strWarning);
                    } catch (error) {
                        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40036', 'Error on _PrepareProcessQuery() function', error, null, callback);
                    }
                });
            }
        }, function (pErr, pWarning) {
            if (pErr != null && pErr != undefined && pErr != '')
                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40034', pErr, null, null, callback); // callback(false, strError)
            else if (pWarning != null && pWarning != undefined && pWarning != '')
                _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40034', null, null, pWarning, callback); // callback(false, strError)
            else {
                var respObj = {
                    Data: updatedRows,
                    Status: 'SUCCESS'
                };
                _PrepareAndSendCallback(respObj, null, null, null, null, callback); //  callback(pRes, err)
            }
        });

        function clearstatusUpdatevariable() {
            pQueryList = undefined;
            pTranSess = undefined;
            pAppId = undefined;
            pDtCode = undefined;
            pDTTCode = undefined;
            pTokenId = undefined;
            FinalCount = undefined;
            pUId = undefined;
            pAppSTSId = undefined;
            pSTSId = undefined;
            pApprId = undefined;
            pActionId = undefined;
            pLoginName = undefined;
            pNeedComment = undefined;
            pCommentText = undefined;
            pSTPCID = undefined;
            pAppUId = undefined;
            pSystemDesc = undefined;
            pSCode = undefined;
            metadata = undefined;
            ModelItem = undefined;
            pSid = undefined;
            pPSid = undefined;
        }
    } catch (error) {
        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40037', 'Error on _statusupdate() function', error, null, callback);
    }
}

function _PrepareUpdateQuery(pTranSess, pAppId, pTSQuery, pTrnQuery, pQueryType, pMode, pDtCode, pDttCode, pTokenId, pFinalCount, pUId, pAppSTSId, pSTSId, pApprId, pActionId, pLoginName, pNeedComment, pCommentText, pSTPCID, pAppUId, pSystemDesc, pSCode, metadata, ModelItem, pSID, pPSID, objLogInfo, pCallback) {
    //Get Updated DTT from TMP_PROCESS_ITEMS
    var UpdatedDTTCode = '';
    var TSQuery = pTSQuery; //Transaction_set query
    var TRNQuery = pTrnQuery; //trn table query
    try {
        reqTranDBHelper.GetTableFromTranDB(pTranSess, 'TMP_PROCESS_ITEMS', {
            dtt_code: pDttCode,
            prct_id: pTokenId
        }, objLogInfo, function callbackTmpProcessItem(pResult, pError) {
            try {
                if (pError) {
                    _PrintError(objLogInfo, "ERR-HAN-40038", 'Error on querying TMP_PROCESS_ITEMS table ', pError);
                    pCallback(false, err.message, '');
                } else {
                    var tmpDTTCode = new reqLinq(pResult)
                        .GroupBy(function (row) {
                            return row['dtt_code'];
                        });

                    Object.keys(tmpDTTCode).forEach(function (key) {
                        if (UpdatedDTTCode == '')
                            UpdatedDTTCode = key;
                        else
                            UpdatedDTTCode = UpdatedDTTCode + ',' + key;
                    });

                    var auditColUpdate = `SET MODIFIED_DATE_UTC='${reqDateFormatter.GetCurrentDateInUTC(objLogInfo.headers, objLogInfo)}', MODIFIED_CLIENTIP ='${objLogInfo.CLIENTIP}',MODIFIED_TZ='${objLogInfo.CLIENTTZ}',MODIFIED_TZ_OFFSET='${objLogInfo.CLIENTTZ_OFFSET}',MODIFIED_BY_SESSIONID='${objLogInfo.SESSION_ID}',`;
                    if (TSQuery != '') {
                        //Replace the $<params> from the query  TSQuery
                        TSQuery = TSQuery.replaceAll(" SET ", auditColUpdate);
                        TSQuery = TSQuery.replaceAll("$PRCT_ID", pTokenId);
                        TSQuery = TSQuery.replaceAll("$MODIFIED_DATE", reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                        TSQuery = TSQuery.replaceAll("$CURRENT_DATE", reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                        TSQuery = TSQuery.replaceAll("$UID", pUId);
                        TSQuery = TSQuery.replaceAll("$STS_ID", pSTSId);
                        TSQuery = TSQuery.replaceAll("$APPSTS_ID", pAppSTSId);
                        TSQuery = TSQuery.replaceAll("$DTT_CODE", pDttCode);
                        TSQuery = TSQuery.replaceAll("$DT_CODE", pDtCode);
                        TSQuery = TSQuery.replaceAll("$LOGIN_NAME", pLoginName);
                        TSQuery = TSQuery.replaceAll("$APPU_ID", pAppUId);
                        TSQuery = TSQuery.replaceAll("$SYSTEM_NAME", pSystemDesc);
                        TSQuery = TSQuery.replaceAll("$S_CODE", pSCode);
                        TSQuery = TSQuery.replaceAll("$S_ID", pSID);
                        TSQuery = TSQuery.replaceAll("$PARENT_S_ID", pPSID);

                    }

                    if (TRNQuery != '') {
                        //Replace the $<params> from the query  trnQuery
                        TRNQuery = TRNQuery.replaceAll(" SET ", auditColUpdate);
                        TRNQuery = TRNQuery.replaceAll("$PRCT_ID", pTokenId);
                        TRNQuery = TRNQuery.replaceAll("$Modified_Date", reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                        TRNQuery = TRNQuery.replaceAll("$CURRENT_DATE", reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                        TRNQuery = TRNQuery.replaceAll("$UID", pUId);
                        TRNQuery = TRNQuery.replaceAll("$STS_ID", pSTSId);
                        TRNQuery = TRNQuery.replaceAll("$APPSTS_ID", pAppSTSId);
                        TRNQuery = TRNQuery.replaceAll("$DTT_CODE", pDttCode);
                        TRNQuery = TRNQuery.replaceAll("$DT_CODE", pDtCode);
                        TRNQuery = TRNQuery.replaceAll("$LOGIN_NAME", pLoginName);
                        TRNQuery = TRNQuery.replaceAll("$APPU_ID", pAppUId);
                        TRNQuery = TRNQuery.replaceAll("$SYSTEM_NAME", pSystemDesc);
                        TRNQuery = TRNQuery.replaceAll("$S_CODE", pSCode);
                        TRNQuery = TRNQuery.replaceAll("$S_ID", pSID);
                        TRNQuery = TRNQuery.replaceAll("$PARENT_S_ID", pPSID);

                    }
                    if (metadata != undefined && metadata != '' && metadata.length) {
                        _PrintInfo(objLogInfo, "metadata is available,Replace $target column values ");
                        _PrintInfo(objLogInfo, "metadata.length is " + metadata.length);
                        for (i = 0; i < metadata.length; i++) {
                            if (TRNQuery.indexOf("$" + metadata[i].TARGET_COLUMN.toLowerCase()) > -1 && metadata[i].DATA_TYPE != 'DATE' && (metadata[i].DATA_TYPE == 'TEXT' || metadata[i].DATA_TYPE == 'NUMBER')) {
                                TRNQuery = TRNQuery.replaceAll("$" + metadata[i].TARGET_COLUMN.toLowerCase(), ModelItem[metadata[i].TARGET_COLUMN]);
                            } else if (TRNQuery.indexOf("$" + metadata[i].TARGET_COLUMN.toUpperCase()) > -1 && metadata[i].DATA_TYPE != 'DATE' && (metadata[i].DATA_TYPE == 'TEXT' || metadata[i].DATA_TYPE == 'NUMBER')) {
                                TRNQuery = TRNQuery.replaceAll("$" + metadata[i].TARGET_COLUMN.toUpperCase(), ModelItem[metadata[i].TARGET_COLUMN]);
                            } else if (((TRNQuery.indexOf("$" + metadata[i].TARGET_COLUMN.toUpperCase()) > -1) || (TRNQuery.indexOf("$" + metadata[i].TARGET_COLUMN.toLowerCase()) > -1)) && (metadata[i].DATA_TYPE == 'DATE' || metadata[i].DATA_TYPE == 'DATETIME')) {
                                TRNQuery = TRNQuery.replaceAll("$" + metadata[i].TARGET_COLUMN.toUpperCase(), reqDateFormatter.ConvertDate(ModelItem[metadata[i].TARGET_COLUMN], header));
                            } else {
                                TRNQuery = TRNQuery.replaceAll("$" + metadata[i].TARGET_COLUMN.toLowerCase(), ModelItem[metadata[i].TARGET_COLUMN]);
                            }
                        }
                    }
                    //Auto Query
                    if (pMode == 'A') {
                        if (TSQuery != '') {
                            var CondQuery = " AND LOCKED_BY= '$UID';";
                            CondQuery = CondQuery.replace("$UID", pUId);
                        }
                    }

                    reqAsync.series({
                        stmtone: function (parCallback) {
                            // Execute TS QUERY
                            _PrintInfo(objLogInfo, 'TSQuery Start Time :' + reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                            if (TSQuery != '')
                                //Execute TS Query
                                reqTranDBHelper.ExecuteSQLQuery(pTranSess, TSQuery, objLogInfo, function callback(pRes, pErr) {
                                    _PrintInfo(objLogInfo, 'TSQuery End Time :' + reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                                    if (pErr)
                                        _PrintError(objLogInfo, "ERR-HAN-40039", 'Error on execute TSQuery ', pErr);
                                    parCallback(pErr, pRes);
                                });
                        },
                        stmttwo: function (parCallback) {
                            // Execute PRPF TRN QUERY
                            if (TRNQuery != '')
                                //Execute TRN Query
                                reqTranDBHelper.ExecuteSQLQuery(pTranSess, TRNQuery, objLogInfo, function callback(pRes, pErr) {
                                    if (pErr)
                                        _PrintError(objLogInfo, "ERR-HAN-40040", 'Error on executing TRNQuery ', pErr);
                                    parCallback(pErr, pRes);
                                });
                        },
                        stmtfour: function (parCallback) {
                            //Marked Updated Rows as "Y" in TMP_UPDATE_TS_IDS Table
                            if (UpdatedDTTCode != '') {
                                //After execute  trn and ts  update the TMP_FINAL_ITEMS table record flag='Y' with condtions token id and dtt_code 
                                var FlagQuery = "UPDATE TMP_FINAL_ITEMS SET FLAG='Y' WHERE DTT_CODE='" + pDttCode + "' AND PRCT_ID ='" + pTokenId + "'"; // TS_ID IN (SELECT TS_ID FROM TMP_FINAL_ITEMS WHERE DTT_CODE='" + pDttCode + "'  AND PRCT_ID ='" + pTokenId + "')";
                                reqTranDBHelper.ExecuteSQLQuery(pTranSess, FlagQuery, objLogInfo, function callback(pRes, pErr) {
                                    if (pErr)
                                        _PrintError(objLogInfo, "ERR-HAN-40041", 'Error on executing TMP_FINAL_ITEMS query ', pErr);
                                    parCallback(pErr, pRes);
                                });
                            } else
                                parCallback(null, null);
                        }
                    },
                        function (err, results) {
                            if (err == null) { // Handle Process eq query
                                if (results.stmtone.rowCount == 0 && results.stmttwo.rowCount == 0)
                                    pCallback(false, null, 'No eligible record available in TS and TRN');
                                else if (results.stmtone.rowCount == 0 && results.stmttwo.rowCount > 0)
                                    pCallback(false, null, 'No eligible record available in TS');
                                else if (results.stmtone.rowCount > 0 && results.stmttwo.rowCount == 0)
                                    pCallback(false, null, 'No eligible record available in TRN');
                                else
                                    pCallback(results.stmttwo, null, null); //return only trn query response
                            } else
                                pCallback(false, err.message, null);
                        });
                }
            } catch (error) {
                _PrintError(objLogInfo, "ERR-HAN-40042", "Error on _PrepareUpdateQuery() function ", error);
                pCallback(false, "Error on _PrepareUpdateQuery() function " + error.message, null);
            }
        });
    } catch (error) {
        _PrintError(objLogInfo, "ERR-HAN-40043", "Error on _PrepareUpdateQuery() ", error);
        pCallback(false, "Error on _PrepareUpdateQuery() function " + error.message, null);
    }
}

function _InsertTransactionComments(pSTPC_ID, pCommentText, pTokenId, pAppSTSId, pUId, pDtCode, pDttCode, pLoginName, pTranSess, objLogInfo, pCallback) {
    try {
        //Prepare TRANSACTION_COMMENTS Table
        var arrTableTC = [];
        var strQry = "SELECT TFI.TS_ID FROM TMP_FINAL_ITEMS TFI INNER JOIN TMP_PROCESS_ITEMS TPI ON TPI.ITEM_ID=TFI.TRN_ID AND TPI.DTT_CODE = TFI.DTT_CODE WHERE TPI.PRCT_ID ='" + pTokenId + "'";
        reqTranDBHelper.ExecuteSQLQuery(pTranSess, strQry, objLogInfo, function callback(pResult, pError) {
            try {
                if (pError) {
                    return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40044', 'Error on executing TMP_FINAL_ITEMS query ', pError, null, pCallback);
                } else {
                    for (var i = 0; i < pResult.rows.length; i++) {
                        var InsertRow = pResult.rows[i];
                        var objRow = {};
                        if (InsertRow['ts_id'] != null && InsertRow['ts_id'] != undefined)
                            objRow['TS_ID'] = InsertRow['ts_id'];
                        objRow['STPC_ID'] = pSTPC_ID;
                        objRow['COMMENT_TEXT'] = pCommentText;
                        objRow['PRCT_ID'] = pTokenId;
                        objRow['CREATED_BY'] = pUId;
                        objRow['CREATED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo);
                        objRow['CREATED_BY_STS_ID'] = pAppSTSId;
                        objRow['CREATED_BY_NAME'] = pLoginName;
                        objRow['DT_CODE'] = pDtCode;
                        objRow['DTT_CODE'] = pDttCode;
                        objRow['CREATED_TZ'] = objLogInfo.CLIENTTZ;
                        objRow['CREATED_TZ_OFFSET'] = objLogInfo.CLIENTTZ_OFFSET;
                        objRow['CREATED_BY_SESSIONID'] = objLogInfo.SESSION_ID;
                        objRow['CREATED_CLIENTIP'] = objLogInfo.CLIENTIP;

                        arrTableTC.push(objRow);
                    }
                    if (arrTableTC.length > 0) {
                        //insert the value into TRANSACTION_COMMENTS table
                        reqTranDBHelper.InsertTranDBWithAudit(pTranSess, 'TRANSACTION_COMMENTS', arrTableTC, objLogInfo, function callbackInsertTranDB(pResult, pError) {
                            pResult.rowCount = (pResult.length != undefined && pResult.length > 0) ? pResult.length : 0;
                            var respObj = {
                                Data: pResult,
                                Status: 'SUCCESS'
                            };
                            return _PrepareAndSendCallback(respObj, '', '', null, null, pCallback);
                        });
                    } else
                        return _PrepareAndSendCallback('SUCCESS', '', '', null, null, pCallback);
                }
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40045', 'Error in _InsertTransactionComments()', error, null, pCallback);
            }
        });
    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40046', 'Error in _InsertTransactionComments()', error, null, pCallback);
    }
}

function _PrepareProcessQuery(pTranSess, pTRNQuery, pQueryType, pAppId, pDTCode, pDTTCode, pTokenId, pApprId, pLogin_Name, pActionId, pUId, pSTSID, pAppSTSId, pAppUId, pSystemDesc, pSCode, pSID, pPSID, objLogInfo, pCallback) {
    try {

        var auditColUpdate = ` SET MODIFIED_DATE_UTC='${reqDateFormatter.GetCurrentDateInUTC(objLogInfo.headers, objLogInfo)}', MODIFIED_CLIENTIP ='${objLogInfo.CLIENTIP}',MODIFIED_TZ='${objLogInfo.CLIENTTZ}',MODIFIED_TZ_OFFSET='${objLogInfo.CLIENTTZ_OFFSET}',MODIFIED_BY_SESSIONID='${objLogInfo.SESSION_ID}',`;
        reqAsync.parallel({
            stmtone: function (parCb) {
                if (pTRNQuery != '' && pQueryType == 'P') {
                    pTRNQuery = pTRNQuery.replaceAll(" SET ", auditColUpdate);
                    pTRNQuery = pTRNQuery.replaceAll("$PRCT_ID", pTokenId);
                    pTRNQuery = pTRNQuery.replaceAll("$WFTPA_ID", pActionId);
                    pTRNQuery = pTRNQuery.replaceAll("$UID", pUId);
                    pTRNQuery = pTRNQuery.replaceAll("$STS_ID", pSTSID);
                    pTRNQuery = pTRNQuery.replaceAll("$APPSTS_ID", pAppSTSId);
                    pTRNQuery = pTRNQuery.replaceAll("$APP_ID", pAppId);
                    pTRNQuery = pTRNQuery.replaceAll("$DT_CODE", pDTCode);
                    pTRNQuery = pTRNQuery.replaceAll("$DTT_CODE", pDTTCode);
                    pTRNQuery = pTRNQuery.replaceAll("$APPR_ID", pApprId);
                    pTRNQuery = pTRNQuery.replaceAll("$CURRENT_DATE", reqDateFormatter.GetTenantCurrentDateTime(objLogInfo.headers, objLogInfo));
                    pTRNQuery = pTRNQuery.replaceAll("$LOGIN_NAME", pLogin_Name);
                    pTRNQuery = pTRNQuery.replaceAll("$APPU_ID", pAppUId);
                    pTRNQuery = pTRNQuery.replaceAll("$SYSTEM_NAME", pSystemDesc);
                    pTRNQuery = pTRNQuery.replaceAll("$S_CODE", pSCode);
                    pTRNQuery = pTRNQuery.replaceAll("$S_ID", pSID);
                    pTRNQuery = pTRNQuery.replaceAll("$PARENT_S_ID", pPSID);

                    //Execute Tran Query
                    reqTranDBHelper.ExecuteSQLQuery(pTranSess, pTRNQuery, objLogInfo, function callback(pRes, pErr) {
                        try {
                            if (pErr)
                                _PrintError(objLogInfo, "ERR-HAN-40047", 'Error on executing TRNQuery ', pErr);
                            parCb(pErr, pRes);
                        } catch (error) {
                            _PrintError(objLogInfo, "ERR-HAN-40048", "Error in _PrepareProcessQuery() ", error);
                            parCb(error, null);
                        }
                    });
                } else
                    parCb(null, null);
            },
            stmttwo: function (parCb) {
                //Marked Updated Rows as "Y" in TFI Table
                var FlagQuery = " UPDATE TMP_FINAL_ITEMS SET FLAG='Y' WHERE DTT_CODE='$DTT_CODE' AND PRCT_ID ='$PRCT_ID'";

                //Replace Flag Query
                FlagQuery = FlagQuery.replace("$DTT_CODE", pDTTCode);
                FlagQuery = FlagQuery.replace("$PRCT_ID", pTokenId);
                reqTranDBHelper.ExecuteSQLQuery(pTranSess, FlagQuery, objLogInfo, function callback(pRes, pErr) {
                    try {
                        if (pErr)
                            _PrintError(objLogInfo, "ERR-HAN-40049", 'Error on executing TMP_FINAL_ITEMS query ', pErr);
                        parCb(pErr, pRes);
                    } catch (error) {
                        _PrintError(objLogInfo, "ERR-HAN-40050", "Error in _PrepareProcessQuery() ", error);
                        parCb(error, null);
                    }
                });
            }
        },
            function (err, results) {
                //Results are all ready, containing the results of two different queries
                if (err == null)
                    _PrepareAndSendCallback('SUCCESS', null, '', null, null, pCallback);
                else
                    _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40051', 'Error on _PrepareProcessQuery() ', err, null, pCallback);
            });
    } catch (error) {
        _PrepareAndSendCallback('FAILURE', 'ERR-HAN-40052', 'Error on _PrepareProcessQuery() ', error, null, pCallback);
    }
}

// function _FormStringCondition(pString) {
//     if (pString == '')
//         return '';
//     var strValues = pString.split(',');
//     var strTemp = '';
//     for (var i = 0; i < strValues.length; i++)
//         strTemp = strTemp + "'" + strValues[i] + "'";
//     return strTemp;
// }

//Get current date 
function _ToDate(str) {
    return reqDateFormatter.GetCurrentDate(header);
}

//Print error function 
function _PrintError(objLogInfo, pErrCode, pMessage, pError) {
    reqInsHelper.PrintError('WFUpdateHelper', pError, pErrCode, objLogInfo, pMessage);
}

//Print info function
function _PrintInfo(objLogInfo, pMessage) {
    reqInsHelper.PrintInfo('WFUpdateHelper', pMessage, objLogInfo);
}

// Prepare callback object
function _PrepareAndSendCallback(pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
    var status = pData.Status ? pData.Status : pData;
    var rowCount = pData.Data ? pData.Data.rowCount : 0;
    var blnSuccess = (status == 'SUCCESS') ? true : false;
    var objCallback = {
        Status: status,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning,
        rowCount: rowCount
    };
    return pCallback(objCallback, blnSuccess);
}

module.exports = {
    WFUpdate: WFUpdate
};