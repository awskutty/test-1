/****
 * Api_Name     : /ChangeStatus
 * Description  : To change the status of transaction data
 * Last_Error_Code : ERR-HAN-40052
 ****/

// Require dependency
var reqExpress = require('express');
var reqHashTable = require('jshashtable');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqWFUpdateHelper = require('../../../../torus-references/common/serviceHelper/WFUpdateHelper');
var reqWFSelectHelper = require('../../../../torus-references/common/serviceHelper/WFSelectHelper');
var reqSrvHelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqSendMessage = require('../../../../torus-references/communication/core/SendMessage');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormat = require('dateformat');
var router = reqExpress.Router();
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');

// Service Declaration
router.post('/ChangeStatus', function callbackChangeStatus(appRequest, appResponse) {
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
            var mSession;
            var objLogInfo = pLogInfo;
            pLogInfo = null;
            _PrintInfo("ChangeStatus Start Time :" + reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo));

            // Close event handling when client closes the api request
            appResponse.on('close', function () {
                reqTranDBHelper.CallRollback(mSession);
                reqLogWriter.EventUpdate(objLogInfo);
            });
            appResponse.on('finish', function () {
                reqTranDBHelper.CallRollback(mSession);
            });
            appResponse.on('end', function () {
                reqTranDBHelper.CallRollback(mSession);
            });

            objLogInfo.PROCESS = 'ChangeStatus-Handler';
            objLogInfo.ACTION_DESC = 'ChangeStatus';
            objLogInfo.USER_NAME = pSessionInfo.LOGIN_NAME;
            objLogInfo.SYSTEM_TYPE = pSessionInfo.ST_CODE;
            objLogInfo.CLUSTER_CODE = pSessionInfo.CLUSTER_CODE;
            objLogInfo.HANDLER_CODE = 'CHANGE_TRAN_USING_WF';
            appResponse.setHeader('Content-Type', 'plain/text');

            // Global variable declaration
            var strWftpaId = '';
            var strStpcId = '';
            var strComment = '';
            var strNeedComment = '';
            var strTokenId = '';
            var strAppId = '';
            var strUId = '';
            var strAppSTSId = '';
            var strSTSId = '';
            var strAppRoles = '';
            var strDTCode = '';
            var strDTTCode = '';
            var strDSCode = '';
            var strEventCode = '';
            var strAppUId = '';
            var strSCode = '';
            var strSystemDesc = '';
            var strLoginName = '';
            var strSelRow = '';
            var metadata = '';
            var ModelItem = '';
            var strSId = '';
            var strPSId = '';
            var strEmailID = '';
            var strMobileNo = '';
            var arrTMPPI = [];
            var strInputParam = appRequest.body.PARAMS;
            var pHeaders = appRequest.headers;
            var mDepCas;
            var mCltCas;
            var count = 0;
            var objLogInfo;
            var strFilters = '';
            var strSearchParams = '';
            var arrSearchInfo = [];
            var strReleaseLock = 'Y';
            try {
                // Initialize params
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus, pError) {
                    if (pInputStatus.Status == 'SUCCESS') { // Initialize param without error
                        _PrintInfo('Initializing Transaction DB');
                        //Get DB connection 
                        _InitializeTrnDB(pHeaders, function callbackInitializeDB(pStatus) {
                            if (pStatus.toUpperCase() != 'SUCCESS') {
                                _PrintError("ERR-CODE", "Error in _InitializeTrnDB() ", pStatus);
                                return _SendResponse('FAILURE ', 'ERR-CODE', 'Error in _InitializeTrnDB() ', null, null);
                            }
                            var arrRow = JSON.parse(strSelRow);
                            _PrintInfo('Tran DB initialized successfully. Selected rows count - ' + arrRow.length);

                            //Prepare TMP_FILTER_PARAMS for Search params from qppRequest
                            if (strSearchParams != '') {
                                var objParams = JSON.parse(strSearchParams);
                                _PrintInfo('Search Param available for change status');
                                for (var i = 0; i < objParams.length; i++) {
                                    var rowSearchParam = objParams[i];
                                    if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '') {
                                        continue;
                                    }
                                    if (rowSearchParam.Operator == undefined && rowSearchParam.Operator == '')
                                        rowSearchParam.operator = '=';
                                    var htBetweenFrom = new reqHashTable();
                                    if (rowSearchParam.OPERATOR.toLowerCase() == 'between' && rowSearchParam.VALUE.toString != '' && rowSearchParam.TOVALUE.toString != '') {
                                        htBetweenFrom.put('OPERATOR', '>=');
                                        htBetweenFrom.put('TMPFP_VALUE', rowSearchParam.VALUE);
                                        htBetweenFrom.put('DATA_TYPE', rowSearchParam.DATA_TYPE);
                                        htBetweenFrom.put('BINDING_NAME', rowSearchParam.BINDING_NAME);
                                        htBetweenFrom.put('ISSEARCH', 'Y');
                                        arrSearchInfo.push(htBetweenFrom);

                                        var htBetweenTo = new reqHashTable();
                                        htBetweenTo.put("BINDING_NAME", rowSearchParam.BINDING_NAME);
                                        htBetweenTo.put("OPERATOR", '<=');
                                        htBetweenTo.put("DATA_TYPE", rowSearchParam.DATA_TYPE);
                                        htBetweenTo.put("TMPFP_VALUE", rowSearchParam.TOVALUE);
                                        htBetweenTo.put("ISSEARCH", 'Y');
                                        arrSearchInfo.push(htBetweenTo);
                                        continue;
                                    }
                                    if (rowSearchParam.OPERATOR.toLowerCase() == 'between' && rowSearchParam.VALUE.toString != '' && rowSearchParam.TOVALUE.toString != '') {
                                        htBetweenFrom.put('OPERATOR', '>=');
                                        htBetweenFrom.put('TMPFP_VALUE', rowSearchParam.VALUE);
                                        htBetweenFrom.put('DATA_TYPE', rowSearchParam.DATA_TYPE);
                                        htBetweenFrom.put('BINDING_NAME', rowSearchParam.BINDING_NAME);
                                        htBetweenFrom.put('ISSEARCH', 'Y');
                                        arrSearchInfo.push(htBetweenFrom);

                                        var htBetweenTo = new reqHashTable();
                                        htBetweenTo.put("BINDING_NAME", rowSearchParam.BINDING_NAME);
                                        htBetweenTo.put("OPERATOR", '<=');
                                        htBetweenTo.put("DATA_TYPE", rowSearchParam.DATA_TYPE);
                                        htBetweenTo.put("TMPFP_VALUE", rowSearchParam.TOVALUE);
                                        htBetweenTo.put("ISSEARCH", 'Y');
                                        arrSearchInfo.push(htBetweenTo);
                                        continue;
                                    }
                                    htBetweenFrom.put("BINDING_NAME", rowSearchParam.BINDING_NAME);
                                    htBetweenFrom.put("DATA_TYPE", rowSearchParam.DATA_TYPE);
                                    htBetweenFrom.put("TMPFP_VALUE", rowSearchParam.VALUE);
                                    htBetweenFrom.put("OPERATOR", rowSearchParam.OPERATOR);
                                    htBetweenFrom.put("GROUP_NO", 0);
                                    htBetweenFrom.put("ISSEARCH", 'Y');
                                    arrSearchInfo.push(htBetweenFrom);
                                    rowSearchParam = null;
                                }
                                strSearchParams = null;
                            }

                            //Prepare TMP_FILTER_PARAMS for FILTERS  from qppRequest

                            if (strFilters != '') {
                                _PrintInfo('Filter Param available for change status');
                                var resDS = JSON.parse(strFilters);
                                for (var j = 0; j < resDS.length; j++) {
                                    var rowFilter = resDS[j];

                                    if (rowFilter.BINDING_VALUE == undefined || rowFilter.BINDING_VALUE == null || rowFilter.BINDING_VALUE == '')
                                        continue;

                                    var strDataType = 'NUMBER';
                                    if (rowFilter.DATA_TYPE != '')
                                        strDataType = rowFilter.DATA_TYPE;

                                    var htSrchInfo = new reqHashTable();
                                    htSrchInfo.put('BINDING_NAME', rowFilter.BINDING_NAME);
                                    htSrchInfo.put('DATA_TYPE', strDataType);
                                    htSrchInfo.put('TMPFP_VALUE', rowFilter.BINDING_VALUE);
                                    htSrchInfo.put('OPERATOR', rowFilter.OPRTR);
                                    htSrchInfo.put('GROUP_NO', 0);
                                    htSrchInfo.put('CONJ_OPERATOR', (rowFilter.CONJ_OPERATOR == null) ? "" : rowFilter.CONJ_OPERATOR);
                                    htSrchInfo.put('ISSEARCH', 'N');

                                    arrSearchInfo.push(htSrchInfo);
                                    rowFilter = null;
                                }
                            }
                            //Checking Selected Item
                            if (arrRow.length) {
                                count = 0;
                                var strError = '';
                                arrTMPPI = [];
                                for (var k = 0; k < arrRow.length; k++) {
                                    var row = arrRow[k];
                                    //Get dt_code, dtt_code and itemid 
                                    _FindItemId(row, function callbackFindItemId(pDTCode, pDTT_CODE, pITEMID, pStatusObj) {
                                        var objRow = {};
                                        strDTTCode = pDTT_CODE;
                                        objRow['dt_code'] = pDTCode;
                                        objRow['dtt_code'] = pDTT_CODE;
                                        objRow['item_id'] = pITEMID;
                                        objRow['created_by'] = strUId;
                                        objRow['created_date'] = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                                        objRow['prct_id'] = strTokenId;
                                        arrTMPPI.push(objRow);
                                        objRow = null;
                                        count++;

                                        if (pStatusObj.Status == 'SUCCESS' && count == arrRow.length) {
                                            if (strError != '') {
                                                return _SendResponse('FAILURE', 'ERR-HAN-40054', strError, null, null);
                                            } else {
                                                _CallWFUpdate(arrTMPPI);
                                            }
                                        } else {
                                            strError = strError + pStatusObj.ErrorMsg;
                                            if (count == arrRow.length)
                                                return _SendResponse('FAILURE', 'ERR-HAN-40053', strError, null, null);
                                        }
                                    });
                                }
                            } else {
                                _CallWFUpdate(arrTMPPI);
                            }
                        });
                    } else {
                        // Initialize param with error
                        _SendResponse(pInputStatus.Status, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                    }
                });
            } catch (error) {
                reqTranDBHelper.Commit(mSession, false, function (res) {
                    _SendResponse('FAILURE', 'ERR-HAN-40001', 'Error on WFUpdate Initialization ', error, null);
                });
            }

            //Get  dep,clt and trn db connection 
            function _InitializeTrnDB(pHeaders, pCallback) {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                    mDepCas = pClient;
                    reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                        mCltCas = pCltClient;
                        objLogInfo.cltClient = pCltClient;
                        reqTranDBHelper.GetTranDBConn(pHeaders, true, function (pSession) {
                            mSession = pSession;
                            pSession = null;
                            if (strTokenId == '') {
                                reqAuditLog.GetProcessToken(mSession, objLogInfo, function (err, prct_id) {
                                    try {
                                        if (err) {
                                            _PrintError("ERR-CODE", "Error in GetProcessToken() ", err);
                                            return pCallback('Failure');
                                        }
                                        strTokenId = prct_id;
                                        pCallback('Success');

                                    } catch (error) {
                                        _PrintError("ERR-CODE", "Error in GetProcessToken() ", error);
                                        pCallback('Failure');
                                    }
                                });
                            }
                        });
                    });
                });
            }

            function _CallWFUpdate(pTMPI) {
                try {
                    var arrTMPPI = pTMPI;
                    pTMPI = null;
                    if (arrTMPPI.length) {
                        //Selected Record Case
                        // Insert  Records into TMP_PROCESS_ITEMS that are eligible  for change status 
                        _PrintInfo('SELECTED UPDATE CONTEXT. Insert values into TMP_PROCESS_ITEMS');
                        reqTranDBHelper.InsertTranDB(mSession, 'TMP_PROCESS_ITEMS', arrTMPPI, objLogInfo, function callbackInsertTmpProcessItems(pResult, pErr) {
                            try {
                                if (pErr) {
                                    reqTranDBHelper.Commit(mSession, false, function (res) {
                                        _SendResponse('FAILURE', 'ERR-HAN-40002', 'Error on inserting TMP_PROCESS_ITEMS', pErr, null);
                                    });
                                } else {
                                    // call wf update helper file
                                    reqWFUpdateHelper.WFUpdate(strDTCode, strDTTCode, strWftpaId, strEventCode, strReleaseLock, strAppId, strTokenId, strUId, strAppSTSId, strSTSId, strAppRoles, reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo), strStpcId, strNeedComment, strComment, mSession, mDepCas, strLoginName, strAppUId, strSystemDesc, strSCode, objLogInfo, pHeaders, metadata, ModelItem, strSId, strPSId, function callbackWFUpdate(pStatus, pBlnStatus) {
                                        try {
                                            if (pBlnStatus) {
                                                _PrintInfo('Successfully completed the WFUpdate()');
                                                _PrintInfo('Updating COMM_PROCESS_DATA...');
                                                //check communication setup
                                                _UpdateCommProcessData(function callbackCommProcessData() {
                                                    bCompleted = true;
                                                    _PrintInfo('ChangeStatus service successfully completed...');
                                                    //Delete all tmp table values 
                                                    reqTranDBHelper.DeleteTranDB(mSession, 'TMP_PROCESS_ITEMS', {
                                                        prct_id: strTokenId
                                                    }, objLogInfo, function (result) {
                                                        reqTranDBHelper.DeleteTranDB(mSession, 'TMP_FINAL_ITEMS', {
                                                            prct_id: strTokenId
                                                        }, objLogInfo, function (result) {
                                                            reqTranDBHelper.Commit(mSession, true, function (res) {
                                                                var respObj = {
                                                                    Data: pStatus,
                                                                    Status: 'SUCCESS'
                                                                };
                                                                _SendResponse(respObj, null, null, null, null);
                                                            });
                                                        });
                                                    });
                                                });
                                            } else {
                                                _PrintInfo('Error on WFUpdate() and Rollback the Transactionscope');
                                                reqTranDBHelper.Commit(mSession, false, function (res) {
                                                    _SendResponse(pStatus.Status, pStatus.ErrorCode, pStatus.ErrorMsg, pStatus.Error, pStatus.Warning);
                                                });
                                            }
                                        } catch (error) {
                                            reqTranDBHelper.Commit(mSession, false, function (res) {
                                                _SendResponse('FAILURE', 'ERR-HAN-40003', 'Error on _CallWFUpdate function', error, null);
                                            });
                                        }
                                    });
                                }
                            } catch (error) {
                                reqTranDBHelper.Commit(mSession, false, function (res) {
                                    _SendResponse('FAILURE', 'ERR-HAN-40004', 'Error on _CallWFUpdate() function', error, null);
                                });
                            }
                        });
                    } else {
                        //selected record not available call bulk change status mode
                        //BULK UPDATE CONTEXT - CALL WF SELECT
                        _PrintInfo('BULK UPDATE CONTEXT');
                        strInputParam['BULK_UPDATE'] = 'Y';
                        strInputParam['TOKEN_ID'] = strTokenId;
                        //Bulk update mode call wfselect to prepate insert for TMP_PROCESS_ITEMS Table
                        reqWFSelectHelper.WFSelect(1, arrSearchInfo, strInputParam, pSessionInfo, mSession, mDepCas, mCltCas, objLogInfo, pHeaders, function callbackWFSelect(pResult) {
                            try {
                                //call wfupdate helper function 
                                reqWFUpdateHelper.WFUpdate(strDTCode, strDTTCode, strWftpaId, strEventCode, strReleaseLock, strAppId, strTokenId, strUId, strAppSTSId, strSTSId, strAppRoles, reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo), strStpcId, strNeedComment, strComment, mSession, mDepCas, strLoginName, strAppUId, strSystemDesc, strSCode, objLogInfo, pHeaders, metadata, ModelItem, strSId, strPSId, function callbackWFUpdate(pStatus, pBlnStatus) {
                                    if (pBlnStatus) {
                                        // check communication setup
                                        _UpdateCommProcessData(function callbackCommProcessData() {
                                            try {
                                                bCompleted = true;
                                                _PrintInfo('Change status completed successfully');
                                                //Delete all TMP table
                                                reqTranDBHelper.DeleteTranDB(mSession, 'TMP_PROCESS_ITEMS', {
                                                    prct_id: strTokenId
                                                }, objLogInfo, function (result) {
                                                    reqTranDBHelper.DeleteTranDB(mSession, 'TMP_FINAL_ITEMS', {
                                                        prct_id: strTokenId
                                                    }, objLogInfo, function (result) {
                                                        reqTranDBHelper.Commit(mSession, true, function (res) {
                                                            var respObj = {
                                                                Data: pStatus,
                                                                Status: 'SUCCESS'
                                                            };
                                                            _SendResponse(respObj, null, null, null, null);
                                                        });
                                                    });
                                                });
                                            } catch (error) {
                                                reqTranDBHelper.Commit(mSession, false, function (res) {
                                                    _SendResponse('FAILURE', 'ERR-HAN-40005', 'Error on _CallWFUpdate function', error, null);
                                                });
                                            }
                                        });
                                    } else {
                                        _PrintInfo(pStatus.Status);
                                        reqTranDBHelper.Commit(mSession, false, function (res) {
                                            _SendResponse(pStatus.Status, pStatus.ErrorCode, pStatus.ErrorMsg, pStatus.Error, pStatus.Warning);
                                        });
                                    }
                                });
                            } catch (error) {
                                reqTranDBHelper.Commit(mSession, false, function (res) {
                                    _SendResponse('FAILURE', 'ERR-HAN-40006', 'Error on _CallWFUpdate function', error, null);
                                });
                            }
                        });
                    }
                } catch (error) {
                    reqTranDBHelper.Commit(mSession, false, function (res) {
                        _SendResponse('FAILURE', 'ERR-HAN-40007', 'Error on _CallWFUpdate() function', error, null);
                    });
                }
            }


            //Get Item Id, dt_code ,dtt_code  function 
            function _FindItemId(pRow, pCallback) {
                _PrintInfo('Finding item id based dt_code, dtt_code, trn_id values.');
                var TempDT_CODE = '';
                var TempDTT_CODE = '';
                var TempITEMID = 0;
                var obj = {};
                try {
                    if (pRow['dt_code'] != undefined && pRow['dt_code'] != '')
                        TempDT_CODE = pRow['dt_code'].toString();
                    _PrintInfo('DT Code is ' + TempDT_CODE);
                    if (pRow['atmt_trn_id'] != undefined && pRow['atmt_trn_id'] != '') {
                        TempITEMID = pRow['atmt_trn_id'];
                        if (pRow['atmt_dtt_code'] != undefined && pRow['atmt_dtt_code'] != '')
                            TempDTT_CODE = pRow['atmt_dtt_code'].toString();
                        _PrintInfo('Returning atmt_trn_id and atmt_dtt_code values.');
                        obj = _PrepareCallbackObject('SUCCESS', '', '', '', null, null);
                        pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID, obj);
                    } else if (pRow['trn_id'] != undefined && pRow['trn_id'] != '') {
                        TempITEMID = parseInt(pRow['trn_id']);
                        if (pRow['dtt_code'] != undefined && pRow['dtt_code'] != '')
                            TempDTT_CODE = pRow['dtt_code'].toString();
                        _PrintInfo('Returning trn_id and dtt_code values.');
                        obj = _PrepareCallbackObject('SUCCESS', '', '', '', null, null);
                        pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID, obj);
                    } else {
                        //auto qry mode
                        //Get  Keycolumn and using that get itemid from selected row
                        TempDTT_CODE = pRow['dtt_code'].toString();
                        _PrintInfo('Finding key column from dtt_code ' + TempDTT_CODE);
                        reqSrvHelper.GetKeyColumn(mDepCas, strAppId, TempDT_CODE, TempDTT_CODE, objLogInfo, function callbackGetKeyColumn(pDTTDetail) {
                            try {
                                if (pDTTDetail.Status == 'SUCCESS') {
                                    var str = pDTTDetail.Data.split(',');
                                    var strKeyclmn = str[1];
                                    TempITEMID = pRow[strKeyclmn.toLowerCase()];
                                    _PrintInfo('Found key column id using GetKeyColumn name from dtt code');
                                    obj = _PrepareCallbackObject('SUCCESS', '', '', '', null, null);
                                    pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID, obj);
                                } else
                                    pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID, pDTTDetail);
                            } catch (error) {
                                obj = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40008', 'Error on _FindItemId() ', error, null);
                                pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID, obj);
                            }
                        });

                    }
                } catch (error) {
                    obj = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40009', 'Error on _FindItemId() ', error, null);
                    pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID, obj);
                }
            }

            //Get communication setup
            function _UpdateCommProcessData(pCallback) {
                try {
                    var strCommQuery = "SELECT   TRN_ID,'" + strDTCode + "'  DT_CODE,DTT_CODE,'" + strTokenId + "' PRCT_ID,'" + strWftpaId + "' WFTPA_ID,'N' FROM_SCHEDULER,'" + strUId + "' CREATED_BY,'" + reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo) + "' CREATED_DATE , 'N' IS_PROCESSED FROM TMP_FINAL_ITEMS WHERE FLAG='Y' AND PRCT_ID='" + strTokenId + "'";
                    reqTranDBHelper.ExecuteSQLQuery(mSession, strCommQuery, objLogInfo, function callbackCommQuery(pCommData, pError) {
                        strCommQuery = null;
                        if (pError) {
                            _PrintError("ERR-HAN-40010", "Error on _UpdateCommProcessData() ", pError);
                            pCallback('SUCCESS');
                            //check communication setup
                        } else if (pCommData) {
                            // convert list of object to list of hashtable
                            //if communication setup available Prepare and send mail after status updated completed
                            var arrCommProcessData = _PrepareCommProcessData(pCommData);
                            if (arrCommProcessData.length) {
                                var params = appRequest.body.PARAMS;
                                params.USER_EMAIL = strEmailID;
                                params.USER_MOBILE = strMobileNo;
                                params.APP_ID = strAppId;
                                params.SESSION_ID = appRequest.body.SESSION_ID;
                                delete objLogInfo.cltClient;
                                reqSendMessage.SendMailFromAction(params, appRequest.headers, arrCommProcessData, objLogInfo);
                                arrCommProcessData = null;
                                params = null;
                                pCommData = null;
                                strMobileNo = null;
                                strEmailID = null;
                                appRequest.body.PARAMS = null;
                                pCallback('SUCCESS');
                            } else
                                pCallback('SUCCESS');
                        } else {
                            //if communication setup not found return callback
                            pCallback('SUCCESS');
                        }
                    });
                } catch (error) {
                    _PrintError("ERR-HAN-40011", "Error on _UpdateCommProcessData() ", error);
                    pCallback('SUCCESS');
                }
            }

            function _PrepareCommProcessData(plstCommData) {
                try {
                    var arrCPD = [];
                    for (var i = 0; i < plstCommData.rows.length; i++) {
                        var row = plstCommData.rows[i];
                        var objCPD = {
                            trn_id: row['trn_id'],
                            dt_code: strDTCode,
                            dtt_code: strDTTCode,
                            wftpa_id: strWftpaId,
                            event_code: strEventCode,
                            from_scheduler: 'N',
                            created_by: strUId,
                            created_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                            is_processed: 'N'
                        };
                        arrCPD.push(objCPD);
                        objCPD = null;
                        row = null;

                    }
                    plstCommData = null;
                    return arrCPD;
                } catch (error) {
                    _PrintError('ERR-HAN-40012', 'Error on _PrepareCommProcessData() ', error);
                }
            }

            //Prepare the params from request 
            function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
                var obj = {};
                try {
                    //Prepare Client Side Params
                    // var SessionId = '';
                    // if (pClientParam['SESSION_ID'] != undefined && pClientParam['SESSION_ID'] != '')
                    //     SessionId = pClientParam['SESSION_ID'];

                    if (pClientParam['WFTPA_ID'] != undefined && pClientParam['WFTPA_ID'] != '')
                        strWftpaId = pClientParam['WFTPA_ID'].toString();

                    // if (pClientParam['VWFTPA_ID'] != undefined && pClientParam['VWFTPA_ID'] != '')
                    //     strVWftpaId = pClientParam['VWFTPA_ID'].toString();

                    if (pClientParam['STPC_ID'] != undefined && pClientParam['STPC_ID'] != '')
                        strStpcId = pClientParam['STPC_ID'].toString();

                    if (pClientParam['COMMENT'] != undefined && pClientParam['COMMENT'] != '')
                        strComment = pClientParam['COMMENT'].toString();

                    if (pClientParam['NEED_COMMENT'] != undefined && pClientParam['NEED_COMMENT'] != '')
                        strNeedComment = pClientParam['NEED_COMMENT'].toString();

                    if (pClientParam['TOKEN_ID'] != undefined && pClientParam['TOKEN_ID'] != '')
                        strTokenId = pClientParam['TOKEN_ID'].toString();

                    if (pClientParam['DT_CODE'] != undefined && pClientParam['DT_CODE'] != '')
                        strDTCode = pClientParam['DT_CODE'].toString();

                    if (pClientParam['DTT_CODE'] != undefined && pClientParam['DTT_CODE'] != '')
                        strDTTCode = pClientParam['DTT_CODE'].toString();

                    if (pClientParam['DS_CODE'] != undefined && pClientParam['DS_CODE'] != '')
                        strDSCode = pClientParam['DS_CODE'].toString();
                    objLogInfo.DSCODE = strDSCode;

                    if (pClientParam['EVENT_CODE'] != undefined && pClientParam['EVENT_CODE'] != '')
                        strEventCode = pClientParam['EVENT_CODE'].toString();

                    if (pClientParam['JSON_DATASET'] != undefined && pClientParam['JSON_DATASET'] != '')
                        strSelRow = pClientParam['JSON_DATASET'].toString();

                    if (pClientParam['META_DATA'] != undefined && pClientParam['META_DATA'] != '')
                        metadata = pClientParam['META_DATA'];

                    if (pClientParam['MODEL_ITEM'] != undefined && pClientParam['MODEL_ITEM'] != '')
                        ModelItem = pClientParam['MODEL_ITEM'];

                    if (pClientParam.FILTERS != undefined && pClientParam.FILTERS != '')
                        strFilters = pClientParam.FILTERS;

                    if (pClientParam['RELEASE_LOCK'] != undefined && pClientParam['RELEASE_LOCK'] != '')
                        strReleaseLock = pClientParam['RELEASE_LOCK'];

                    if (pClientParam.SEARCHPARAMS != undefined && pClientParam.SEARCHPARAMS != '')
                        strSearchParams = pClientParam.SEARCHPARAMS;
                    // Initializze Session level params
                    var Params = pSessionInfo;

                    if (Params.U_ID != undefined && Params.U_ID != '')
                        strUId = Params.U_ID;

                    if (Params.APP_STS_ID != undefined && Params.APP_STS_ID != '')
                        strAppSTSId = Params.APP_STS_ID;

                    if (Params.STS_ID != undefined && Params.STS_ID != '')
                        strSTSId = Params.STS_ID;

                    if (Params.S_ID != undefined && Params.S_ID != '')
                        strSId = Params.S_ID;

                    if (Params.PARENT_S_ID != undefined && Params.PARENT_S_ID != '')
                        strPSId = Params.PARENT_S_ID;

                    if (Params.APP_ID != undefined && Params.APP_ID != '')
                        strAppId = Params.APP_ID;

                    if (Params.APPU_ID != undefined && Params.APPU_ID != '')
                        strAppUId = Params.APPU_ID;

                    if (Params.APP_USER_ROLES != undefined && Params.APP_USER_ROLES != '')
                        strAppRoles = Params.APP_USER_ROLES;

                    if (Params.LOGIN_NAME != undefined && Params.LOGIN_NAME != '')
                        strLoginName = Params.LOGIN_NAME;

                    if (Params.S_DESC != undefined && Params.S_DESC != '')
                        strSystemDesc = Params.S_DESC;

                    if (Params.S_CODE != undefined && Params.S_CODE != '')
                        strSCode = Params.S_CODE;

                    if (Params.USER_EMAIL != undefined && Params.USER_EMAIL != '')
                        strEmailID = Params.USER_EMAIL;

                    if (Params.USER_MOBILE != undefined && Params.USER_MOBILE != '')
                        strMobileNo = Params.USER_MOBILE;
                    pClientParam = null;
                    pSessionInfo = null;
                    obj = _PrepareCallbackObject('SUCCESS', '', '', '', null, null);
                    return pCallback(obj);
                } catch (error) {
                    obj = _PrepareCallbackObject('FAILURE', '', 'ERR-HAN-40013', 'Error on _InitializeParams()', error, null);
                    return pCallback(obj);
                }
            }


            //Print error function 
            function _PrintError(pErrCode, pMessage, pError) {
                reqInstanceHelper.PrintError('WFUpdate', objLogInfo, pErrCode, pMessage, pError);
            }

            //Print info function
            function _PrintInfo(pMessage) {
                reqInstanceHelper.PrintInfo('WFUpdate', pMessage, objLogInfo);
            }

            // Prepare callback object
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


            //send response 
            function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
                if (objLogInfo.cltClient) {
                    delete objLogInfo.cltClient;
                }
                var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
                _PrintInfo("ChangeStatus End Time :" + reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo), "yyyy-mmm-dd HH:MM:ss TT");
        if (pError || pErrorMsg) {
            strProcessStatus = 'FAILURE';
        }
        strProcessStatus = null;
        clearVariable();
        return reqInstanceHelper.SendResponse('WFUpdate', appResponse, pResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);

    }

            function clearVariable() {
        pSessionInfo = null;
        strWftpaId = null;
        strWftpaId = null;
        strStpcId = null;
        strComment = null;
        strNeedComment = null;
        strTokenId = null;
        strAppId = null;
        strUId = null;
        strAppSTSId = null;
        strSTSId = null;
        strAppRoles = null;
        strDTCode = null;
        strDTTCode = null;
        strDSCode = null;
        strEventCode = null;
        strAppUId = null;
        strSCode = null;
        strSystemDesc = null;
        strLoginName = null;
        strSelRow = null;
        metadata = null;
        ModelItem = null;
        strSId = null;
        strPSId = null;
        strEmailID = null;
        strMobileNo = null;
        arrTMPPI = [];
        strInputParam = null;
        pHeaders = null;
        count = null;
        strFilters = null;
        strSearchParams = null;
        arrSearchInfo = null;
        strReleaseLock = null;
    }
});
    } catch (error) {
    return reqInstanceHelper.SendResponse('WFUpdate', appResponse, 'FAILURE', null, 'ERR-HAN-40014', 'Error on ChangeStatus() function ', pError);
}
}); // End of WFUpdate

module.exports = router;