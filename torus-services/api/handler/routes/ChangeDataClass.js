/****
 * Api_Name         : /ChangeSearchTag
 * Description      : To change the attachment data class
 * Last ErrorCode   : ERR-HAN-40723
 ****/

// Require dependencies
var reqExpress = require('express');
var reqSrvHlpr = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var reqAsync = require('async');
var router = reqExpress.Router();
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
// Global variable declaration
var mTranDB;
var mDepCas;

// Service Declaration
router.post('/ChangeDataClass', function (appRequest, appResponse) {
    var objLogInfo = null;
    appResponse.setHeader('Content-Type', 'text/plain');
    var strInputParam = appRequest.body.PARAMS;
    var pHeaders = appRequest.headers;
    var strSubHand = '';
    var strDTCode = '';
    var strDTTCode = '';
    var strAppID = '';
    var strLoginName = '';
    var strSystemDesc = '';
    var strSystemID = '';
    var strUID = '';
    var strSelectedValue = '';
    var strSelectedRow = '';
    var strOrm = 'knex';
    var strCurDataClass = '';

    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'CHANGE_SEARCH_TAG';

        _PrintInfo('Begin');

        try {
            _InitializeDB(pHeaders, function callbackInitializeDB(pStatus) {
                reqAuditLog.GetProcessToken(mTranDB, objLogInfo, function (error, prct_id) {
                    try {
                        if (error) {
                            _PrintError('ERR-CODE', 'Error on _InitializeDB - GetProcessToken() function ', error);
                            return _SendResponse(null, 'ERR-CODE', 'Error in _InitializeDB - GetProcessToken() function ', error, null);
                        }
                        // Initialize params
                        objLogInfo.PROCESS_INFO.PRCT_ID = prct_id;
                        _PrintInfo('Initializing params....');
                        _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                            if (pInputStatus.Status == 'SUCCESS') {
                                // Load Dataclass
                                if (strSubHand == 'LOAD_DATA') {
                                    _PrintInfo("ChangeDataClass - LoadData service called..");
                                    _LoadCDCData(function callbackLoadCDCData(pResult) {
                                        _PrintInfo('Result : ' + pResult.Data);
                                        _SendResponse(pResult.Data, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                                    });
                                } else if (strSubHand == 'SAVE_DATA') { // Save data class
                                    _PrintInfo("ChangeDataClass - SaveData service called..");
                                    _SaveCDCData(function callbackSaveCDCData(pResult) {
                                        return _SendResponse(pResult.Data, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                                    });
                                }
                            } else {
                                // Initialize input failed
                                return _SendResponse(null, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                            }
                        });
                    } catch (error) {
                        _PrintError('ERR-CODE', 'Catch Error on _InitializeDB - GetProcessToken() function ', error);
                        return _SendResponse(null, 'ERR-CODE', 'Error in ChangeDataClass API - Catch GetProcessToken function ', error, null);
                    }
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-HAN-40701', 'Error in ChangeDataClass API function ', error, null);
        }

        // Initialize DB
        function _InitializeDB(pHeaders, pCallback) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                mDepCas = pClient;
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                    mTranDB = pSession;
                    pCallback('Success');
                });
            });
        }

        // Initialize params
        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            try {
                //Prepare Client Side Params
                if (pClientParam['SUB_HAND'] != undefined && pClientParam['SUB_HAND'] != '')
                    strSubHand = pClientParam['SUB_HAND'].toString();

                if (pClientParam['Current_DTCode'] != undefined && pClientParam['Current_DTCode'] != '')
                    strDTCode = pClientParam['Current_DTCode'].toString();

                if (pClientParam['Current_DTTCode'] != undefined && pClientParam['Current_DTTCode'] != '')
                    strDTTCode = pClientParam['Current_DTTCode'].toString();

                if (pClientParam['SelectedValue'] != undefined && pClientParam['SelectedValue'] != '')
                    strSelectedValue = pClientParam['SelectedValue'].toString();

                if (pClientParam['SelectedRow'] != undefined && pClientParam['SelectedRow'] != '')
                    strSelectedRow = pClientParam['SelectedRow'].toString();

                // Initialize Session level params
                if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                    strAppID = pSessionInfo['APP_ID'].toString();

                if (pSessionInfo['LOGIN_NAME'] != undefined && pSessionInfo['LOGIN_NAME'] != '')
                    strLoginName = pSessionInfo['LOGIN_NAME'].toString();

                if (pSessionInfo['SYSTEM_DESC'] != undefined && pSessionInfo['SYSTEM_DESC'] != '')
                    strSystemDesc = pSessionInfo['SYSTEM_DESC'].toString();

                if (pSessionInfo['SYSTEM_ID'] != undefined && pSessionInfo['SYSTEM_ID'] != '')
                    strSystemID = pSessionInfo['SYSTEM_ID'].toString();

                if (pSessionInfo['USER_ID'] != undefined && pSessionInfo['USER_ID'] != '')
                    strUID = pSessionInfo['USER_ID'].toString();

                return _PrepareAndSendCallback('SUCCESS', '', '', null, null, null, pCallback);

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40702', 'Error in _InitializeParams() function', error, null, pCallback);
            }
        }

        // To load the Data class
        function _LoadCDCData(pCallback) {
            var strResult = {};
            var arrDTTInfo = [];

            _PrintInfo('Params are ' + strAppID + ' , ' + strDTCode);
            reqDBInstance.GetTableFromFXDB(mDepCas, 'DT_INFO', ['RELATION_JSON', 'DT_DESCRIPTION'], {
                APP_ID: strAppID,
                DT_CODE: strDTCode
            }, objLogInfo, function callback(pErr, pRes) {
                try {
                    if (pErr) {
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40703', 'Error on getting DT_INFO query ', pErr, null, pCallback);
                    } else {
                        if (pRes.rows.length > 0) {
                            var strRelationJson = pRes.rows[0]['relation_json'];
                            var objRelation = JSON.parse(strRelationJson);

                            // Add default dataclass
                            var objDefault = {
                                dataclass: "Select",
                                classkey: ""
                            };
                            arrDTTInfo.push(objDefault);

                            for (var i = 0; i < objRelation.length; i++)
                                _ParseDTTInfo(objRelation[i], strDTTCode, arrDTTInfo);

                            strResult.Result = JSON.stringify(arrDTTInfo);
                            strResult.CTDesc = strCurDataClass;

                            return _PrepareAndSendCallback('SUCCESS', strResult, '', '', null, null, pCallback);

                        } else
                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40704', '', null, 'DT_INFO not found', pCallback);
                    }
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40705', 'Error in _LoadCDCData() function', error, null, pCallback);
                }
            });
        }

        // To save the data class
        function _SaveCDCData(pCallback) {
            try {
                var strDTDesc = '';
                var objSelectedRow = JSON.parse(strSelectedRow);
                var strOldAtmtDttCode = objSelectedRow[0]['atmt_dtt_code'];
                var strOldAtmtTrnId = objSelectedRow[0]['atmt_trn_id'];
                var strOldDtCode = objSelectedRow[0]['dt_code'];
                var strNodeType = objSelectedRow[0]['node_type'];
                reqDBInstance.GetTableFromFXDB(mDepCas, 'DT_INFO', ['RELATION_JSON', 'DT_DESCRIPTION'], {
                    APP_ID: strAppID,
                    DT_CODE: strOldDtCode
                }, objLogInfo, function callback(pErr, pRes) {
                    try {
                        if (pErr)
                            return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40706', 'Error on getting DT_INFO query execution', null, null, pCallback);
                        else {
                            if (pRes.rows.length > 0) {
                                var strRelationJson = pRes.rows[0]['relation_json'];
                                strDTDesc = pRes.rows[0]['dt_description'];
                                var objRelation = JSON.parse(strRelationJson);
                                switch (strNodeType) {
                                    case "ATMT":
                                        {
                                            if (strOldAtmtDttCode != '') {
                                                _SaveATMTDataClass(strOldDtCode, strOldAtmtDttCode, strOldAtmtTrnId, objRelation, strDTDesc, objSelectedRow[0], function callbackSaveATMTDataClass(pResult) {
                                                    return pCallback(pResult);
                                                });
                                            } else
                                                return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40707', '', null, 'OldATMT DTTCode is not empty', pCallback);
                                            break;
                                        }
                                    case "TRAN":
                                        {
                                            // TODO
                                            break;
                                        }
                                }
                            }
                        }
                    } catch (error) {
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40708', 'Error in _SaveCDCData() function ', error, null, pCallback);
                    }
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40709', 'Error in _SaveCDCData() function', error, null, pCallback);
            }
        }

        // To save atmt data class
        function _SaveATMTDataClass(pOldDtCode, pOldAtmtDttCode, pOldAtmtTrnId, pRelationJson, pDTDesc, pSelectedRow, pCallback) {

            var strNewDTTCode = strSelectedValue;
            var strDTDesc = pDTDesc;
            var strNewDTTDesc = '';
            var blnOldExist = false;

            reqAsync.series({
                DeleteOldTargetTable: function (parCb) {
                    // Delete on old Targettable record
                    _PrintInfo('Deleting old Targettable..');
                    var objOldDTTInfo = reqSrvHlpr.GetTargetTableAndKeyColumn(pRelationJson, pOldAtmtDttCode, objLogInfo);
                    if (objOldDTTInfo.Status == 'SUCCESS') {
                        strOldTargetTable = objOldDTTInfo.Data;
                        if (strOldTargetTable != '') {
                            var str = strOldTargetTable.split(',');
                            if (str.length > 0) {
                                var strOldTargetTable = str[0];
                                var strOldKeyColumn = str[1];
                                blnOldExist = true;

                                var objCond = {};
                                objCond[strOldKeyColumn] = pOldAtmtTrnId;
                                // Delete old Target table record
                                reqTranDBInstance.DeleteTranDB(mTranDB, strOldTargetTable, objCond, objLogInfo, function callbackDeleteTranDB(pResult, pError) {
                                    var obj = {};
                                    if (pError)
                                        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-HAN-40710', 'Error on DeleteOldTargetTable()', pError, null);
                                    else
                                        obj = _PrepareCallbackObject('SUCCESS', null, '', '', null, null);
                                    parCb(null, obj);
                                });
                            }
                        } else {
                            var obj = _PrepareCallbackObject('FAILURE', null, 'ERR-HAN-40711', '', null, 'Old DTT_INFO not found ');
                            parCb(null, obj);
                        }
                    } else
                        parCb(null, objOldDTTInfo);
                },
                InsertNewTargetTable: function (parCb) {
                    // Handle new DTT_Code , Insert New DTT_CODE
                    var obj = {};
                    _PrintInfo('Inserting into new targettable ...');
                    var objNewDTTInfo = reqSrvHlpr.GetTargetTableAndKeyColumn(pRelationJson, strNewDTTCode, objLogInfo);
                    if (objNewDTTInfo.Status == 'SUCCESS') {
                        var strNewTargetTable = objNewDTTInfo.Data;
                        if (strNewTargetTable != '') {
                            var str = strNewTargetTable.split(',');
                            if (str.length > 0) {
                                var strNewTargetTable = str[0]; // Target Table 
                                var strNewKeyColumn = str[1];
                                strNewDTTDesc = str[2]; // DTT Description
                                _InsertTargetTable(strNewTargetTable, pOldDtCode, strDTDesc, strNewDTTCode, strNewDTTDesc, strUID, strLoginName, strSystemID, strSystemDesc, function callbackInsertTargetTable(pResult, pError) {
                                    if (pError) { // failure in _InsertTargetTable()
                                        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-HAN-40712', 'Error on inserting with new targettable', pError, null);
                                        parCb(null, obj);
                                    } else { // Success in _InsertTargetTable()
                                        var KeyColumnID = 0;
                                        if (pResult.length > 0)
                                            KeyColumnID = pResult[0][strNewKeyColumn.toLowerCase()];
                                        _InsertTransactionSet(pSelectedRow['atmt_ts_id'], KeyColumnID, pOldDtCode, strDTDesc, strNewDTTCode, strNewDTTDesc, strUID, strLoginName, strSystemID, strSystemDesc, blnOldExist, function callbackInsertTransactionSet(pTSResult) {
                                            if (pTSResult.Status == 'SUCCESS') {
                                                var TsID = pTSResult.Data;
                                                _InsertTrnAttachments(pSelectedRow['trna_id'], strNewDTTCode, strNewDTTDesc, KeyColumnID, TsID, strUID, strLoginName, function callbackInsertTrnAttachments(pResult, pError) {
                                                    if (pError) // failure in _InsertTrnAttachments()
                                                        obj = _PrepareCallbackObject('FAILURE', null, 'ERR-HAN-40713', 'Error on inserting TRN_ATTACHMENTS table', pError, null);
                                                    else
                                                        obj = _PrepareCallbackObject('SUCCESS', null, '', '', null, null);
                                                    parCb(null, obj);
                                                });
                                            } else // failure in _InsertTransactionSet()
                                            {
                                                obj = _PrepareCallbackObject(pTSResult.Status, null, pTSResult.ErrorCode, pTSResult.ErrorMsg, pTSResult.Error, pTSResult.Warning);
                                                parCb(null, obj);
                                            }
                                        });
                                    }
                                });
                            } else { // Targettable not found
                                obj = _PrepareCallbackObject('FAILURE', null, 'ERR-HAN-40714', '', null, 'New DTT_INFO not found ');
                                parCb(null, obj);
                            }
                        } else { // Targettable not found
                            obj = _PrepareCallbackObject('FAILURE', null, 'ERR-HAN-40715', '', null, 'New DTT_INFO not found ');
                            parCb(null, obj);
                        }
                    } else // Failed in get targettable and keycolumn
                        parCb(null, objNewDTTInfo);
                }
            },
                function (err, results) {
                    var obj = {};
                    if (results.DeleteOldTargetTable.Status == 'SUCCESS' && results.InsertNewTargetTable.Status == 'SUCCESS') // Success case return
                        return _PrepareAndSendCallback('SUCCESS', null, null, null, null, null, pCallback);
                    else { // Failure case return
                        var objStatus = {};
                        if (results.DeleteOldTargetTable.Status == 'FAILURE')
                            objStatus = results.DeleteOldTargetTable;
                        else
                            objStatus = results.InsertNewTargetTable;

                        return _PrepareAndSendCallback(objStatus.Status, null, objStatus.ErrorCode, objStatus.ErrorMsg, objStatus.Error, objStatus.Warning, pCallback);
                    }
                });
        }

        // To insert the targettable
        function _InsertTargetTable(pTargetTable, pDTCode, pDTDesc, pDTTCode, pDTTDesc, pUid, pLoginName, pSystemId, pSystemName, pCallback) {
            reqTranDBInstance.InsertTranDBWithAudit(mTranDB, pTargetTable, [{
                DT_CODE: pDTCode,
                DT_DESCRIPTION: pDTDesc,
                DTT_CODE: pDTTCode,
                DTT_DESCRIPTION: pDTTDesc,
                VERSION_NO: 0,
                CREATED_BY: pUid,
                CREATED_BY_NAME: pLoginName,
                MODIFIED_BY: pUid,
                SYSTEM_ID: pSystemId,
                SYSTEM_NAME: pSystemName,
                STATUS: 'CREATED',
                PROCESS_STATUS: 'CREATED',
                PRCT_ID: objLogInfo.PROCESS_INFO.PRCT_ID,
            }], objLogInfo, function callbackTargetTableInsert(pResult, pError) {
                pCallback(pResult, pError);
            });
        }

        // To insert/update TRANSACTION_SET table
        function _InsertTransactionSet(pAtmtTsId, pNewTranID, pDTCode, pDTDesc, pDTTCode, pDTTDesc, pUid, pLoginName, pSystemId, pSystemName, blnOldDTTExist, pCallback) {

            if (!blnOldDTTExist) { // Insert new record on TarnsactionSet table
                _PrintInfo('Inserting with TRANSACTION_SET with New ID...');
                reqTranDBInstance.InsertTranDBWithAudit(mTranDB, 'TRANSACTION_SET', [{
                    DT_CODE: pDTCode,
                    DT_DESCRIPTION: pDTDesc,
                    DTT_CODE: pDTTCode,
                    DTT_DESCRIPTION: pDTTDesc,
                    TRN_ID: pNewTranID,
                    VERSION_NO: 0,
                    SYSTEM_ID: pSystemId,
                    SYSTEM_NAME: pSystemName,
                    STATUS: 'CREATED',
                    PROCESS_STATUS: 'CREATED',
                    PRCT_ID: objLogInfo.PROCESS_INFO.PRCT_ID,
                }], objLogInfo, function callbackTransactionSetInsert(pResult, pError) {
                    var obj = {};
                    if (pError)
                        obj = _PrepareCallbackObject('FAILURE', 0, 'ERR-HAN-40716', 'Error on inserting with TRANSACTION_SET table', pError, null);
                    else {
                        if (pResult.rows.length > 0)
                            obj = _PrepareCallbackObject('SUCCESS', pResult.rows[0]['ts_id'], 'ERR-HAN-40717', 'Error on inserting with TRANSACTION_SET table', pError, null);
                        else
                            obj = _PrepareCallbackObject('FAILURE', 0, 'ERR-HAN-40718', 'Error on inserting with TRANSACTION_SET table', pError, null);
                    }
                    return pCallback(obj);
                });
            } else { // Update exist record on TransactionSet
                _PrintInfo('Updating the TRANSACTION_SET table with existing ID...');
                reqTranDBInstance.UpdateTranDBWithAudit(mTranDB, 'TRANSACTION_SET', {
                    DTT_CODE: pDTTCode,
                    DTT_DESCRIPTION: pDTTDesc,
                    TRN_ID: pNewTranID,
                    PRCT_ID: objLogInfo.PROCESS_INFO.PRCT_ID,
                }, {
                    TS_ID: pAtmtTsId
                }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                    if (pError)
                        obj = _PrepareCallbackObject('FAILURE', 0, 'ERR-HAN-40719', 'Error on updating with TRANSACTION_SET table', pError, null);
                    else
                        obj = _PrepareCallbackObject('SUCCESS', pAtmtTsId, '', '', null, null);
                    return pCallback(obj);
                });
            }
        }

        // To insert TRN_ATTACHMENTS table
        function _InsertTrnAttachments(pTranaId, pDTTCode, pDTTDesc, pNewTranID, pNewTsID, pUid, pLoginName, pCallback) {
            reqTranDBInstance.UpdateTranDBWithAudit(mTranDB, 'TRN_ATTACHMENTS', {
                ATMT_DTT_CODE: pDTTCode,
                ATMT_TRN_ID: pNewTranID,
                ATMT_TS_ID: pNewTsID
            }, {
                TRNA_ID: pTranaId
            }, objLogInfo, function callbackTrnAttachmentUpdate(pResult, pError) {
                pCallback(pResult, pError);
            });
        }

        // To get the DTTDescription
        function _GetDTTDescription(pAppId, pDttCode, pCallback) {
            if (pDttCode != '') {
                reqDBInstance.GetTableFromFXDB(mDepCas, 'DTT_INFO', ['DTT_DESCRIPTION'], {
                    APP_ID: pAppId,
                    DTT_CODE: pDttCode
                }, objLogInfo, function callback(pError, pResult) {
                    if (pError)
                        _PrintError('ERR-HAN-40720', 'Error on _GetDTTDescription() function ', pError);
                    else {
                        if (pResult.rows.length > 0)
                            return pResult.rows[0]['dtt_description'];
                        else return '';
                    }
                });
            }
        }

        // To parse the DTT_INFO 
        function _ParseDTTInfo(pRelationJson, pDTTCode, arrDTTInfo) {
            try {
                var objRelationJson = pRelationJson;

                // Find and add new dataclass for currently selected DTTCode
                if (objRelationJson.DTT_CODE != pDTTCode && objRelationJson.CATEGORY == 'S') {
                    var objDTT = {};
                    objDTT.dataclass = objRelationJson.DTT_DESCRIPTION;
                    objDTT.classkey = objRelationJson.DTT_CODE;
                    arrDTTInfo.push(objDTT);
                }

                // Find Current DataClass for selected DTTCode
                if (objRelationJson.DTT_CODE == pDTTCode && objRelationJson.CATEGORY == 'S') {
                    strCurDataClass = objRelationJson.DTT_DESCRIPTION;
                }

                // find on child dtt relation
                for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
                    _ParseDTTInfo(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTTCode, arrDTTInfo);
                }
            } catch (error) {
                _PrintError("ERR-HAN-40721", "Error in _ParseDTTInfo() function ", error);
            }
        }

        // To print the Error
        function _PrintError(pErrCode, pMessage, pError) {
            reqInsHelper.PrintError('ChangeSearchTag', objLogInfo, pErrCode, pMessage, pError);
        }

        // To print the information 
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo('ChangeSearchTag', pMessage, objLogInfo);
        }

        // To prepare and send callback object
        function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
            var objCallback = {
                Status: pStatus,
                Data: pData,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            };
            return pCallback(objCallback);
        }

        // To prepare the callback object
        function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning) {
            var objCallback = {
                Status: pStatus,
                Data: pData,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            };
            return objCallback;
        }

        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
            return reqInsHelper.SendResponse('ChangeSearchTag', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }

    });
}); // End of Service

module.exports = router;