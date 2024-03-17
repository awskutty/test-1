/**
 * Description  : Loading data's on listview, treeview and paged data list,
 * Last_Error_code    : ERR-HAN-40168
 * Last changed for   : Locking mode listing mode based on client request.
 */

// Require dependencies
var reqDateFormat = require('dateformat');
var reqLinq = require('node-linq').LINQ;
var reqUtil = require('util');
var reqHashTable = require('jshashtable');
var reqServiceHelper = require('./ServiceHelper');
var reqTranDBHelper = require('../../instance/TranDBInstance');
var reqFXDBInstance = require('../../instance/DBInstance');
var reqSolrHelper = require('../../instance/SolrInstance');
var reqInstanceHelper = require('../../common/InstanceHelper');
var objSpRecordLock = require('./RecordLock');
var reqCacheRedisInstance = require('../../instance/CacheRedisInstance');
var reqEncryptionInstance = require('../../common/crypto/EncryptionInstance');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');
var serviceName = 'WFSelectHelper';

// Get query from qry_info and run tran query
function WFSelect(pRecordsperPage, pSearchInfo, pInputParamJson, pSessionInfo, pTranDB, pCasIns, pCltCas, pLogInfo, pReqHeader, CallbackWFselect) {
    console.log('FXUTCAuditColumn ' + reqDateFormatter.FXUTCAuditColumn());

    var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var cltschemaName;
    if (pCltCas && pCltCas.DbType && pCltCas.DbType === 'NOSQLDB') {
        cltschemaName = pCltCas.Client.keyspace;
    }
    if (pCltCas && pCltCas.DBConn && pCltCas.DBConn.DBType == "pg") {
        cltschemaName = pCltCas.DBConn.Connection.schema.client.config.searchPath;
    } else if (pCltCas && pCltCas.DBConn && pCltCas.DBConn.DBType == "oracledb") {
        cltschemaName = pCltCas.DBConn.Connection.schema.client.config.connection.user;
    }


    var dynamicCore = 'DYNAMIC_CORE';
    var staticCore = 'STATIC_CORE';
    var versionCore = 'AUDITLOG_VERSION_CORE';
    var auditCore = 'AUDIT_LOG_CORE';
    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
        dynamicCore = "TRAN";
        staticCore = 'TRAN_ATMT_CONTENT';
        versionCore = "TRAN_VERSION";
        auditCore = 'TRAN_VERSION_DETAIL';
    }

    var mDSCode = '';
    var mEventCode = '';
    var mWftpaId = '';
    var mTokenId = '';
    var mUID = '';
    var mAppStsId = '';
    var mSId = '';
    var mPSId = '';
    var mAppId = '';
    var mAppUId = '';
    var mAppRoles = '';
    var mLoginName = '';
    var mSystemDesc = '';
    var mSolrSearchName = '';
    var mDTCode = '';
    var mDTTCode = '';
    var mBulkUpdate = '';
    var mCategory = '';
    var mCurrentPageNo = 0;
    var mRecordPerPage = pRecordsperPage;
    var blnCompleted = false;
    var mPRFQuery = '';
    var mPRFQType = '';
    var mPRFQMode = '';
    var mSCode = '';
    var mClusterCode = '';
    var strSelectQuery = '';
    var strListingMode = '';
    var strLockingMode = '';
    var intLockingCount = '';
    var mCasIns = pCasIns;
    var mTranDB = pTranDB;
    var mCltCas = pCltCas;
    var IsSolrSearch = 'N';
    var mTotalRecords = 0;

    var objLogInfo = pLogInfo;
    var intQryCount = 0;
    var intExeCount = 0;
    var strReqHeader = pReqHeader;
    var isCacheEnabled = false;
    var cacheExpireMin = 1;
    var RcrdLclparam = {};


    try {
        _ClearInputParams();
        _InitializeParams(pInputParamJson, pSessionInfo, function callbackInitializeParam(pInputStatus) {
            if (pInputStatus.Status == 'SUCCESS') {
                var arrSearchInfo = [];
                var strKeyColumn = '';
                var strKeyValue = '';
                var strSearchParams = '';
                var strFilters = '';
                var strSolrSearchName = '';

                if (pInputParamJson.KEY_COLUMN != undefined && pInputParamJson.KEY_COLUMN != '')
                    strKeyColumn = pInputParamJson.KEY_COLUMN;

                if (pInputParamJson.KEY_VALUE != undefined && pInputParamJson.KEY_VALUE != '')
                    strKeyValue = pInputParamJson.KEY_VALUE;

                if (pInputParamJson.SEARCHPARAMS != undefined && pInputParamJson.SEARCHPARAMS != '')
                    strSearchParams = pInputParamJson.SEARCHPARAMS;

                if (pInputParamJson.FILTERS != undefined && pInputParamJson.FILTERS != '')
                    strFilters = pInputParamJson.FILTERS;

                if (pInputParamJson.SOLR_SEARCH_NAME != undefined && pInputParamJson.SOLR_SEARCH_NAME != '')
                    strSolrSearchName = pInputParamJson.SOLR_SEARCH_NAME;

                prepareSearchInfo();

                function prepareSearchInfo() {
                    // Prepare TMP_FILTER_PARAMS for Key Column, Key_Value
                    if (strKeyColumn != '' && strKeyValue != '' && strKeyValue != 0) {

                        var strBindingName = '';
                        if (strSolrSearchName == 'SOLR_AUDIT_VER_SEARCH')
                            strBindingName = 'TRN_ID';
                        else if (strSolrSearchName == 'SOLR_AUDIT_SEARCH')
                            strBindingName = 'RECORD_ID';
                        else
                            strBindingName = strKeyColumn;

                        var htSrchInfo = new reqHashTable();
                        htSrchInfo.put('BINDING_NAME', strBindingName);
                        htSrchInfo.put('DATA_TYPE', 'NUMBER');
                        htSrchInfo.put('TMPFP_VALUE', strKeyValue);
                        htSrchInfo.put('OPERATOR', '=');
                        htSrchInfo.put('GROUP_NO', 0);
                        htSrchInfo.put('ISSEARCH', 'Y');
                        arrSearchInfo.push(htSrchInfo);
                        htSrchInfo = null;
                    }

                    //Prepare TMP_FILTER_PARAMS for Search params 
                    if (strSearchParams != '') {
                        var objParams = JSON.parse(strSearchParams);

                        if (strSolrSearchName == 'SOLR_GLOBAL_SEARCH') { // Solr Tag search
                            var blnSearchParam = false;
                            var objSrchParams = [];
                            for (var j = 0; j < objParams.length; j++) {
                                var rowSearchParam = objParams[j];
                                if (rowSearchParam.VALUE != "") // find if any search param without empty, then set the variable as true
                                {
                                    blnSearchParam = true;
                                    objSrchParams.push(rowSearchParam);
                                }
                            }
                            rowSearchParam = null;
                            if (blnSearchParam)
                                objParams = objSrchParams;

                        }



                        for (var i = 0; i < objParams.length; i++) {
                            var rowSearchParam = objParams[i];
                            if (strSolrSearchName == '') { // normal search
                                if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '')
                                    continue;
                            } else // Solr search with blank search
                            {
                                if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '') {
                                    if (strSolrSearchName == 'SOLR_DATA_SEARCH')
                                        continue;
                                    rowSearchParam.VALUE = "*";
                                }
                            }
                            if (rowSearchParam.Operator == undefined && rowSearchParam.Operator == '')
                                rowSearchParam.operator = '=';
                            var htBetweenFrom = new reqHashTable();
                            if ((rowSearchParam.DATA_TYPE != "DATETIME" && rowSearchParam.OPERATOR.toLowerCase() == 'between' && rowSearchParam.VALUE.toString && rowSearchParam.TOVALUE.toString) && (rowSearchParam.DATA_TYPE != "DATE" && rowSearchParam.OPERATOR.toLowerCase() == 'between' && rowSearchParam.VALUE.toString && rowSearchParam.TOVALUE.toString)) {
                                // if (rowSearchParam.OPERATOR.toLowerCase() == 'between' && rowSearchParam.VALUE.toString != '' && rowSearchParam.TOVALUE.toString != '') {
                                htBetweenFrom.put('OPERATOR', '>=');
                                htBetweenFrom.put('TMPFP_VALUE', rowSearchParam.VALUE);
                                htBetweenFrom.put('DATA_TYPE', rowSearchParam.DATA_TYPE);
                                htBetweenFrom.put('BINDING_NAME', rowSearchParam.BINDING_NAME);
                                htBetweenFrom.put('ISSEARCH', 'Y');
                                htBetweenFrom.put("GROUP_NO", 0);
                                arrSearchInfo.push(htBetweenFrom);

                                var htBetweenTo = new reqHashTable();
                                htBetweenTo.put("BINDING_NAME", rowSearchParam.BINDING_NAME);
                                htBetweenTo.put("OPERATOR", '<=');
                                htBetweenTo.put("DATA_TYPE", rowSearchParam.DATA_TYPE);
                                htBetweenTo.put("TMPFP_VALUE", rowSearchParam.TOVALUE);
                                htBetweenTo.put("ISSEARCH", 'Y');
                                htBetweenTo.put("GROUP_NO", 0);
                                arrSearchInfo.push(htBetweenTo);
                                continue;
                            }
                            htBetweenFrom.put("BINDING_NAME", rowSearchParam.BINDING_NAME);
                            htBetweenFrom.put("DATA_TYPE", rowSearchParam.DATA_TYPE);
                            htBetweenFrom.put("TMPFP_VALUE", rowSearchParam.VALUE);
                            htBetweenFrom.put("TMPFPTO_VALUE", rowSearchParam.TOVALUE);
                            if (rowSearchParam.OPERATOR == '&lt;') {
                                rowSearchParam.OPERATOR = '<'
                            } if (rowSearchParam.OPERATOR == '&gt;') {
                                rowSearchParam.OPERATOR = '>'
                            }
                            if (rowSearchParam.OPERATOR == '&lt;=') {
                                rowSearchParam.OPERATOR = '<='
                            }
                            if (rowSearchParam.OPERATOR == '&gt;=') {
                                rowSearchParam.OPERATOR = '>='
                            }
                            if (rowSearchParam.OPERATOR == "&lt;&gt;") {
                                rowSearchParam.OPERATOR = '<>'
                            }
                            htBetweenFrom.put("OPERATOR", rowSearchParam.OPERATOR);
                            htBetweenFrom.put('CONTROL_TYPE', ((rowSearchParam.CONTROL_TYPE != undefined) ? rowSearchParam.CONTROL_TYPE : ""));
                            htBetweenFrom.put("GROUP_NO", 0);
                            htBetweenFrom.put("ISSEARCH", 'Y');
                            arrSearchInfo.push(htBetweenFrom);
                        }
                        rowSearchParam = null;
                        htBetweenFrom = null;
                    }

                    //Prepare TMP_FILTER_PARAMS for FILTERS
                    var resDS;
                    if (strFilters != '') {
                        resDS = JSON.parse(strFilters);
                        for (var i = 0; i < resDS.length; i++) {
                            var rowFilter = resDS[i];
                            if (strSolrSearchName == '') { // normal search
                                if (rowFilter.BINDING_VALUE == undefined || rowFilter.BINDING_VALUE == null || rowFilter.BINDING_VALUE == '')
                                    continue;
                            } else // Solr search with blank search
                            {
                                if (rowFilter.BINDING_VALUE == undefined || rowFilter.BINDING_VALUE == null || rowFilter.BINDING_VALUE == '')
                                    rowFilter.BINDING_VALUE = "*";
                            }
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
                            if (rowFilter.OPRTR == '&lt;') {
                                rowFilter.OPRTR = '<'
                            } if (rowFilter.OPRTR == '&gt;') {
                                rowFilter.OPRTR = '>'
                            }
                            if (rowFilter.OPRTR == '&lt;=') {
                                rowFilter.OPRTR = '<='
                            }
                            if (rowFilter.OPRTR == '&gt;=') {
                                rowFilter.OPRTR = '>='
                            }
                            if (rowFilter.OPRTR == "&lt;&gt;") {
                                rowFilter.OPRTR = '<>'
                            }
                            if (strSolrSearchName.indexOf('AUDIT') > 0)
                                htSrchInfo.put('ISSEARCH', 'Y');
                            else
                                htSrchInfo.put('ISSEARCH', 'N');

                            arrSearchInfo.push(htSrchInfo);
                        }
                        resDS = null;
                        htSrchInfo = null;
                    }
                }

                _PrepareSearch(arrSearchInfo, mRecordPerPage, mCurrentPageNo, mDTCode, mDTTCode, mTokenId, mCasIns, mTranDB, function callbackPrepareSearch(srchInfo, pStatusObj) {
                    if (pStatusObj.Status == 'SUCCESS') {
                        pSearchInfo = srchInfo;
                        // Get Precompiler Query for WFSelect
                        if (mDTTCode != '') { // With DTT_CODE

                            _PrintInfo('Getting query for WF select with DTT_CODE condition');
                            reqFXDBInstance.GetTableFromFXDB(mCasIns, 'qry_info', ['setup_json', 'main_qry_text', 'main_qry_type', 'main_qry_mode', 'listing_mode', 'locking_mode', 'locking_parameter'], {
                                app_id: mAppId,
                                wftpa_id: mWftpaId,
                                event_code: mEventCode,
                                process: 'WF_SELECT',
                                dt_code: mDTCode,
                                dtt_code: mDTTCode
                            }, objLogInfo, function callbackPRFQRY(pError, pResult) {
                                try {
                                    if (pError) {
                                        return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40114", 'Error on QRY_INFO table querying ', pError, null, '', 0, mTokenId, CallbackWFselect);
                                    } else {
                                        if (pResult.rows.length == 0) {
                                            reqFXDBInstance.GetTableFromFXDB(mCasIns, 'qry_info', ['setup_json', 'main_qry_text', 'main_qry_type', 'main_qry_mode', 'listing_mode', 'locking_mode', 'locking_parameter'], {
                                                app_id: mAppId,
                                                wftpa_id: mWftpaId,
                                                event_code: 'DEFAULT',
                                                process: 'WF_SELECT',
                                                dt_code: mDTCode,
                                                dtt_code: mDTTCode,
                                                ds_code: mDSCode
                                            }, objLogInfo, function callbackPRFQRY(pError, pResult) {
                                                try {
                                                    if (pError) {
                                                        return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40115', 'Error on QRY_INFO table querying ', pError, null, '', 0, mTokenId, CallbackWFselect);
                                                    } else {
                                                        if (pResult.rows.length == 0) {
                                                            return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40116', "Query not found " + mAppId + " - " + mWftpaId, null, '', '', 0, mTokenId, CallbackWFselect);
                                                        } else
                                                            _GetPrepareQuery(pResult, pSearchInfo, function callbackGetPrepareQuery(pQueryStatus) {
                                                                _NullInpuParams();
                                                                return CallbackWFselect(pQueryStatus);
                                                            });
                                                    }
                                                } catch (error) {
                                                    return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40117', "Error in WFSelect() function ", error, '', '', 0, mTokenId, CallbackWFselect);
                                                }
                                            });
                                        } else
                                            _GetPrepareQuery(pResult, pSearchInfo, function callbackGetPrepareQuery(pQueryStatus) {
                                                _NullInpuParams();
                                                return CallbackWFselect(pQueryStatus);
                                            });
                                    }
                                } catch (error) {
                                    return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40118', "Error in WFSelect() function ", error, '', '', 0, mTokenId, CallbackWFselect);
                                }
                            });
                        } else { // without DTT_CODE
                            _PrintInfo('Getting query for WF select without EVENT_CODE, WFTPA_ID condition');
                            reqFXDBInstance.GetTableFromFXDB(mCasIns, 'qry_info', ['setup_json', 'main_qry_text', 'main_qry_type', 'main_qry_mode', 'listing_mode', 'locking_mode', 'locking_parameter'], {
                                app_id: mAppId,
                                wftpa_id: mWftpaId,
                                event_code: mEventCode,
                                process: 'WF_SELECT'
                            }, objLogInfo, function callbackPRFQRY(pError, pResult) {
                                try {
                                    if (pError) {
                                        _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40119", 'Error on QRY_INFO table querying ', pError, null, '', 0, mTokenId, CallbackWFselect);
                                    } else {
                                        if (pResult.rows.length == 0) {
                                            reqFXDBInstance.GetTableFromFXDB(mCasIns, 'qry_info', ['setup_json', 'main_qry_text', 'main_qry_type', 'main_qry_mode', 'listing_mode', 'locking_mode', 'locking_parameter'], {
                                                app_id: mAppId,
                                                wftpa_id: mWftpaId,
                                                event_code: 'DEFAULT',
                                                process: 'WF_SELECT'
                                            }, objLogInfo, function callbackPRFQRY(pError, pResult) {
                                                try {
                                                    if (pError) {
                                                        return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40120", 'Error on QRY_INFO table querying ', pError, null, '', 0, mTokenId, CallbackWFselect);
                                                    } else {
                                                        if (pResult.rows.length == 0) {
                                                            _PrintInfo('Query not found ' + mAppId + " - " + mWftpaId);
                                                            _NullInpuParams();
                                                            return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40121", null, null, "Error : Query not found " + mAppId + " - " + mWftpaId, '', 0, mTokenId, CallbackWFselect);
                                                        } else
                                                            _GetPrepareQuery(pResult, pSearchInfo, function callbackGetPrepareQuery(pQueryStatus) {
                                                                _NullInpuParams();
                                                                return CallbackWFselect(pQueryStatus);
                                                            });
                                                    }
                                                } catch (error) {
                                                    _NullInpuParams();
                                                    return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40122', "Error in WFSelect() function ", error, '', '', 0, mTokenId, CallbackWFselect);
                                                }
                                            });
                                        } else
                                            _GetPrepareQuery(pResult, pSearchInfo, function callbackGetPrepareQuery(pQueryStatus) {
                                                _NullInpuParams();
                                                return CallbackWFselect(pQueryStatus);
                                            });
                                    }
                                } catch (error) {
                                    _NullInpuParams();
                                    return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40123', "Error in WFSelect() function ", error, '', '', 0, mTokenId, CallbackWFselect);
                                }
                            });
                        }
                    } else { // PrepareSearch failure case 
                        return CallbackWFselect(pStatusObj, '', 0, mTokenId);
                    }
                }); // End of preparesearch

            } else // Initialize input failure case
                return _PrepareAndSendCallback(pInputStatus.Status, [], '', pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning, '', 0, mTokenId, CallbackWFselect);
        });
    } catch (error) {
        _NullInpuParams();
        return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40124", "Error in WFSelect() function ", error, '', '', 0, mTokenId, CallbackWFselect);
    }

    // Convert string to Date format
    function ToDate(pDate) {
        // var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss")
        var Restr = reqDateFormatter.ConvertDate(pDate.toString(), pReqHeader);
        return Restr;
    }

    // Get prepare query with replacement of session values
    function _GetPrepareQuery(pResult, pSearchInfo, pCallback) {
        try {
            intQryCount = pResult.rows.length;
            intExeCount = 0;
            for (var i = 0; i < pResult.rows.length; i++) {
                if (pResult.rows[i].setup_json) {
                    isCacheEnabled = JSON.parse(pResult.rows[i].setup_json).NEED_CACHE;
                    cacheExpireMin = JSON.parse(pResult.rows[i].setup_json).CACHE_TIME;
                }
                _DeleteTmpChildSTS();
                mPRFQuery = pResult.rows[i].main_qry_text;
                mPRFQType = pResult.rows[i].main_qry_type;
                mPRFQMode = pResult.rows[i].main_qry_mode;
                if (pInputParamJson.ListingMode) {
                    strListingMode = pInputParamJson.ListingMode;
                } else if (pResult.rows[i].listing_mode != undefined && pResult.rows[i].listing_mode != '') {
                    strListingMode = pResult.rows[i].listing_mode;
                }
                if (pInputParamJson.LockingMode) {
                    strLockingMode = pInputParamJson.LockingMode;
                } else if (pResult.rows[i].locking_mode != undefined && pResult.rows[i].locking_mode != '') {
                    strLockingMode = pResult.rows[i].locking_mode;
                }
                if (pInputParamJson.LockingParameter) {
                    intLockingCount = pInputParamJson.LockingParameter;
                } else if (pResult.rows[i].locking_parameter != undefined && pResult.rows[i].locking_parameter != '') {
                    intLockingCount = pResult.rows[i].locking_parameter;
                }


                mPRFQuery = mPRFQuery.replaceAll("$APPU_ID", mAppUId)
                mPRFQuery = mPRFQuery.replaceAll("$APPR_ID", _FormStringCondition(mAppRoles));
                mPRFQuery = mPRFQuery.replaceAll("$STS_ID", mAppStsId);
                mPRFQuery = mPRFQuery.replaceAll("$TOKEN_ID", mTokenId);


                mPRFQuery = mPRFQuery.replaceAll("$WFTPA_ID", mWftpaId);
                mPRFQuery = mPRFQuery.replaceAll("$UID", mUID);
                mPRFQuery = mPRFQuery.replaceAll("$APP_ID", mAppId);
                mPRFQuery = mPRFQuery.replaceAll("$DT_CODE", "'" + mDTCode + "'");
                mPRFQuery = mPRFQuery.replaceAll("$DTT_CODE", "'" + mDTTCode + "'");
                mPRFQuery = mPRFQuery.replaceAll("$CURRENT_DATE", "'" + reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo) + "'");
                mPRFQuery = mPRFQuery.replaceAll("$LOGIN_NAME", "'" + mLoginName + "'");
                mPRFQuery = mPRFQuery.replaceAll("$SYSTEM_NAME", "'" + mSystemDesc + "'");
                mPRFQuery = mPRFQuery.replaceAll("$S_CODE", "'" + mSCode + "'");
                mPRFQuery = mPRFQuery.replaceAll("$S_ID", "'" + mSId + "'");
                mPRFQuery = mPRFQuery.replaceAll("$PARENT_S_ID", "'" + mPSId + "'");

                if (mPRFQType != '' && mPRFQType.toLocaleUpperCase().trim() == 'P')
                    _ExecutePRFQuery(mPRFQuery, CallbackWFselect);
                else if (mPRFQType != '' && mPRFQType.toLocaleUpperCase().trim() != 'S') {
                    if (mPRFQuery.indexOf("$AND") >= 0) {
                        //Call FN_SIMPLE_SERACH_CONDITION
                        var resConditions = _FormSimpleSearchCondition(pSearchInfo);
                        var strSearchCondition = resConditions.SearchCondition;
                        if (mPRFQType == 'I') {
                            if (strSearchCondition != '') {
                                var strCondition = "AND TS.GROUP_ID IN ( SELECT DISTINCT GROUP_ID FROM TRANSACTION_SET TS WHERE '" + strSearchCondition + "')' ";
                                mPRFQuery = mPRFQuery.replaceAll("$AND", strCondition);
                            } else {
                                mPRFQuery = mPRFQuery.replaceAll("$AND", " ");
                            }

                        } else if (mPRFQType == 'D') {
                            if (strSearchCondition != '')
                                mPRFQuery = mPRFQuery.replaceAll("$AND", " AND " + strSearchCondition);
                            else
                                mPRFQuery = mPRFQuery.replaceAll("$AND", " ");
                        }
                        strSearchCondition = null;
                        resConditions = null;
                    } else if (mPRFQuery.indexOf("$CRITERIA") >= 0) {
                        //Call FN_SIMPLE_SERACH_CONDITION
                        var resConditions = _FormSimpleSearchCondition(pSearchInfo);
                        var strSearchCondition = resConditions.SearchCondition;
                        if (strSearchCondition != '') {
                            mPRFQuery = mPRFQuery.replaceAll("$CRITERIA", " WHERE " + strSearchCondition);
                        } else {
                            mPRFQuery = mPRFQuery.replaceAll("$CRITERIA", " ");
                        }
                        strSearchCondition = null;
                        resConditions = null;
                    }

                    if (mPRFQuery != '') //  Trace.WriteLine(strPRFQuery)
                        _ExecutePRFQuery(mPRFQuery, CallbackWFselect);

                } else if (mPRFQType == '' || mPRFQType.toLocaleUpperCase().trim() == 'S') {
                    //Manual query context
                    _GetManualQuery(pSearchInfo, function callbackGetManualQuery(pResultObject) {
                        return pCallback(pResultObject);
                    });
                }
            }
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40125', 'Error in _GetPrepareQuery() function ', error, null, '', 0, mTokenId, pCallback);
        }
    }

    function _ExecutePRFQuery(mPRFQuery, pCallbackObject) {
        _NullInpuParams();
        return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40126', 'Error in _ExecutePRFQuery() function ', null, null, '', 0, mTokenId, pCallbackObject);
    }

    // Forming string condition with single quotes
    function _FormStringCondition(pString) {
        if (pString == '')
            return '';
        var strValues = pString.split(',');
        var strTemp = '';
        for (var i = 0; i < strValues.length; i++) {
            if (strTemp == '')
                strTemp = strTemp + "'" + strValues[i] + "'";
            else
                strTemp = strTemp + ",'" + strValues[i] + "'";
        }
        strValues = null;
        return strTemp;
    }

    // Handling manual query
    function _GetManualQuery(pSearchInfo, pCallback) {
        try {
            var intDTTCount = 1;
            _PrintInfo('Get Relational_json for PRF Query > select relation_json from dt_info where app_id=' + mAppId + 'and dt_code=' +
                mDTCode);
            var strInfoStmt = 'select relation_json from dt_info where app_id=? and dt_code=? ;';
            reqFXDBInstance.GetTableFromFXDB(mCasIns, 'dt_info', ['relation_json'], {
                app_id: mAppId,
                dt_code: mDTCode
            }, objLogInfo, async function callbackInfoStmt(pError, pResult) {
                try {
                    if (pError) {
                        return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40127", 'Error on querying DT_INFO', pError, 'DT_INFO not found for DT_CODE' + mDTCode, '', 0, '', pCallback);
                    } else {
                        var REL_JSON = reqServiceHelper.GetRelationJSON(pResult);
                        // Get DTT Count from DTT Relations
                        if (REL_JSON.length > 0 && REL_JSON[0].CHILD_DTT_RELEATIONS.length > 0)
                            intDTTCount = 2;

                        if (mPRFQMode != '' && mPRFQMode == 'M' && intDTTCount == 1) {

                            //Call FN_SELECT_SERACH_CONDITION
                            var strSearchCondition = await _FormSelectSearchCondition(pSearchInfo);

                            if (mPRFQuery.indexOf("$WHERE") >= 0) {
                                if (strSearchCondition != undefined && strSearchCondition != '')
                                    strSelectQuery = mPRFQuery.replaceAll("$WHERE", reqUtil.format(" WHERE %s $ANDLOCK", strSearchCondition));
                                else
                                    strSelectQuery = mPRFQuery.replaceAll("$WHERE", " $WHERELOCK");
                            } else if (mPRFQuery.indexOf("$AND") >= 0) {
                                if (strSearchCondition != undefined && strSearchCondition != '')
                                    strSelectQuery = mPRFQuery.replaceAll("$AND", reqUtil.format(" AND %s $ANDLOCK", strSearchCondition));
                                else
                                    strSelectQuery = mPRFQuery.replaceAll("$AND", " $ANDLOCK");
                            } else if (mPRFQuery.indexOf("$STARTWITH") >= 0) {
                                if (strSearchCondition != undefined && strSearchCondition != '')
                                    strSelectQuery = mPRFQuery.replaceAll("$STARTWITH", reqUtil.format(" START WITH % $WHERELOCK", strSearchCondition));
                                else
                                    strSelectQuery = mPRFQuery.replaceAll("$STARTWITH", " $WHERELOCK");
                            } else
                                strSelectQuery = mPRFQuery;
                        } else {
                            // Auto query context

                            //Call FN_SIMPLE_SERACH_CONDITION
                            var resConditions = _FormSimpleSearchCondition(pSearchInfo);
                            var strTRNCondition = resConditions.TRNCondition;
                            var strTSCondition = resConditions.TSFilterCondition;
                            var strSearchCondition = resConditions.SearchCondition;

                            if (mPRFQuery.indexOf("$WHERE") >= 0) {
                                if (strSearchCondition != '')
                                    strSelectQuery = mPRFQuery.replaceAll("$WHERE", reqUtil.format(" WHERE %s $AND", strSearchCondition));
                                //strSelectQuery = mPRFQuery.replace("$WHERE", reqUtil.format(" WHERE %s $AND", strSearchCondition))
                                else
                                    strSelectQuery = mPRFQuery;

                                if (strTRNCondition != '') {
                                    strSelectQuery = strSelectQuery.replaceAll("$AND", reqUtil.format(" AND %s $ANDLOCK", strTRNCondition));
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERE", reqUtil.format(" WHERE %s $ANDLOCK", strTRNCondition));
                                } else {
                                    strSelectQuery = strSelectQuery.replaceAll("$AND", "$ANDLOCK");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERE", "$WHERELOCK");
                                }
                            } else if (mPRFQuery.indexOf("$AND") >= 0) {
                                if (strSearchCondition != '')
                                    strSelectQuery = mPRFQuery.replaceAll("$AND", reqUtil.format(" AND %s $AND", strSearchCondition));
                                else
                                    strSelectQuery = mPRFQuery;

                                if (strTRNCondition != '')
                                    strSelectQuery = strSelectQuery.replaceAll("$AND", reqUtil.format(" AND %s $ANDLOCK", strTRNCondition));
                                else
                                    strSelectQuery = strSelectQuery.replaceAll("$AND", "$ANDLOCK");
                            } else if (mPRFQuery.indexOf("$CRITERIA") >= 0) {
                                if (strSearchCondition != '')
                                    strSelectQuery = mPRFQuery.replaceAll("$CRITERIA", reqUtil.format(" WHERE %s $AND", strSearchCondition));
                                else
                                    strSelectQuery = mPRFQuery;

                                if (strTRNCondition != '') {
                                    strSelectQuery = strSelectQuery.replaceAll("$AND", reqUtil.format(" AND %s $ANDLOCK", strTRNCondition));
                                    strSelectQuery = strSelectQuery.replaceAll("$CRITERIA", reqUtil.format(" WHERE %s $ANDLOCK", strTRNCondition));
                                } else {
                                    strSelectQuery = strSelectQuery.replaceAll("$AND", "$ANDLOCK");
                                    strSelectQuery = strSelectQuery.replaceAll("$CRITERIA", "$ANDLOCK");
                                }
                            } else
                                strSelectQuery = mPRFQuery;


                            if (strSelectQuery.indexOf("$TSCONDITION") >= 0) {
                                if (strTSCondition != '')
                                    strSelectQuery = strSelectQuery.replace("$TSCONDITION", " WHERE " + strTSCondition);
                                else strSelectQuery = strSelectQuery.replace("$TSCONDITION", " ");
                            }

                            resConditions = null;
                            strTRNCondition = null;
                            strTSCondition = null;
                            strSearchCondition = null;
                        }

                        //Handle listing modes
                        if (strListingMode == 'ALL_SYS') {
                            //TO DO 
                            //CALL SP_CHILD_GET_STS
                        }
                        _HandleListingMode(strListingMode, strSelectQuery, mUID, mAppStsId, mAppId, function callbackHandleListingMode(res) {
                            if (res.Status == 'SUCCESS') {
                                // Record Lock
                                var strLockingQry = res;

                                if (strLockingMode != '' && strLockingMode != 'HIERARCHICAL_SELECT' && strLockingMode != 'SINGLE_SELECT' && strListingMode.indexOf("USR_LOCKED") == -1) {
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    var strLockingQry = strSelectQuery;
                                    strLockingQry = strLockingQry.replaceAll("$LOCKEDBYFILTER_AND", " ");
                                    strLockingQry = strLockingQry.replaceAll("$LOCKEDBYFILTER_WHERE", " ");

                                    objSpRecordLock.RecordLock(mAppId, mTokenId, mUID, mAppStsId, 'LOCK_LOAD', strLockingMode, intLockingCount, reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo), strLockingQry, mTranDB, mLoginName, objLogInfo, pReqHeader, mRecordPerPage, mCurrentPageNo, RcrdLclparam, function callbacklockTran(res) {

                                        strSelectQuery = strSelectQuery.replaceAll("$LOCKEDBYFILTER_AND", " AND LOCKED_BY = '" + mUID + "'");
                                        strSelectQuery = strSelectQuery.replaceAll("$LOCKEDBYFILTER_WHERE", " WHERE LOCKED_BY = '" + mUID + "'");

                                        _ExecuteWFSelectQuery(strSelectQuery, function callbackExecuteWFSelectQuery(pResultObj) {
                                            return pCallback(pResultObj);
                                        });
                                    });
                                } else { // no need of locking mode
                                    // strSelectQuery = strSelectQuery.replaceAll("$LOCKEDBYFILTER_AND", " ");
                                    // strSelectQuery = strSelectQuery.replaceAll("$LOCKEDBYFILTER_WHERE", " ");
                                    strSelectQuery = strSelectQuery.replaceAll("$LOCKEDBYFILTER_AND", " ");
                                    strSelectQuery = strSelectQuery.replaceAll("$LOCKEDBYFILTER_WHERE", " ");
                                    _ExecuteWFSelectQuery(strSelectQuery, function callbackExecuteWFSelectQuery(pResultObj) {
                                        return pCallback(pResultObj);
                                    });
                                }
                            } else // Listing mode failure case
                                return pCallback(res);
                        });
                    }
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40128", "Error in _GetanualQuery() function ", error, null, '', 0, '', pCallback);
                }
            });
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40129", "Error in _GetanualQuery() function ", error, null, '', 0, '', pCallback);
        }
    }

    // Execute the prepared WFSelect query
    function _ExecuteWFSelectQuery(strSelectQuery, pCallbackWFselect) {
        var tblResult = {};
        try {
            tblResult.LockingMode = strLockingMode;
            if (strSelectQuery != '') {
                // Bulk Query update
                strSelectQuery = strSelectQuery.toString().replace(/\r\n/g, '');
                if (mBulkUpdate == 'Y') {
                    var strBulkUpdateQry = "INSERT INTO TMP_PROCESS_ITEMS (PRCT_ID,ITEM_ID,DT_CODE,DTT_CODE,CREATED_BY,CREATED_DATE) " +
                        "SELECT '$TOKEN_ID',TRN_ID,DT_CODE,DTT_CODE,'$UID','$CURRENT_DATE' FROM ($SELECT_QUERY) VW ";
                    strBulkUpdateQry = strBulkUpdateQry.replace("$TOKEN_ID", mTokenId);
                    strBulkUpdateQry = strBulkUpdateQry.replace("$UID", mUID);
                    strBulkUpdateQry = strBulkUpdateQry.replace("$CURRENT_DATE", reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo));
                    strBulkUpdateQry = strBulkUpdateQry.replace("$SELECT_QUERY", strSelectQuery);
                    reqServiceHelper.GetKeyColumn(mCasIns, mAppId, mDTCode, mDTTCode, objLogInfo, function (pDTTDetail) {
                        if (pDTTDetail.Status == 'SUCCESS') { // Success in getKeycolumn
                            var str = pDTTDetail.Data.split(',');
                            var strKeyclmn = str[1];
                            var regEx = new RegExp(strKeyclmn, "i"); // find string with ignore case
                            strBulkUpdateQry = strBulkUpdateQry.replace(regEx, strKeyclmn + ' AS TRN_ID');
                            // To fecth the number data type column as string
                            pLogInfo.fetchAsString = true;
                            reqTranDBHelper.ExecuteSQLQuery(mTranDB, strBulkUpdateQry, pLogInfo, function callback(pResult, pError) {
                                if (pError) {
                                    _NullInpuParams();
                                    return _PrepareAndSendCallback('FAILURE', [], strLockingMode, 'ERR-HAN-40130', null, null, null, IsSolrSearch, mTotalRecords, mTokenId, pCallbackWFselect);
                                } else {
                                    // _NullInpuParams();
                                    return _PrepareAndSendCallback('SUCCESS', [], strLockingMode, '', '', null, null, IsSolrSearch, mTotalRecords, mTokenId, pCallbackWFselect);
                                }

                            });
                        } else {
                            return _PrepareAndSendCallback(pDTTDetail.Status, [], strLockingMode, pDTTDetail.ErrorCode, pDTTDetail.ErrorMsg, pDTTDetail.Error, null, IsSolrSearch, mTotalRecords, mTokenId, pCallbackWFselect);
                        }
                        // failed in ketKeyColumn

                    });

                } else {
                    var rowscount = 0;
                    // var uniquRedisKey = 'TRAN_CACHE~' + reqEncryptionInstance.EncryptPassword(strSelectQuery + mCurrentPageNo);
                    var uniquRedisKey = 'TRAN_CACHE~' + strSelectQuery + mCurrentPageNo;
                    // reqCacheRedisInstance.GetRedisConnection(pReqHeader, function (redisClient) {
                    //     try {
                    //         var redisDB = redisClient['db1']; // db1 for tran cache
                    if (mCurrentPageNo == 0 || mRecordPerPage == 0) {
                        function afterQueryExecution(pError, pResult) {
                            try {
                                var rowscount = 0;
                                if (pError) {
                                    tblResult.ErrorCode = 'ERR-HAN-40131';
                                    tblResult.ErrorMsg = 'Error on _ExecuteWFSelectQuery()';
                                    tblResult.Error = pError;
                                }
                                if (pResult == undefined)
                                    tblResult.QueryResult = [];
                                else {
                                    tblResult.QueryResult = pResult.rows;
                                    rowscount = pResult.rows.length;
                                }
                                _PrintInfo("Returned Rows - " + rowscount);
                                intExeCount++;
                                if (intExeCount == intQryCount) {
                                    DeleteTmpTable(function () {
                                        return _PrepareAndSendCallback('SUCCESS', tblResult.QueryResult, strLockingMode, '', tblResult.ErrorMsg, pError, null, IsSolrSearch, mTotalRecords, mTokenId, pCallbackWFselect);
                                    });

                                }
                            } catch (error) {
                                return _PrepareAndSendCallback('FAILURE', [], strLockingMode, "ERR-HAN-40132", 'Error on _ExecuteWFSelectQuery()', error, null, IsSolrSearch, mTotalRecords, mTokenId, pCallbackWFselect);
                            }
                        }

                        function executeQuery() {
                            try {
                                // Execute query without paging
                                //for number data type floting point issue (so get the value as string)
                                // pLogInfo.fetchAsString=true - This param is used to get number data result as string Ex: 32.45 necomes '32.45'
                                pLogInfo.fetchAsString = true;
                                reqTranDBHelper.ExecuteSQLQuery(mTranDB, strSelectQuery, pLogInfo, function callbackExecuteSQL(pResult, pError) {
                                    try {
                                        if (isCacheEnabled) {
                                            var params = {
                                                db: 'db1',
                                                uniquKey: uniquRedisKey,
                                                expirMin: cacheExpireMin,
                                                value: JSON.stringify(pResult)
                                            };
                                            if (params.expirMin === -1) {
                                                delete params.expirMin;
                                            }
                                            reqCacheRedisInstance.AddCacheToRedis(pReqHeader, params, objLogInfo, function (result) {
                                                try {
                                                    if (result != 'SUCCESS') {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40161', 'Error on SetKeyValWithExpiry', result);
                                                    } else {
                                                        params = null;
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                                    }
                                                } catch (error) {
                                                    params = null;
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40162', 'Error on SetKeyValWithExpiry', error);
                                                }
                                            });
                                            // reqCacheRedisInstance.SetKeyValWithExpiry(redisDB, objLogInfo, uniquRedisKey, JSON.stringify(pResult), cacheExpireMin, function (error, result) {
                                            //     try {
                                            //         if (error) {
                                            //             reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40161', 'Error on SetKeyValWithExpiry', error);
                                            //         } else {
                                            //             reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                            //         }
                                            //     } catch (error) {
                                            //         reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40162', 'Error on SetKeyValWithExpiry', error);
                                            //     }
                                            // });
                                        }
                                        afterQueryExecution(pError, pResult);
                                    } catch (error) {
                                        return _PrepareAndSendCallback('FAILURE', [], strLockingMode, "ERR-HAN-40132", 'Error on _ExecuteWFSelectQuery()', error, null, IsSolrSearch, mTotalRecords, mTokenId, pCallbackWFselect);
                                    }
                                });
                            } catch (error) {
                                _PrintError('ERR-HAN-40163', 'Error on executeQuery', error);
                            }
                        }
                        if (isCacheEnabled) {
                            var params = {
                                db: 'db1',
                                uniquKey: uniquRedisKey
                            };
                            reqCacheRedisInstance.GetCacheFromRedis(pReqHeader, params, objLogInfo, function (result) {
                                try {
                                    if (result) {
                                        afterQueryExecution(null, JSON.parse(result));
                                    } else {
                                        executeQuery();
                                    }
                                } catch (error) {
                                    _PrintError('ERR-HAN-40164', 'Error on GetKeyVal', error);
                                }
                            });
                            // reqCacheRedisInstance.GetKeyVal(redisDB, objLogInfo, uniquRedisKey, function (pError, pResult) {
                            //     try {
                            //         if (pError) {
                            //             executeQuery();
                            //         } else {
                            //             afterQueryExecution(pError, JSON.parse(pResult));
                            //         }
                            //     } catch (error) {
                            //         _PrintError('ERR-HAN-40164', 'Error on GetKeyVal', error);
                            //     }
                            // });
                        } else {
                            executeQuery();
                        }
                    } else {
                        function afterPagingQueryExecution(pError, pResult, pCount) {
                            try {
                                intExeCount++;
                                if (pError) {
                                    tblResult.ErrorCode = 'ERR-HAN-40133';
                                    tblResult.ErrorMsg = 'Error on _ExecuteWFSelectQuery()';
                                    tblResult.Error = pError;
                                }
                                if (pResult == undefined)
                                    tblResult.QueryResult = [];
                                else
                                    tblResult.QueryResult = pResult;
                                if (pCount[0] != null && pCount[0] != undefined) {
                                    tblResult.TotalRecords = (pCount[0].count == undefined) ? "0" : pCount[0].count;
                                    rowscount = (pCount[0].count == undefined) ? "0" : pCount[0].count;
                                    _PrintInfo("Returned Rows - " + rowscount);
                                } else
                                    tblResult.TotalRecords = 0;
                                if (intExeCount == intQryCount) {
                                    DeleteTmpTable(function () {
                                        return _PrepareAndSendCallback('SUCCESS', tblResult.QueryResult, strLockingMode, tblResult.ErrorCode, tblResult.ErrorMsg, pError, null, IsSolrSearch, tblResult.TotalRecords, mTokenId, pCallbackWFselect);
                                    });
                                }
                            } catch (error) {
                                return _PrepareAndSendCallback('FAILURE', [], strLockingMode, 'ERR-HAN-40134', "Error in _ExecuteWFSelectQuery() function ", error, null, IsSolrSearch, 0, mTokenId, pCallbackWFselect);
                            }
                        }

                        function executePagingQuery() {
                            // Execute query with paging
                            pLogInfo.fetchAsString = true;
                            reqTranDBHelper.ExecuteQueryWithPagingCount(mTranDB, strSelectQuery, mCurrentPageNo, mRecordPerPage, pLogInfo, function callbackExecuteSQL(pResult, pCount, pError) {
                                try {
                                    var pagingResult = {
                                        Result: pResult,
                                        Count: pCount
                                    };
                                    if (isCacheEnabled) {
                                        var params = {
                                            db: 'db1',
                                            uniquKey: uniquRedisKey,
                                            expirMin: cacheExpireMin,
                                            value: JSON.stringify(pagingResult)
                                        };
                                        if (params.expirMin === -1) {
                                            delete params.expirMin;
                                        }
                                        reqCacheRedisInstance.AddCacheToRedis(pReqHeader, params, objLogInfo, function (result) {
                                            try {
                                                if (result != 'SUCCESS') {
                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40165', 'Error on AddCacheToRedis', result);
                                                } else {
                                                    params = null;
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                                }
                                            } catch (error) {
                                                params = null;
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40166', 'Error on AddCacheToRedis', error);
                                            }
                                        });
                                        // reqCacheRedisInstance.SetKeyValWithExpiry(redisDB, objLogInfo, uniquRedisKey, JSON.stringify(pagingResult), cacheExpireMin, function (error, result) {
                                        //     try {
                                        //         if (error) {
                                        //             reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40165', 'Error on SetKeyValWithExpiry', error);
                                        //         } else {
                                        //             reqInstanceHelper.PrintInfo(serviceName, 'Cache added.', objLogInfo);
                                        //         }
                                        //     } catch (error) {
                                        //         reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-HAN-40166', 'Error on SetKeyValWithExpiry', error);
                                        //     }
                                        // });
                                    }
                                    afterPagingQueryExecution(pError, pResult, pCount);
                                } catch (error) {
                                    return _PrepareAndSendCallback('FAILURE', [], strLockingMode, 'ERR-HAN-40134', "Error in _ExecuteWFSelectQuery() function ", error, null, IsSolrSearch, 0, mTokenId, pCallbackWFselect);
                                }
                            });
                        }
                        if (isCacheEnabled) {
                            var params = {
                                db: 'db1',
                                uniquKey: uniquRedisKey
                            };
                            reqCacheRedisInstance.GetCacheFromRedis(pReqHeader, params, objLogInfo, function (result) {
                                try {
                                    if (result) {
                                        result = JSON.parse(result);
                                        params = null;
                                        afterPagingQueryExecution(null, result.Result, result.Count);
                                    } else {
                                        params = null;
                                        executePagingQuery();
                                    }
                                } catch (error) {
                                    _PrintError('ERR-HAN-40167', 'Error on GetCacheFromRedis', error);
                                }
                            });
                            // reqCacheRedisInstance.GetKeyVal(redisDB, objLogInfo, uniquRedisKey, function (pError, pResult) {
                            //     try {
                            //         if (pError) {
                            //             executePagingQuery();
                            //         } else {
                            //             pResult = JSON.parse(pResult);
                            //             afterPagingQueryExecution(pError, pResult.Result, pResult.Count);
                            //         }
                            //     } catch (error) {
                            //         _PrintError('ERR-HAN-40167', 'Error on GetKeyVal', error);
                            //     }
                            // });
                        } else {
                            executePagingQuery();
                        }
                    }
                    //     } catch (error) {
                    //         _PrintError('ERR-HAN-40168', 'Error on GetRedisConnection', error);
                    //     }
                    // });
                }
            } else {
                return _PrepareAndSendCallback('FAILURE', [], strLockingMode, 'ERR-HAN-40135', "Error : Query is not empty ", null, null, IsSolrSearch, 0, mTokenId, pCallbackWFselect);
            }
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], strLockingMode, "ERR-HAN-40136", "Error in _ExecuteWFSelectQuery() function ", error, null, IsSolrSearch, 0, mTokenId, pCallbackWFselect);
        }
    }

    // Handling listing mode 
    function _HandleListingMode(pListingMode, pSelectQry, pUId, pAppSTSId, pAppId, pCallback) {
        try {
            _PrintInfo('Current listing mode - ' + strListingMode);
            if (strListingMode != '') {
                switch (strListingMode) {
                    //   Case "ALL_SYS_ALL_USR"
                    //strSelectQuery = strSelectQuery.Replace("$ANDLOCK", " AND TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS)")
                    // strSelectQuery = strSelectQuery.Replace("$WHERELOCK", " WHERE TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS)")
                    // Case "ALL_SYS_CUR_USR"
                    //    strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format(" AND  TS.CREATED_BY = '{0}' AND TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS)", pUId))
                    //   strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format(" WHERE  TS.CREATED_BY = '{0}' AND TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS)", pUId))
                    case 'CUR_SYS_ALL_USR':
                        if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                            strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", mSId);
                        else {
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", reqUtil.format(" AND SYSTEM_ID = '%s' $LOCKEDBYFILTER_AND ", mSId));
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", reqUtil.format(" WHERE SYSTEM_ID = '%s' $LOCKEDBYFILTER_AND ", mSId));
                        }

                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                        strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                        return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        break;
                    /* Case "CUR_SYS_CUR_USR"
                      strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format(" AND CREATED_BY ='{0}' AND SYSTEM_ID ='{1}'", pUId, strSId))
                      strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format(" WHERE CREATED_BY ='{0}' AND SYSTEM_ID ='{1}'", pUId, strSId))
                    Case "ALL_SYS_ALL_USR_LOCKED"
                        strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format(" AND TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS) AND TS.LOCKED_BY ='{0}'", pUId))
                        strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format(" WHERE TS.CREATED_BY ='{0}' AND TS.STS_ID='{1}'", pUId, pAppSTSId))
                    Case "ALL_SYS_CUR_USR_LOCKED"
                        strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format(" AND TS.CREATED_BY= '{0}' AND TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS) AND TS.LOCKED_BY='{1}'", pUId, pUId))
                        strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format(" WHERE TS.CREATED_BY= '{0}' AND TS.STS_ID IN (SELECT CHILD_S_ID FROM TMP_CHILD_STS) AND TS.LOCKED_BY='{1}'", pUId, pUId))
                    Case "CUR_SYS_ALL_USR_LOCKED"
                        strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format(" AND TS.STS_ID ='{0}' AND TS.LOCKED_BY ='{1}'", pAppSTSId, pUId))
                        strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format(" WHERE TS.STS_ID ='{0}' AND TS.LOCKED_BY ='{1}'", pAppSTSId, pUId))
                    Case "CUR_SYS_CUR_USR_LOCKED"
                        strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format(" AND TS.CREATED_BY ='{0}' AND TS.STS_ID='{1}' AND TS.LOCKED_BY ='{0}'", pUId, pAppSTSId, pUId))
                        strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format(" WHERE TS.CREATED_BY ='{0}' AND TS.STS_ID='{1}' AND TS.LOCKED_BY ='{0}'", pUId, pAppSTSId, pUId))
                    Case "LOCKED_BY_ME"
                        strSelectQuery = strSelectQuery.Replace("$ANDLOCK", String.Format("  AND TS.LOCKED_BY ='{0}'", pUId))
                        strSelectQuery = strSelectQuery.Replace("$WHERELOCK", String.Format("  WHERE TS.LOCKED_BY ='{0}'", pUId))
                        */
                    case 'CUR_CLUSTER_ALL_SYS':
                        var LiteQuery = `select CHILD_S_ID from APP_SYSTEM_TO_SYSTEM ASTS inner join ${cltschemaName}.APP_USER_STS AUS on ASTS.appsts_id = AUS.appsts_id where AUS.Appu_Id = $appuid and ASTS.APP_ID='${mAppId}' and ASTS.CLUSTER_CODE='${mClusterCode}'`;
                        LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                        if (serviceModel.TYPE == 'LITE') {
                            if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND");
                            }
                            LiteQuery = null;
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_CLUSTER_ALL_SYS', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                        strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", strSID);
                                    else {
                                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND");
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }

                        break;
                    case 'CUR_SYS_WITH_CHILD':
                        // allocated ,all child
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts where app_id = '${mAppId}' and 
                            cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all select asts.child_s_id,asts.parent_s_id, asts.s_id from ${cltschemaName}.app_system_to_system asts 
                            inner join system s on asts.parent_s_id = s.s_id )select child_s_id from system`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts
                                 where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all select asts.child_s_id,asts.parent_s_id,asts.s_id from 
                                 ${cltschemaName}.app_system_to_system asts inner join system s on asts.parent_s_id = s.s_id)select child_s_id from system`;
                        }
                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            LiteQuery = null;
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_WITH_CHILD', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSID != '') {
                                        if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                            strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", strSID);
                                        else {
                                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        }
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        break;
                    case 'CUR_SYS_ALL_PARENT':
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}'  and appsts_id = '${mAppStsId}' union all select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join system s on asts.s_id = s.parent_s_id where aus.appu_id = $appuid) select child_s_id from system`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}'  and appsts_id = '${mAppStsId}' union all select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join system s on asts.s_id = s.parent_s_id where aus.appu_id = $appuid) select child_s_id from system`;
                        }
                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            // if (strSID != '') {
                            if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            // }
                            LiteQuery = null;
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_ALL_PARENT', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSID != '') {
                                        if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                            strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", strSID);
                                        else {
                                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        }
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        break;
                    case 'CUR_SYS_DIRECT_PARENT':
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(LEVELS,child_s_id,parent_s_id,s_id) AS (select 1 AS LEVELS,child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all select s.LEVELS +1,asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join ${cltschemaName}.system s on asts.s_id = s.parent_s_id where aus.appu_id = '8') select child_s_id from system where levels <=2`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(LEVELS,child_s_id,parent_s_id,s_id) AS (select 1 AS LEVELS,child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all select s.LEVELS +1,asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join ${cltschemaName}.system s on asts.s_id = s.parent_s_id where aus.appu_id = '8') select child_s_id from system where levels <=2`;
                        }

                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_DIRECT_PARENT', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                        strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", strSID);
                                    else {
                                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;
                    case 'DST_CUR_SYS_ALL_USR':
                        if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                            strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", mSId);
                        else {
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", reqUtil.format(" AND DST_SYSTEM_ID = '%s' $LOCKEDBYFILTER_AND ", mSId));
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", reqUtil.format(" WHERE DST_SYSTEM_ID = '%s' $LOCKEDBYFILTER_AND ", mSId));
                        }
                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                        strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                        return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        break;
                    case 'DST_CUR_CLUSTER_ALL_SYS':
                        var LiteQuery = `select CHILD_S_ID from APP_SYSTEM_TO_SYSTEM ASTS inner join ${cltschemaName}.APP_USER_STS AUS on ASTS.appsts_id = AUS.appsts_id where AUS.Appu_Id = $appuid and ASTS.APP_ID='${mAppId}' and ASTS.CLUSTER_CODE='${mClusterCode}'`;
                        LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                        if (serviceModel.TYPE == 'LITE') {
                            if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }

                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_CLUSTER_ALL_SYS', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                        strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", strSID);
                                    else {
                                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;
                    case 'DST_CUR_SYS_WITH_CHILD':
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all
                        select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id inner join system s on asts.parent_s_id = s.s_id where aus.appu_id = $appuid
                        )select child_s_id from system`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all
                            select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id inner join system s on asts.parent_s_id = s.s_id where aus.appu_id = $appuid
                            )select child_s_id from system`;
                        }

                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            // if (LiteQuery != '') {
                            if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            // }
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_WITH_CHILD', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSID != '') {
                                        if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                            strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", strSID);
                                        else {
                                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        }
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;
                    case 'DST_CUR_SYS_ALL_PARENT':
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}'  and appsts_id = '${mAppStsId}' union all select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join system s on asts.s_id = s.parent_s_id where aus.appu_id = $appuid) select child_s_id from system`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}'  and appsts_id = '${mAppStsId}' union all select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join system s on asts.s_id = s.parent_s_id where aus.appu_id = $appuid) select child_s_id from system`;
                        }

                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            // if (strSID != '') {
                            if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            // }
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_ALL_PARENT', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSID != '') {
                                        if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                            strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", strSID);
                                        else {
                                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        }
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;
                    case 'DST_CUR_SYS_DIRECT_PARENT':
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(LEVELS,child_s_id,parent_s_id,s_id) AS (select 1 AS LEVELS,child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all select s.LEVELS +1,asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join ${cltschemaName}.system s on asts.s_id = s.parent_s_id where aus.appu_id = '8') select child_s_id from system where levels <=2`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(LEVELS,child_s_id,parent_s_id,s_id) AS (select 1 AS LEVELS,child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system  where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all select s.LEVELS +1,asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id  inner join ${cltschemaName}.system s on asts.s_id = s.parent_s_id where aus.appu_id = '8') select child_s_id from system where levels <=2`;
                        }

                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + LiteQuery + ")  $LOCKEDBYFILTER_AND  ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_DIRECT_PARENT', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSelectQuery.indexOf("$DST_SYSTEM_ID") > 0)
                                        strSelectQuery = strSelectQuery.replaceAll("$DST_SYSTEM_ID", strSID);
                                    else {
                                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND DST_SYSTEM_ID IN (" + strSID + ")  $LOCKEDBYFILTER_AND  ");
                                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE DST_SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;
                    // To get the selected system id and its nested child id
                    case 'CUR_SYS_WITH_ALL_ALLOC_CHILD':
                        var LiteQuery;
                        if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'oracledb') {
                            LiteQuery = `with system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all
                            select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id inner join system s on asts.parent_s_id = s.s_id where aus.appu_id = $appuid
                            )select child_s_id from system`;
                        } else if (mCltCas && mCltCas.DBConn && mCltCas.DBConn.DBType == 'pg') {
                            LiteQuery = `with recursive system(child_s_id,parent_s_id,s_id) AS (select child_s_id,parent_s_id,s_id from ${cltschemaName}.app_system_to_system asts where app_id = '${mAppId}' and cluster_code = '${mClusterCode}' and appsts_id = '${mAppStsId}' union all
                            select asts.child_s_id,asts.parent_s_id,asts.s_id from ${cltschemaName}.app_system_to_system asts inner join ${cltschemaName}.app_user_sts aus on aus.appsts_id = asts.appsts_id inner join system s on asts.parent_s_id = s.s_id where aus.appu_id = $appuid
                            )select child_s_id from system`;
                        }

                        if (serviceModel.TYPE == 'LITE') {
                            LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                            if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetChildSTS('CUR_SYS_WITH_ALL_ALLOC_CHILD', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var sysID = pSId.QueryResult;
                                    var strSID = '';
                                    for (var i = 0; i < sysID.length; i++) {
                                        if (strSID == '') {
                                            strSID = "'" + sysID[i] + "',";
                                        } else {
                                            strSID = strSID + "'" + sysID[i] + "',";
                                        }
                                    }

                                    if (strSID.lastIndexOf(",")) {
                                        strSID = strSID.slice(0, strSID.length - 1);
                                    }
                                    if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                        strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", strSID);
                                    else {
                                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                    }
                                    strSID = null;
                                    sysID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;

                    case 'CUR_SYS_WITH_UNALLOC_CHILD':
                        // Concept : Current APPSTSID alone allocated to current Appuser, but the child systen is not allocated to same appuser
                        // List current system (alone allocated) and all the child system which is not allocated 
                        //var LiteQuery = `SELECT S_ID FROM  ${cltschemaName}.APP_SYSTEM_TO_SYSTEM ASTS inner join ${cltschemaName}.APP_USER_STS AUS on ASTS.appsts_id = AUS.appsts_id where ASTS.APP_ID='${mAppId}' and ASTS.CLUSTER_CODE='${mClusterCode}'`;
                        // var LiteQuery = `with system (appsts_id,s_id,sts_id,child_s_id,parent_s_id) as ( select appsts_id,s_id,sts_id,child_s_id,parent_s_id from  ${cltschemaName}.app_system_to_system where cluster_code = '${mClusterCode}' and app_id = '${mAppId}' and appsts_id = ${mAppStsId} union all select asts.appsts_id,asts.s_id,asts.sts_id,asts.child_s_id,asts.parent_s_id from  ${cltschemaName}.app_system_to_system asts,system rec where asts.parent_s_id = rec.child_s_id and asts.cluster_code = '${mClusterCode}' and asts.app_id = '${mAppId}' ) select s_id from system s inner join  ${cltschemaName}.app_user_sts aus on s.appsts_id = aus.appsts_id where appu_id = '${mAppUId}'`;

                        var LiteQuery = `with recursive cur_sys_and_child_data as ( select CHILD_S_ID from clt_tran.app_system_to_system where CHILD_S_ID = '${mSId}' and cluster_code = '${mClusterCode}' and APP_ID = '${mAppId}' union all select A.CHILD_S_ID from clt_tran.app_system_to_system A inner join cur_sys_and_child_data on cur_sys_and_child_data.CHILD_S_ID = A.PARENT_S_ID where cluster_code = '${mClusterCode}' and app_id = '${mAppId}' ) select CHILD_S_ID from cur_sys_and_child_data`;
                        LiteQuery = LiteQuery.replaceAll("$appuid", "'" + mAppUId + "'");
                        if (serviceModel.TYPE == 'LITE') {
                            if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", LiteQuery);
                            else {
                                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + LiteQuery + ") $LOCKEDBYFILTER_AND ");
                            }
                            strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND");
                            strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                            strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                            return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                        } else {
                            _GetDestinationSTS('CUR_SYS_WITH_UNALLOC_CHILD', function callbackGetChildSTS(pSId) {
                                if (pSId.Status == 'SUCCESS') {
                                    var strSID = pSId.QueryResult;
                                    if (strSelectQuery.indexOf("$SYSTEM_ID") > 0)
                                        strSelectQuery = strSelectQuery.replaceAll("$SYSTEM_ID", strSID);
                                    else {
                                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " AND SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " WHERE SYSTEM_ID IN (" + strSID + ") $LOCKEDBYFILTER_AND ");
                                    }
                                    strSID = null;
                                    strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND");
                                    strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                                    strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                                    return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                                } else {
                                    return pCallback(pSId);
                                }
                            });
                        }
                        LiteQuery = null;
                        break;
                    case 'USR_LOCKED', 'LOCKED_BY_ME':
                        var strLockingQry = strSelectQuery;
                        strLockingQry = strLockingQry.replace("$ANDLOCK", " AND TS.LOCKED_BY IS NULL ");
                        strLockingQry = strLockingQry.replace("$WHERELOCK", " WHERE TS.LOCKED_BY IS NULL ");
                        strLockingQry = strLockingQry.replace("$ORDERBY", " ");

                        objSpRecordLock.RecordLock(mAppId, mTokenId, mUID, mAppStsId, strLockingMode, 'SINGLE_ALL', intLockingCount, reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo), strLockingQry, mTranDB, mLoginName, objLogInfo, pReqHeader, mRecordPerPage, mCurrentPageNo, RcrdLclparam, function callbacklockTran(res) {
                            return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                        });
                        break;
                    default:
                        strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " ");
                        strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " ");
                        strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                        return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
                }
            } else {
                //strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " ");
                //strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " ");
                strSelectQuery = strSelectQuery.replaceAll("$CLUSTER_SYS", " ");
                strSelectQuery = strSelectQuery.replaceAll("$WHERELOCK", " $LOCKEDBYFILTER_WHERE ");
                strSelectQuery = strSelectQuery.replaceAll("$ANDLOCK", " $LOCKEDBYFILTER_AND ");
                return _PrepareAndSendCallback('SUCCESS', [], '', "", "", null, null, '', 0, mTokenId, pCallback);
            }

            // strSelectQuery = strSelectQuery.replace(/\r\n/g, " ")
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], '', "ERR-HAN-40137", "Error in _HandleListingMode() function ", error, null, '', 0, mTokenId, pCallback);
        }
    }



    function _GetChildSTS(pType, pCallback) {
        try {
            if (pType == 'GET_STS')
                _PrintInfo('Listing mode :GET_STS ');
            else {

                //get all appsts_id id against current appu id
                reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_USER_STS', ['APPSTS_ID'], {
                    appu_id: mAppUId
                }, objLogInfo, function callback(pError, pEligibleAppsts) {
                    try {
                        if (pError)
                            return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40138', 'Error on _GetChildSTS()', pError, null, '', 0, '', pCallback);

                        _InsertTmpChildSts(pType, pEligibleAppsts, function callbackInsertTmpChildSTS(pSIds) {
                            pCallback(pSIds);
                        });
                    } catch (error) {
                        return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40139', 'Error on _GetChildSTS()', error, null, '', 0, '', pCallback);
                    }
                });
            }
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40140', 'Error on _GetChildSTS()', error, null, '', 0, '', pCallback);
        }
    }



    function _InsertTmpChildSts(pType, pEligibleAppSts, pCallback) {
        var sIds = '';
        var count = 0;
        try {
            var arrAppSts = new reqLinq(pEligibleAppSts.rows).Select(function (item) {
                return "'" + item['appsts_id'] + "'";
            });
            var strsAppSts = arrAppSts.items.join();
            var strQuery = "SELECT CHILD_S_ID,S_ID,S_DESCRIPTION,PARENT_S_ID,APPSTS_ID FROM APP_SYSTEM_TO_SYSTEM WHERE APP_ID='" + mAppId + "' AND CLUSTER_CODE='" + mClusterCode + "' AND APPSTS_ID IN (" + strsAppSts + ")";
            reqFXDBInstance.ExecuteQuery(mCltCas, strQuery, objLogInfo, function callback(pError, pResult) {
                try {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40141', 'Error on _InsertTmpChildSts()', pError, null, '', 0, '', pCallback);
                    else {
                        if (pType.toUpperCase() === 'CUR_CLUSTER_ALL_SYS') {
                            for (var j = 0; j < pResult.rows.length; j++) {
                                var strSid = pResult.rows[j]['child_s_id'];
                                if (sIds == '')
                                    sIds = "'" + strSid + "'";
                                else
                                    sIds = sIds + ",'" + strSid + "'";
                            }
                        } else if (pType.toUpperCase() === 'CUR_SYS_WITH_CHILD') {
                            // currently selected STS
                            var arrCurrentSTS = new reqLinq(pResult.rows).Where(function (item) {
                                return item['appsts_id'] === mAppStsId;
                            }).ToArray();

                            if (arrCurrentSTS.length > 0) {
                                // concatenate current sts id 
                                if (sIds == '')
                                    sIds = "'" + arrCurrentSTS[0].child_s_id + "'";
                                else
                                    sIds = sIds + ",'" + arrCurrentSTS[0]['child_s_id'] + "'";

                                var arrChildSTS = new reqLinq(pResult.rows).Where(function (item) {
                                    return item['parent_s_id'] === arrCurrentSTS[0]['child_s_id'];
                                }).ToArray();

                                for (var j = 0; j < arrChildSTS.length; j++)
                                    if (sIds == '')
                                        sIds = "'" + arrChildSTS[j]['child_s_id'] + "'";
                                    else
                                        sIds = sIds + ",'" + arrChildSTS[j]['child_s_id'] + "'";
                            }
                        } else if (pType.toUpperCase() === 'CUR_SYS_ALL_PARENT') {
                            // currently selected STS
                            var arrCurrentSTS = new reqLinq(pResult.rows).Where(function (item) {
                                return item['appsts_id'] === mAppStsId;
                            }).ToArray();

                            if (arrCurrentSTS.length > 0) {
                                // concatenate current sts id 
                                if (sIds == '')
                                    sIds = "'" + arrCurrentSTS[0]['child_s_id'] + "'";
                                else
                                    sIds = sIds + ",'" + arrCurrentSTS[0]['child_s_id'] + "'";

                                sIds = _GetHierarchyParent(pResult.rows, arrCurrentSTS[0]['parent_s_id'], sIds);

                            }

                        } else if (pType.toUpperCase() === 'CUR_SYS_DIRECT_PARENT') {
                            // currently selected STS
                            var arrCurrentSTS = new reqLinq(pResult.rows).Where(function (item) {
                                return item['appsts_id'] === mAppStsId;
                            }).ToArray();

                            if (arrCurrentSTS.length > 0) {
                                // concatenate current sts id 
                                if (sIds == '')
                                    sIds = "'" + arrCurrentSTS[0].child_s_id + "'";
                                else
                                    sIds = sIds + ",'" + arrCurrentSTS[0]['child_s_id'] + "'";

                                // concatenate direct parent sts
                                sIds = sIds + ",'" + arrCurrentSTS[0]['parent_s_id'] + "'";
                            }
                            // To get selected system and its nested allchild system 
                        } else if (pType.toUpperCase() === 'CUR_SYS_WITH_ALL_ALLOC_CHILD') {
                            _PrintInfo('Getting for current system with all allocated child.');
                            sIds = [];
                            var totalRows = pResult.rows;
                            // currently selected STS
                            var arrSys = new reqLinq(totalRows)
                                .Where(function (u) {
                                    return u.s_id == mSId;
                                }).ToArray();

                            if (arrSys.length) {
                                preparesid(arrSys[0]);
                            }

                            function preparesid(psysdata) {
                                sIds.push(psysdata.s_id);
                                preparechildata(psysdata);
                            }


                            function preparechildata(sysdata) {
                                for (var sysd in totalRows) {
                                    if (sysdata.child_s_id == totalRows[sysd].parent_s_id) {
                                        preparesid(totalRows[sysd]);
                                    }
                                }

                            }

                        }
                        _PrintInfo('Got the sid');
                        return _PrepareAndSendCallback('SUCCESS', sIds, '', '', '', null, null, '', 0, '', pCallback);
                    }
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', '', '', 'ERR-HAN-40142', 'Error on _InsertTmpChildSts()', error, null, '', 0, '', pCallback);
                }
            });
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', '', '', 'ERR-HAN-40143', 'Error on _InsertTmpChildSts()', error, null, '', 0, '', pCallback);
        }
    }

    function _GetDestinationSTS(pType, pCallback) {
        try {
            //get all appsts_id id against current appu id
            reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_USER_STS', ['APPSTS_ID'], {
                appu_id: mAppUId
            }, objLogInfo, function callback(pError, pEliAppsts) {
                try {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40138', 'Error on _GetDestinationSTS()', pError, null, '', 0, '', pCallback);

                    // Check if currently selected APPSTSID is allocated to current appuser in APP_USER_STS
                    var arrAppSts = new reqLinq(pEliAppsts.rows).Where(function (item) {
                        return item['appsts_id'] === mAppStsId;
                    }).ToArray();

                    if (arrAppSts.length > 0) {
                        _GetDestinationChildSts(pType, pEliAppsts, function callbackGetDestinationChildSts(pSIds) {
                            pCallback(pSIds);
                        });
                    } else
                        pCallback('');
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40139', 'Error on _GetDestinationSTS()', error, null, '', 0, '', pCallback);
                }
            });
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40140', 'Error on _GetDestinationSTS()', error, null, '', 0, '', pCallback);
        }
    }
    var sysID = '';

    function _GetDestinationChildSts(pType, pEliAppSts, pCallback) {

        var count = 0;
        try {
            // var strQuery = "SELECT CHILD_S_ID,S_ID,S_DESCRIPTION,PARENT_S_ID,APPSTS_ID FROM APP_SYSTEM_TO_SYSTEM WHERE CLUSTER_CODE='" + mClusterCode + "' AND APP_ID ='" + mAppId + "' ALLOW FILTERING;"
            reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_SYSTEM_TO_SYSTEM', ['CHILD_S_ID', 'S_ID', 'S_DESCRIPTION', 'PARENT_S_ID', 'APPSTS_ID'], {
                CLUSTER_CODE: mClusterCode,
                APP_ID: mAppId
            }, objLogInfo, function callback(pError, pResult) {
                try {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40141', 'Error on _GetDestinationChildSts()', pError, null, '', 0, '', pCallback);
                    else {
                        // currently selected STS
                        var arrCurrentSTS = new reqLinq(pResult.rows).Where(function (item) {
                            return item['appsts_id'] === mAppStsId;
                        }).ToArray();
                        sysID = '';
                        if (arrCurrentSTS.length > 0) {
                            // concatenate current sts id and its child

                            AddChildSystems(pResult.rows, arrCurrentSTS[0].child_s_id);


                            // if (sIds == '')
                            //     sIds = "'" + arrCurrentSTS[0].child_s_id + "'"
                            // else
                            //     sIds = sIds + ",'" + arrCurrentSTS[0]['child_s_id'] + "'"

                            // var arrChildSTS = new reqLinq(pResult.rows).Where(function(item) {
                            //     return item['parent_s_id'] === arrCurrentSTS[0]['child_s_id']
                            // }).ToArray()

                            // for (var j = 0; j < arrChildSTS.length; j++)
                            //     if (sIds == '')
                            //         sIds = "'" + arrChildSTS[j]['child_s_id'] + "'"
                            //     else
                            //         sIds = sIds + ",'" + arrChildSTS[j]['child_s_id'] + "'"
                        }
                        return _PrepareAndSendCallback('SUCCESS', sysID, '', '', '', null, null, '', 0, '', pCallback);
                    }
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', '', '', 'ERR-HAN-40142', 'Error on _GetDestinationChildSts()', error, null, '', 0, '', pCallback);
                }
            });
        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', '', '', 'ERR-HAN-40143', 'Error on _GetDestinationChildSts()', error, null, '', 0, '', pCallback);
        }
    }

    function AddChildSystems(arrSTS, pParentSID) {
        if (sysID == '')
            sysID = "'" + pParentSID + "'";
        else
            sysID = sysID + ",'" + pParentSID + "'";

        var arrTempSys = new reqLinq(arrSTS)
            .Where(function (u) {
                return u.parent_s_id == pParentSID;
            }).ToArray();

        for (var sys in arrTempSys) {
            AddChildSystems(arrSTS, arrTempSys[sys].child_s_id);
        }
    }

    function _GetHierarchyParent(pResultRows, pCurParentSID, pResultSId) {
        // Add current Parent STS ID
        if (pResultSId == '')
            pResultSId = "'" + pCurParentSID + "'";
        else
            pResultSId = pResultSId + ",'" + pCurParentSID + "'";

        // get 
        var arrParentSTS = new reqLinq(pResultRows).Where(function (item) {
            return item['child_s_id'] === pCurParentSID;
        }).ToArray();

        if (arrParentSTS.length > 0)
            return _GetHierarchyParent(pResultRows, arrParentSTS[0]['parent_s_id'], pResultSId);
        else
            return pResultSId;
    }

    function _DeleteTmpChildSTS() {

    }

    // Prepare for select search param
    async function _FormSelectSearchCondition(pSearchFilter) {
        var ecryptedColumns = await reqServiceHelper.getEncryptColumnDetails(mCltCas, mDTTCode, objLogInfo)
        var strSearchCondition = '';
        var grps = [];
        try {

            for (var i = 0; i < pSearchFilter.length; i++) {
                var hsh = pSearchFilter[i];
                if (grps.indexOf(hsh.get('GROUP_NO')) < 0)
                    grps.push(hsh.get('GROUP_NO'));
            }

            var grpQryRes;
            for (var k = 0; k < grps.length; k++) {
                var strTSCondition = '';

                var grpno = grps[k];
                if (grpno == 0)
                    grpQryRes = new reqLinq(pSearchFilter)
                        .Where(function (grpdet) {
                            return grpdet.get('TMPFP_VALUE') !== '' && grpdet.get('BINDING_NAME').toString().toUpperCase() !== 'KEY_CONTENT_SEARCH';
                        }).ToArray();
                else
                    grpQryRes = grpQryRes = new reqLinq(pSearchFilter)
                        .Where(function (grpdet) {
                            return (grpdet.get('TMPFP_VALUE') !== '' && grpdet.get('BINDING_NAME').toString().toUpperCase() !== 'KEY_CONTENT_SEARCH' && grpdet.get('GROUP_NO') === grpno);
                        }).ToArray();

                var strOperation = " AND ";
                for (var i = 0; i < grpQryRes.length; i++) {
                    var qryRes = grpQryRes[i];
                    var strBindingName = qryRes.get('BINDING_NAME').toString().toUpperCase();
                    var strDataType = qryRes.get('DATA_TYPE');
                    var strValue = qryRes.get('TMPFP_VALUE');
                    var strToValue = qryRes.get('TMPFPTO_VALUE');
                    var strOperator = qryRes.get('OPERATOR');
                    var strControlType = qryRes.get('CONTROL_TYPE') || '';
                    if (strOperator == "&lt;&gt;") {
                        strOperator = '<>'
                    }
                    if (strOperator == '&gt;=') {
                        strOperator = '>='
                    } if (strOperator == '&lt;=') {
                        strOperator = '<='
                    }
                    if (strOperator == '&gt;') {
                        strOperator == '>'
                    }
                    if (strOperator == '&lt;') {
                        strOperator == '<'
                    }
                    var strControlType = qryRes.get('CONTROL_TYPE') || '';

                    var blnHasTranSetCondition = _CheckIsTranSetColumn(strBindingName);

                    if (strDataType == '')
                        strDataType = "VARCHAR";

                    if (strControlType == 'MULTI_SELECT_CBO') {
                        strOperator = 'CONTAINS';
                    }
                    //  Condition for Transaction_Set 
                    if (strTSCondition.length != 0)
                        strTSCondition = strTSCondition + strOperation;

                    //TO DO
                    if (strOperator == 'CONTAINS') {
                        if (strControlType == 'MULTI_SELECT_CBO') {
                            if (blnHasTranSetCondition) {
                                strTSCondition = strTSCondition + "(";
                                for (var z = 0; z < strValue.length; z++) {
                                    strOperator = " LIKE UPPER  ('%" + strValue[z] + "%')";
                                    if (z == 0) {
                                        strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                                    } else {
                                        strTSCondition = strTSCondition + " " + "OR" + " " + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                                    }
                                }
                                strTSCondition = strTSCondition + ")";
                            } else {
                                strTSCondition = strTSCondition + "(";
                                for (var z = 0; z < strValue.length; z++) {
                                    strOperator = " LIKE UPPER  ('%" + strValue[z] + "%')";
                                    if (z == 0) {
                                        strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( %s,' '))%s", strBindingName, strOperator);
                                    } else {
                                        strTSCondition = strTSCondition + " " + "OR" + " " + reqUtil.format(" UPPER (COALESCE( %s,' '))%s", strBindingName, strOperator);
                                    }
                                }
                                strTSCondition = strTSCondition + ")";
                            }

                        } else {
                            strOperator = " LIKE UPPER  ('%" + strValue + "%')";
                            if (ecryptedColumns.indexOf(strBindingName) > -1) {
                                strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE((fn_pcidss_decrypt(%s,$PCIDSS_KEY)),' '))%s ", strBindingName, strOperator);
                            } else {
                                strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( %s,' '))%s", strBindingName, strOperator);
                            }

                        }
                        // strOperator = " LIKE UPPER  ('%" + strValue + "%')"
                        // strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE(NULLIF(%s,''),' '))%s", strBindingName, strOperator)
                    } else if (strOperator == 'STARTS') {
                        strOperator = " LIKE UPPER  ('" + strValue + "%')";
                        if (ecryptedColumns.indexOf(strBindingName) > -1) {
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE(NULLIF(fn_pcidss_decrypt(%s,$PCIDSS_KEY),''),' '))%s", strBindingName, strOperator);
                        } else {
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE(NULLIF(%s,''),' '))%s", strBindingName, strOperator);
                        }
                    } else if (strOperator == 'ENDS') {
                        strOperator = " LIKE UPPER  ('%" + strValue + "')";
                        if (ecryptedColumns.indexOf(strBindingName) > -1) {
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE(NULLIF(fn_pcidss_decrypt(%s,$PCIDSS_KEY),''),' '))%s", strBindingName, strOperator);
                        } else {
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE(NULLIF(%s,''),' '))%s", strBindingName, strOperator);
                        }
                    } else if (strOperator == 'NOTEQUAL') {
                        if (strDataType == 'NUMBER') {
                            strOperator = reqUtil.format(" <> %s", strValue);
                            if (ecryptedColumns.indexOf(strBindingName) > -1) {
                                strTSCondition = strTSCondition + reqUtil.format(" COALESCE(NULLIF(fn_pcidss_decrypt(%s,$PCIDSS_KEY),0),0)%s", strBindingName, strOperator);
                            } else {
                                strTSCondition = strTSCondition + reqUtil.format(" COALESCE(NULLIF(%s,0),0)%s", strBindingName, strOperator);
                            }
                        } else {
                            strOperator = reqUtil.format(" <>UPPER  ('%s')", strValue);
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE(NULLIF(%s,''),' '))%s", strBindingName, strOperator);
                        }
                    } else {
                        if (strDataType == 'VARCHAR' || strDataType == 'VARCHAR2' || strDataType == 'CHAR' || strDataType == 'TEXT') {
                            if (strOperator == 'IN') {
                                var strValues = _FormStringCondition(strValue);
                                if (ecryptedColumns.indexOf(strBindingName) > -1) {
                                    strTSCondition = strTSCondition + reqUtil.format(" COALESCE(NULLIF(fn_pcidss_decrypt(%s,$PCIDSS_KEY),''),' ') %s (%s)", strBindingName, strOperator, strValues);
                                } else {
                                    strTSCondition = strTSCondition + reqUtil.format(" COALESCE(NULLIF(%s,''),' ') %s (%s)", strBindingName, strOperator, strValues);
                                }
                            } else {
                                strValue = "'" + strValue + "'";


                                if (ecryptedColumns.indexOf(strBindingName) > -1) {
                                    // strValue = `fn_pcidss_encrypt(${strValue})`
                                    strTSCondition = strTSCondition + reqUtil.format(" UPPER (fn_pcidss_decrypt(%s,$PCIDSS_KEY))  %s UPPER(%s)", strBindingName, strOperator, strValue);
                                } else {
                                    strTSCondition = strTSCondition + reqUtil.format(" UPPER ( COALESCE(NULLIF(%s,''),' ')) %s UPPER (%s)", strBindingName, strOperator, strValue);
                                }
                            }
                        } else if (strDataType == 'DATE' || strDataType == 'DATETIME') {
                            console.log('FXUTCAuditColumn ' + reqDateFormatter.FXUTCAuditColumn());
                            if (reqDateFormatter.FXUTCAuditColumn().indexOf(strBindingName) > -1) {
                                strTSCondition = strTSCondition + reqDateFormatter.GetSearchCriteriaForUTC(pReqHeader, objLogInfo, strBindingName, strValue, strToValue, strOperator);
                            } else {
                                strTSCondition = strTSCondition + reqDateFormatter.GetSearchCriteriaForBusinessColumn(pReqHeader, objLogInfo, strBindingName, strValue, strToValue, strOperator);
                            }
                            //strValue = reqUtil.format("TO_DATE(TO_CHAR(cast('%s' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')", ToDate(strValue));
                            //strTSCondition = strTSCondition + reqUtil.format("TO_DATE(TO_CHAR(%s,'DD-MON-YY'),'DD-MON-YY') %s %s", strBindingName, strOperator, strValue);
                        } else { // if (strOperator == 'IN')
                            strTSCondition = strTSCondition + reqUtil.format("COALESCE( %s,0) %s (%s)", strBindingName, strOperator, strValue);
                        }
                        strTSCondition = '(' + strTSCondition + ')';
                    }
                    var previousOperation = strOperation;
                    strOperation = (qryRes.get('CONJ_OPERATOR') != undefined && qryRes.get('CONJ_OPERATOR') != null && qryRes.get('CONJ_OPERATOR') != '') ? ' ' + qryRes.get('CONJ_OPERATOR') + ' ' : ' AND ';
                    if (previousOperation != strOperation) {
                        strTSCondition = '(' + strTSCondition + ')';
                    }
                }

                if (strSearchCondition == '')
                    strSearchCondition = strTSCondition.toString();
                else {
                    if (strTSCondition != '')
                        strSearchCondition = strSearchCondition + " OR " + strTSCondition.toString();
                }
            }
            return strSearchCondition;
        } catch (error) {
            _PrintError("ERR-FX-13546", "Error in _FormSelectSearchCondition() function ", error);
        }

    }

    // prepare searchparam 
    function _FormSimpleSearchCondition(pSearchFilter) {
        var objSearchRes = {};

        var sbTSConditions = '';
        var sbTRNConditions = '';

        var strTMPCondition = '';
        var strTSFILTERCondition = '';

        var grps = [];

        try {
            for (var i = 0; i < pSearchFilter.length; i++) {
                var hsh = pSearchFilter[i];
                if (grps.indexOf(hsh.get('GROUP_NO')) < 0)
                    grps.push(hsh.get('GROUP_NO'));
            }

            var grpQryRes;
            for (var i = 0; i < grps.length; i++) {
                var strTSCondition = '';
                var strTRNCondition = '';
                var grpno = grps[i];
                if (grpno == 0)
                    grpQryRes = new reqLinq(pSearchFilter)
                        .Where(function (grpdet) {
                            return grpdet.get('TMPFP_VALUE') !== '' && grpdet.get('BINDING_NAME').toString().toUpperCase() !== 'KEY_CONTENT_SEARCH';
                        }).ToArray();
                else
                    grpQryRes = grpQryRes = new reqLinq(pSearchFilter)
                        .Where(function (grpdet) {
                            return (grpdet.get('TMPFP_VALUE') !== '' && grpdet.get('BINDING_NAME').toString().toUpperCase() !== 'KEY_CONTENT_SEARCH' && grpdet.get('GROUP_NO') === grpno);
                        }).ToArray();


                var strOperation = " AND ";

                for (var i = 0; i < grpQryRes.length; i++) {
                    var qryRes = grpQryRes[i];
                    var strBindingName = qryRes.get('BINDING_NAME').toString().toUpperCase();
                    var strDataType = qryRes.get('DATA_TYPE');
                    var strValue = qryRes.get('TMPFP_VALUE');
                    var strToValue = qryRes.get('TMPFPTO_VALUE');
                    var strOperator = qryRes.get('OPERATOR');
                    var strControlType = qryRes.get('CONTROL_TYPE') || '';
                    var strDTT = qryRes.get('DTT_CODE');

                    if (strOperator == '&lt;') {
                        strOperator = '<'
                    } if (strOperator == '&gt;') {
                        strOperator = '>'
                    }
                    if (strOperator == '&lt;=') {
                        strOperator = '<='
                    }
                    if (strOperator == '&gt;=') {
                        strOperator = '>='
                    }
                    if (strOperator == "&lt;&gt;") {
                        strOperator = '<>'
                    }

                    //Check any of the column available in TransactionSet
                    //TO DO
                    var blnHasTranSetCondition = _CheckIsTranSetColumn(strBindingName);

                    if (strDataType == '')
                        strDataType = 'VARCHAR';

                    if (strControlType == 'MULTI_SELECT_CBO') {
                        strOperator = 'CONTAINS';
                    }

                    if (blnHasTranSetCondition) {
                        //  Condition for Transaction_Set 
                        if (strTSCondition.length != 0)
                            strTSCondition = strTSCondition + strOperation;
                        //TO DO                        
                        if (strOperator == 'CONTAINS') {
                            if (strControlType == 'MULTI_SELECT_CBO') {
                                strTSCondition = strTSCondition + "(";
                                for (var z = 0; z < strValue.length; z++) {
                                    strOperator = " LIKE UPPER  ('%" + strValue[z] + "%')";
                                    if (z == 0) {
                                        strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                                    } else {
                                        strTSCondition = strTSCondition + " " + "OR" + " " + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                                    }
                                }
                                strTSCondition = strTSCondition + ")";
                            } else {
                                strOperator = " LIKE UPPER  ('%" + strValue + "%')";
                                strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                            }
                        } else if (strOperator == 'STARTS') {
                            strOperator = " LIKE UPPER  ('" + strValue + "%')";
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                        } else if (strOperator == 'ENDS') {
                            strOperator = " LIKE UPPER  ('%" + strValue + "')";
                            strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                        } else if (strOperator == 'NOTEQUAL') {
                            if (strDataType == 'NUMBER') {
                                strOperator = reqUtil.format(" <> %s", strValue);
                                strTSCondition = strTSCondition + reqUtil.format(" COALESCE(NULLIF(%s,0),0)%s", strBindingName, strOperator);
                            } else {
                                strOperator = reqUtil.format(" <>UPPER  ('%s')", strValue);
                                strTSCondition = strTSCondition + reqUtil.format(" UPPER (COALESCE( TS.%s,' '))%s", strBindingName, strOperator);
                            }
                        } else {
                            if (strDataType == 'VARCHAR' || strDataType == 'CHAR' || strDataType == 'TEXT') {
                                if (strOperator == 'IN') {
                                    var strValues = _FormStringCondition(strValue);
                                    strTSCondition = strTSCondition + reqUtil.format(" COALESCE( TS.%s,' ') %s (%s)", strBindingName, strOperator, strValues);
                                } else {
                                    strValue = "'" + strValue + "'";
                                    strTSCondition = strTSCondition + reqUtil.format(" UPPER ( COALESCE( TS.%s,' '))%s UPPER (%s)", strBindingName, strOperator, strValue);
                                }
                            } else if (strDataType == 'DATE' || strDataType == 'DATETIME') {
                                console.log('FXUTCAuditColumn ' + reqDateFormatter.FXUTCAuditColumn());
                                // strValue = reqUtil.format("TO_DATE(TO_CHAR(cast('%s' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')", ToDate(strValue));
                                // strTSCondition = strTSCondition + reqUtil.format("TO_DATE(TO_CHAR(TS.%s,'DD-MON-YY'),'DD-MON-YY') %s %s", strBindingName, strOperator, strValue);
                                if (reqDateFormatter.FXUTCAuditColumn().indexOf(strBindingName) > -1) {
                                    strTSCondition = strTSCondition + reqDateFormatter.GetSearchCriteriaForUTC(pReqHeader, objLogInfo, strBindingName, strValue, strToValue, strOperator);
                                } else {
                                    strTSCondition = strTSCondition + reqDateFormatter.GetSearchCriteriaForBusinessColumn(pReqHeader, objLogInfo, strBindingName, strValue, strToValue, strOperator);
                                }
                            } else { // if (strOperator == 'IN')
                                strTSCondition = strTSCondition + reqUtil.format("COALESCE( TS.%s,0) %s (%s)", strBindingName, strOperator, strValue);
                            }
                            strTSCondition = '(' + strTSCondition + ')';
                        }
                    } else {
                        //Condition for Other tran tables
                        if (strTRNCondition.length > 0)
                            strTRNCondition = strTRNCondition + strOperation;

                        if (strOperator == 'CONTAINS') {
                            if (strControlType == 'MULTI_SELECT_CBO') {
                                strTRNCondition = strTRNCondition + "(";
                                for (var mscbo = 0; mscbo < strValue.length; mscbo++) {
                                    strOperator = " LIKE UPPER  ('%" + strValue[mscbo] + "%')";
                                    if (mscbo == 0) {
                                        strTRNCondition = strTRNCondition + reqUtil.format(" UPPER (COALESCE( %s,' '))%s", strBindingName, strOperator);
                                    } else {
                                        strTRNCondition = strTRNCondition + " " + "OR" + " " + reqUtil.format(" UPPER (COALESCE( %s,' '))%s", strBindingName, strOperator);
                                    }
                                }
                                strTRNCondition = strTRNCondition + ")";
                            } else {
                                strOperator = " LIKE UPPER  ('%" + strValue + "%')";
                                strTRNCondition = strTRNCondition + reqUtil.format(" UPPER (COALESCE( %s,' '))%s", strBindingName, strOperator);
                            }
                        } else if (strOperator == 'STARTS') {
                            strOperator = " LIKE UPPER  ('" + strValue + "%')";
                            strTRNCondition = strTRNCondition + reqUtil.format(" UPPER (COALESCE(%s,' '))%s", strBindingName, strOperator);
                        } else if (strOperator == 'ENDS') {
                            strOperator = " LIKE UPPER  ('%" + strValue + "')";
                            strTRNCondition = strTRNCondition + reqUtil.format(" UPPER (COALESCE(%s,' '))%s", strBindingName, strOperator);
                        } else if (strOperator == "NOTEQUAL") {
                            if (strDataType == "NUMBER") {
                                strOperator = reqUtil.format(" <> {0}", strValue);
                                strTRNCondition = strTRNCondition + reqUtil.format(" COALESCE(NULLIF(%s,0),0)%s", strBindingName, strOperator);
                            } else {
                                strOperator = reqUtil.format(" <>UPPER  ('%s')", strValue);
                                strTRNCondition = strTRNCondition + reqUtil.format(" UPPER (COALESCE(%s,' '))%s", strBindingName, strOperator);
                            }
                        } else {
                            if (strDataType == 'VARCHAR' || strDataType == 'CHAR' || strDataType == 'TEXT') {
                                if (strOperator == 'IN') {
                                    var strValues = _FormStringCondition(strValue);
                                    strTRNCondition = strTRNCondition + reqUtil.format(" COALESCE(%s,' ') %s (%s)", strBindingName, strOperator, strValues);
                                } else {
                                    strValue = "'" + strValue + "'";
                                    strTRNCondition = strTRNCondition + reqUtil.format(" UPPER ( COALESCE(%s,' ')) %s UPPER (%s)", strBindingName, strOperator, strValue);
                                }
                            } else if (strDataType == "DATE" || strDataType == "DATETIME") {
                                // strValue = reqUtil.format("TO_DATE(TO_CHAR(cast('%s' as TIMESTAMP),'DD-MON-YY'),'DD-MON-YY')", ToDate(strValue));
                                // strTRNCondition = strTRNCondition + reqUtil.format("TO_DATE(TO_CHAR(%s,'DD-MON-YY'),'DD-MON-YY') %s %s", strBindingName, strOperator, strValue);
                                if (reqDateFormatter.FXUTCAuditColumn().indexOf(strBindingName) > -1) {
                                    strTRNCondition = strTRNCondition + reqDateFormatter.GetSearchCriteriaForUTC(pReqHeader, objLogInfo, strBindingName, strValue, strToValue, strOperator);
                                } else {
                                    strTRNCondition = strTRNCondition + reqDateFormatter.GetSearchCriteriaForBusinessColumn(pReqHeader, objLogInfo, strBindingName, strValue, strToValue, strOperator);
                                }
                            } else
                                strTRNCondition = strTRNCondition + reqUtil.format("COALESCE(%s,0) %s (%s)", strBindingName, strOperator, strValue);

                            strTRNCondition = "(" + strTRNCondition;
                            strTRNCondition = strTRNCondition + ")";
                        }
                    }

                    //Preparing TMP condition and FILTER condition
                    if ((!strBindingName) && strBindingName == 'PARENT_TS_ID') {
                        strTSFILTERCondition = ' TS.TS_ID > ' + strValue;
                        strTMPCondition = ' TS.TS_ID = ' + strValue;
                    }

                    strOperation = (qryRes.get('CONJ_OPERATOR') != undefined && qryRes.get('CONJ_OPERATOR') != null && qryRes.get('CONJ_OPERATOR') != '') ? ' ' + qryRes.get('CONJ_OPERATOR') + ' ' : ' AND ';

                }
                //Append TS condition
                if (sbTSConditions == '')
                    sbTSConditions = sbTSConditions + strTSCondition.toString();
                else {
                    sbTSConditions = sbTSConditions + ' OR ';
                    sbTSConditions = sbTSConditions + strTSCondition.toString();
                }

                //Append TRN Conditions
                if (strTRNCondition != '') {
                    if (sbTRNConditions == '')
                        sbTRNConditions = sbTRNConditions + strTRNCondition.toString();
                    else {
                        sbTRNConditions = sbTRNConditions + " OR ";
                        sbTRNConditions = sbTRNConditions + strTRNCondition.toString;
                    }
                }
            }

            objSearchRes.TSFilterCondition = strTSFILTERCondition;
            objSearchRes.TRNCondition = sbTSConditions;
            objSearchRes.InsertCondition = strTMPCondition;
            objSearchRes.SearchCondition = sbTRNConditions;

            return objSearchRes;
        } catch (error) {
            _PrintError("ERR-FX-13547", "Error in _FormSimpleSearchCondition() function ", error);
        }
    }

    function _CheckIsTranSetColumn(pColumnName) {
        try {
            //Change the list if any new column added on T table
            var arrTSColumns = [];
            arrTSColumns.push("TS_ID");
            arrTSColumns.push("PARENT_TS_ID");
            // arrTSColumns.push("TRN_ID")
            // arrTSColumns.push("DT_CODE")
            //arrTSColumns.push("DTT_CODE")
            //arrTSColumns.push("PROCESS_STATUS")
            //arrTSColumns.push("STATUS")
            arrTSColumns.push("TOTAL_TA_TIME");
            arrTSColumns.push("DISPLAY_NAME");
            arrTSColumns.push("RESOURCE_SERVER_CODE");
            arrTSColumns.push("LOCKED_BY");
            arrTSColumns.push("DATA_SOURCE");
            //arrTSColumns.push("PRCT_ID")
            //arrTSColumns.push("SYSTEM_ID")
            //arrTSColumns.push("STS_ID")
            arrTSColumns.push("GROUP_ID");
            arrTSColumns.push("DTTAK_ID");
            if (arrTSColumns.indexOf(pColumnName) > 0)
                return true;
            else
                return false;
        } catch (error) {
            _PrintError("ERR-HAN-40144", "Error in _CheckIsTranSetColumn() function ", error);
        }
    }

    // Prepare for Solr search or return searchparam as it is
    function _PrepareSearch(pSearchInfo, pRecordsperPage, pPageNum, pDTCode, pDTTCode, pTokenId, pCasIns, pTranDB, pCallback) {
        var FilterTable = [];
        try {
            //  SOLR search
            if (pSearchInfo != null && pSearchInfo.length > 0) {
                var SolrContentSearch = 'N';
                var SolrDataSearch = 'N';
                var SolrGlobalSearch = 'N';
                var SolrAuditSearch = 'N';
                var SolrAuditVerSearch = 'N';
                var SolrSearch = [];

                for (var i = 0; i < pSearchInfo.length; i++) {
                    if (pSearchInfo[i].get('ISSEARCH') == 'Y') {
                        pSearchInfo[i].remove('ISSEARCH');
                        SolrSearch.push(pSearchInfo[i]);
                    } else {
                        pSearchInfo[i].remove('ISSEARCH');
                        FilterTable.push(pSearchInfo[i]);
                    }
                }

                switch (mSolrSearchName) {
                    case "SOLR_DATA_SEARCH":
                        SolrDataSearch = "Y";
                        break;
                    case "SOLR_GLOBAL_SEARCH":
                        SolrGlobalSearch = "Y";
                        break;
                    case "SOLR_CONTENT_SEARCH":
                        SolrContentSearch = "Y";
                        break;
                    case "SOLR_AUDIT_VER_SEARCH":
                        SolrAuditVerSearch = 'Y';
                        break;
                    case "SOLR_AUDIT_SEARCH":
                        SolrAuditSearch = 'Y';
                        pRecordsperPage = 200;
                        break;
                }
                if (SolrDataSearch == 'Y' || SolrGlobalSearch == 'Y' || SolrContentSearch == 'Y' || SolrAuditSearch == 'Y' || SolrAuditVerSearch == 'Y') {
                    // TODO Solr Select
                    var strConjCond = 'AND';
                    if (SolrGlobalSearch == 'Y')
                        strConjCond = 'OR';

                    if (SolrSearch.length > 0) {
                        if (SolrDataSearch == 'Y' || SolrAuditSearch == 'Y' || SolrAuditVerSearch == 'Y') {
                            if (pDTCode != '') {
                                var reqHsh = new reqHashTable();
                                reqHsh.put('BINDING_NAME', 'DT_CODE');
                                reqHsh.put('TMPFP_VALUE', pDTCode);
                                reqHsh.put('OPERATOR', '=');
                                SolrSearch.push(reqHsh);
                                reqHsh = null;
                            }
                            if (pDTTCode != '') {
                                var reqHsh = new reqHashTable();
                                reqHsh.put('BINDING_NAME', 'DTT_CODE');
                                reqHsh.put('TMPFP_VALUE', pDTTCode);
                                reqHsh.put('OPERATOR', '=');
                                SolrSearch.push(reqHsh);
                                reqHsh = null;
                            }
                        }

                        IsSolrSearch = 'Y';
                        //Call solr

                        if (pPageNum == 0)
                            pPageNum = 1;

                        GetPagingDocuments(SolrSearch, pRecordsperPage, pPageNum, SolrContentSearch, SolrDataSearch, SolrGlobalSearch, SolrAuditVerSearch, SolrAuditSearch, strConjCond, function callbackGetPagingDocuments(DocTables, IsContentResult, IsGlobalResult, IsDataResult, IsAuditVerResult, IsAuditResult, pErrObject) {
                            try {
                                if (pErrObject.Status = 'SUCCESS') {
                                    _InsertTmpProcessTable(pTranDB, DocTables.response, IsContentResult, IsGlobalResult, IsDataResult, IsAuditVerResult, IsAuditResult, pTokenId, pDTCode, pDTTCode, function callback(pStatusObject) {
                                        pCallback(FilterTable, pStatusObject);
                                    });
                                } else
                                    pCallback(FilterTable, pErrObject);
                            } catch (error) {
                                var objErr = _PrepareStatusObject('FAILURE', 'ERR-HAN-40145', 'Error in _PrepareSearch() function', error, null);
                                pCallback(FilterTable, objErr);
                            }
                        });
                    } else { // Select records from TranDB
                        var objErr = _PrepareStatusObject('FAILURE', 'ERR-HAN-40146', 'SolrSearch param not found', null, null);
                        pCallback(FilterTable, objErr);
                    }
                } else {
                    _PrintInfo('Database search ');
                    FilterTable = pSearchInfo;
                    var objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                    pCallback(FilterTable, objStatus);
                }
            } else { // No search param found
                var objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                pCallback(FilterTable, objStatus);
            }
        } catch (error) {
            var objErr = _PrepareStatusObject('FAILURE', 'ERR-HAN-40147', 'Error in _PrepareSearch() function ', error, null);
            pCallback(FilterTable, objErr);
        }
    }

    // Inserting Temp process items and attachment table
    function _InsertTmpProcessTable(pTranDB, DocTables, IsContentResult, IsGlobalResult, IsDataResult, IsAuditVerResult, IsAuditResult, pTokenId, pDTCode, pDTTCode, pCallback) {
        try {
            if (DocTables != undefined && DocTables.docs != undefined && DocTables.docs.length > 0) {
                mTotalRecords = DocTables.numFound;
                if (IsContentResult) {
                    var TmpItems = [];
                    try {
                        for (var i = 0; i < DocTables.docs.length; i++) {
                            var dr = DocTables.docs[i];
                            var dNewRow = {};
                            var Filename = '';
                            if (dr['filename'] != undefined) {
                                Filename = dr['filename'];
                            }
                            if (Filename != '')
                                dNewRow['FILE_NAME'] = Filename.toString();
                            dNewRow['PRCT_ID'] = pTokenId;
                            dNewRow['CREATED_BY'] = 1;
                            dNewRow['CREATED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                            dNewRow['MODIFIED_BY'] = 1;
                            dNewRow['MODIFIED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                            dNewRow['VERSION_NO'] = 1;
                            TmpItems.push(dNewRow);
                        }
                        reqTranDBHelper.InsertTranDB(pTranDB, 'TMP_PROCESS_ATTACHMENTS', TmpItems, objLogInfo, function callbackInsertTMPIA(pResult, pError) {
                            if (pError) {
                                _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40148', 'Error in _InsertTmpProcessTable() function ', pError, null, '', 0, '', pCallback);
                            } else {
                                TmpItems = null;
                                dNewRow = null;
                                Filename = null;
                                _PrepareAndSendCallback('SUCCESS', [], '', null, null, null, null, '', 0, '', pCallback);
                            }


                        });
                    } catch (error) {
                        TmpItems = null;
                        dNewRow = null;
                        Filename = null;
                        _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40149', 'Error in _InsertTmpProcessTable() function ', error, null, '', 0, '', pCallback);
                    }
                } else if (IsGlobalResult) {
                    var TmpItems = [];
                    try {
                        for (var i = 0; i < DocTables.docs.length; i++) {
                            var dr = DocTables.docs[i];
                            var ItemId = 0;
                            var BindVal = '';
                            if (dr['_GLOBAL_SEARCH_'] != undefined && dr['_GLOBAL_SEARCH_'] != '')
                                BindVal = dr['_GLOBAL_SEARCH_'];
                            if (ItemId == 0 && dr['TRNA_ID'] != undefined)
                                ItemId = dr['TRNA_ID'];
                            if (ItemId == 0 && dr['TRN_ID'] != undefined)
                                ItemId = dr['TRN_ID'];
                            var TmpRow = {};
                            TmpRow['PRCT_ID'] = pTokenId;
                            TmpRow['ITEM_ID'] = ItemId;
                            TmpRow['BINDING_NAME'] = '_GLOBAL_SEARCH_';
                            TmpRow['VALUE'] = BindVal;
                            if (pDTCode.toString() != '')
                                TmpRow['DT_CODE'] = pDTCode;
                            if (pDTTCode.toString() != '')
                                TmpRow['DTT_CODE'] = pDTTCode;
                            TmpRow['CREATED_BY'] = 1;
                            TmpRow['CREATED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                            TmpItems.push(TmpRow);
                        }
                        reqTranDBHelper.InsertTranDB(pTranDB, 'TMP_PROCESS_ITEMS', TmpItems, objLogInfo, function callbackDelete(pResult, pError) {
                            if (pError) {
                                _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40150', 'Error in _InsertTmpProcessTable() function ', pError, null, '', 0, '', pCallback);
                            } else {
                                TmpItems = null;
                                TmpRow = null;
                                BindVal = null;
                                dr = null;
                                _PrepareAndSendCallback('SUCCESS', [], '', null, null, null, null, '', 0, '', pCallback);
                            }

                        });
                    } catch (error) {
                        TmpItems = null;
                        TmpRow = null;
                        BindVal = null;
                        dr = null;
                        _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40151', 'Error in _InsertTmpProcessTable() function ', error, null, '', 0, '', pCallback);

                    }
                } else if (IsDataResult) {
                    var TmpItems = [];
                    try {
                        for (var i = 0; i < DocTables.docs.length; i++) {
                            var dr = DocTables.docs[i];
                            var TmpRow = {};
                            var TSID = 0;
                            if (dr['TS_ID'] != undefined)
                                TSID = dr['TS_ID'];
                            TmpRow['PRCT_ID'] = pTokenId;
                            TmpRow['ITEM_ID'] = TSID;
                            if (pDTCode.toString() != '')
                                TmpRow['DT_CODE'] = pDTCode;
                            if (pDTTCode.toString() != '')
                                TmpRow['DTT_CODE'] = pDTTCode;
                            TmpRow['CREATED_BY'] = 1;
                            TmpRow['CREATED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                            TmpItems.push(TmpRow);
                        }
                        reqTranDBHelper.InsertTranDB(pTranDB, 'TMP_PROCESS_ITEMS', TmpItems, objLogInfo, function callbackInsert(pResult, pError) {
                            if (pError) {
                                _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40152', 'Error in _InsertTmpProcessTable() function ', pError, null, '', 0, '', pCallback);
                            } else {
                                TmpItems = null;
                                TmpRow = null;
                                TSID = null;
                                dr = null;
                                _PrepareAndSendCallback('SUCCESS', [], '', null, null, null, null, '', 0, '', pCallback);
                            }
                        });
                    } catch (error) {
                        TmpItems = null;
                        TmpRow = null;
                        TSID = null;
                        dr = null;
                        _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40153', 'Error in _InsertTmpProcessTable() function ', error, null, '', 0, '', pCallback);
                    }
                } else if (IsAuditVerResult) {
                    var TmpItems = [];
                    try {
                        for (var i = 0; i < DocTables.docs.length; i++) {
                            var dr = DocTables.docs[i];
                            var TmpRow = {};
                            var RecordID = 0;
                            var VersionNo = 0;
                            var CreatedByName = '';
                            var CreatedDate = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                            if (dr['TRN_ID'] != undefined)
                                RecordID = dr['TRN_ID'];
                            if (dr['VERSION_NO'] != undefined)
                                VersionNo = dr['VERSION_NO'];
                            if (dr['CREATED_BY'] != undefined)
                                CreatedByName = dr['CREATED_BY'];
                            if (dr['CREATED_DATE'] != undefined)
                                CreatedDate = dr['CREATED_DATE'];
                            TmpRow['VERSION_NO'] = VersionNo;
                            TmpRow['PRCT_ID'] = pTokenId;
                            TmpRow['ITEM_ID'] = RecordID;
                            if (pDTCode.toString() != '')
                                TmpRow['DT_CODE'] = pDTCode;
                            if (pDTTCode.toString() != '')
                                TmpRow['DTT_CODE'] = pDTTCode;
                            TmpRow['CREATED_BY'] = CreatedByName;
                            TmpRow['CREATED_DATE'] = CreatedDate;
                            TmpItems.push(TmpRow);
                        }
                        reqTranDBHelper.InsertTranDB(pTranDB, 'TMP_PROCESS_ITEMS', TmpItems, objLogInfo, function callbackInsert(pResult, pError) {
                            if (pError) {
                                _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40154', 'Error in _InsertTmpProcessTable() function ', pError, null, '', 0, '', pCallback);
                            } else {
                                TmpItems = null;
                                TmpRow = null;
                                CreatedByName = null;
                                dr = null;
                                CreatedDate = null;
                                _PrepareAndSendCallback('SUCCESS', [], '', null, null, null, null, '', 0, '', pCallback);
                            }

                        });
                    } catch (error) {
                        TmpItems = null;
                        TmpRow = null;
                        CreatedByName = null;
                        dr = null;
                        CreatedDate = null;
                        _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40155', 'Error in _InsertTmpProcessTable() function ', error, null, '', 0, '', pCallback);
                    }
                } else if (IsAuditResult) {
                    var TmpItems = [];
                    try {
                        for (var i = 0; i < DocTables.docs.length; i++) {
                            var dr = DocTables.docs[i];
                            var TmpRow = {};
                            var RecordID = 0,
                                strVersionNo = 0;
                            var ColName = '';
                            var OldValue = '';
                            var NewValue = '';
                            if (dr['RECORD_ID'] != undefined)
                                RecordID = dr['RECORD_ID'];
                            if (dr['COLUMN_NAME'] != undefined)
                                ColName = dr['COLUMN_NAME'];
                            if (dr['OLD_VALUE'] != undefined)
                                OldValue = dr['OLD_VALUE'];
                            if (dr['NEW_VALUE'] != undefined)
                                NewValue = dr['NEW_VALUE'];
                            if (dr['VERSION_NO'] != undefined)
                                strVersionNo = dr['VERSION_NO'];
                            TmpRow['PRCT_ID'] = pTokenId;
                            TmpRow['ITEM_ID'] = RecordID;
                            TmpRow['BINDING_NAME'] = ColName;
                            TmpRow['OLD_VALUE'] = OldValue;
                            TmpRow['VALUE'] = NewValue;
                            TmpRow['VERSION_NO'] = strVersionNo;

                            if (pDTCode.toString() != '')
                                TmpRow['DT_CODE'] = pDTCode;
                            if (pDTTCode.toString() != '')
                                TmpRow['DTT_CODE'] = pDTTCode;
                            TmpRow['CREATED_BY'] = 1;
                            TmpRow['CREATED_DATE'] = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                            TmpItems.push(TmpRow);
                        }
                        reqTranDBHelper.InsertTranDB(pTranDB, 'TMP_PROCESS_ITEMS', TmpItems, objLogInfo, function callbackInsert(pResult, pError) {
                            if (pError) {
                                _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40156', 'Error in _InsertTmpProcessTable() function ', pError, null, '', 0, '', pCallback);
                            } else {
                                dr = null;
                                TmpRow = null;
                                RecordID = null;
                                strVersionNo = null;
                                ColName = null;
                                OldValue = null;
                                NewValue = null;
                                _PrepareAndSendCallback('SUCCESS', [], '', null, null, null, null, '', 0, '', pCallback);
                            }

                        });
                    } catch (error) {
                        dr = null;
                        TmpRow = null;
                        RecordID = null;
                        strVersionNo = null;
                        ColName = null;
                        OldValue = null;
                        NewValue = null;
                        _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40157', 'Error in _InsertTmpProcessTable() function ', error, null, '', 0, '', pCallback);
                    }
                }
            } else {
                _PrintInfo('No Solr results found');
                _PrepareAndSendCallback('SUCCESS', [], '', null, null, null, null, '', 0, '', pCallback);
            }
        } catch (error) {
            _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40158', 'Error in _InsertTmpProcessTable() function ', error, null, '', 0, '', pCallback);
        }
    }

    // Getting solr documents from Solr
    function GetPagingDocuments(pSeachParams, pRecPerPage, pCurrentPage, pNeedContentSearch, pNeedDataSearch, pGlobalSearch, pAuditVerSearch, pNeedAuditSearch, conjcond, pCallback) {
        var DCFilterCondition = '';
        var SCFilterCondition = '';
        var TempDCFilterCondition = '';
        var TempSCFilterCondition = '';
        try {
            for (var i = 0; i < pSeachParams.length; i++) {
                var BindingName = '';
                var BindingValue = '';
                var BindOperator = '';
                var dr = pSeachParams[i];
                if (dr.get('BINDING_NAME') != null && dr.get('BINDING_NAME') != undefined && dr.get('BINDING_NAME') != '')
                    BindingName = dr.get('BINDING_NAME').toString();

                if (dr.get('TMPFP_VALUE') != null && dr.get('TMPFP_VALUE') != undefined && dr.get('TMPFP_VALUE') != '')
                    BindingValue = dr.get('TMPFP_VALUE').toString();

                if (dr.get('OPERATOR') != undefined && dr.get('OPERATOR') != null && dr.get('OPERATOR') != '')
                    BindOperator = dr.get('OPERATOR').toString();

                if (BindingName.toString().toLowerCase() == '_text_') {
                    BindingName = BindingName.toString().toLowerCase();
                    BindOperator = 'CONTAINS';
                    switch (BindOperator) {
                        case '=':
                            if (TempSCFilterCondition == '')
                                TempSCFilterCondition = BindingName + ":" + BindingValue;
                            else
                                TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + BindingName + ":" + '"' + BindingValue + '"';
                            break;
                        case 'NOTEQUAL':
                            if (TempSCFilterCondition == '')
                                TempSCFilterCondition = "(" + "NOT" + " " + BindingName + ":" + '"' + BindingValue + '"' + " " + "AND" + " " + BindingName + ":" + "*" + ")";
                            else
                                TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + "(" + "NOT" + " " + BindingName + ":" + '"' + BindingValue + '"' + " " + "AND" + " " + BindingName + ":" + "*" + ")";
                            break;
                        case 'CONTAINS':
                            if (TempSCFilterCondition == '')
                                TempSCFilterCondition = BindingName + ":" + "*" + BindingValue + "*";
                            else
                                TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + '"' + BindingValue + '"' + "*";
                            break;
                        case 'STARTS':
                            if (TempSCFilterCondition == '')
                                TempSCFilterCondition = BindingName + "=" + '"' + BindingValue + '"' + "*";
                            else
                                TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + BindingName + ":" + '"' + BindingValue + "";
                            "" + "*";
                            break;
                        case 'ENDS':
                            if (TempSCFilterCondition == '')
                                TempSCFilterCondition = BindingName + "=" + "*" + '"' + BindingValue + '"';
                            else
                                TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + '"' + BindingValue + '"';
                            break;
                        case 'IN':
                            if (TempSCFilterCondition == '')
                                TempSCFilterCondition = BindingName + "=" + "*" + '"' + " " + BindingValue + " " + '"' + "*";
                            else
                                TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + '"' + " " + BindingValue + " " + '"' + "*";
                            break;
                    }
                } else {
                    // Data_type Date and time                  
                    if (dr.get('DATA_TYPE') != undefined && dr.get('DATA_TYPE') == "DATETIME" && dr.get('TMPFP_VALUE') != '*') {
                        var startday = reqDateFormat(BindingValue, "yyyy-mm-dd'T00:00:00Z'");
                        if (BindOperator == '=') {
                            var EndOfDay = reqDateFormat(BindingValue, "yyyy-mm-dd'T23:59:59Z'");
                            BindingValue = "[" + startday + " " + " TO " + EndOfDay + "]";
                        } else if (BindOperator == '>=') {
                            BindingValue = startday;
                        } else if (BindOperator == '<=') {
                            var EndOfDay = reqDateFormat(BindingValue, "yyyy-mm-dd'T23:59:59Z'");
                            BindingValue = EndOfDay;
                        }
                    }
                    switch (BindOperator) {
                        case '=':
                            if (TempDCFilterCondition == '')
                                TempDCFilterCondition = BindingName + ":" + BindingValue;
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + BindingValue;
                            break;
                        case '>=':
                            if (TempDCFilterCondition == '')
                                TempDCFilterCondition = BindingName + ":" + "[" + BindingValue + " " + "TO" + " " + "*" + "]";
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + "[" + BindingValue + " " + "TO" + " " + "*" + "]";
                            break;
                        case '<=':
                            if (TempDCFilterCondition == '')
                                TempDCFilterCondition = BindingName + ":" + "[" + "*" + " " + "TO" + " " + BindingValue + "]";
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + "[" + "*" + " " + "TO" + " " + BindingValue + "]";
                            break;
                        case 'NOTEQUAL':
                            if (TempDCFilterCondition == '')

                                TempDCFilterCondition = "(" + "NOT" + " " + BindingName + ":" + BindingValue + " " + "AND" + " " + BindingName + ":" + "*" + ")";
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + "(" + "NOT" + " " + BindingName + ":" + BindingValue + " " + "AND" + " " + BindingName + ":" + "*" + ")";
                            break;
                        case 'CONTAINS':
                            if (TempDCFilterCondition == '')

                                TempDCFilterCondition = BindingName + ":" + "*" + BindingValue + "*";
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + BindingValue + "*";
                            break;
                        case 'STARTS':
                            if (TempDCFilterCondition == '')

                                TempDCFilterCondition = BindingName + ":" + BindingValue + "*";
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + BindingValue + "*";
                            break;
                        case 'ENDS':
                            if (TempDCFilterCondition == '')

                                TempDCFilterCondition = BindingName + ":" + "*" + BindingValue;
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + BindingValue;
                            break;
                        case 'IN':
                            if (TempDCFilterCondition == '')

                                TempDCFilterCondition = BindingName + ":" + "*" + "\ " + BindingValue + "\ " + "*";
                            else
                                TempDCFilterCondition = TempDCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + "\ " + BindingValue + "\ " + "*";
                            break;
                    }
                }
            }
            if (TempDCFilterCondition != '')
                DCFilterCondition = "(" + TempDCFilterCondition.toString() + ")";

            if (TempSCFilterCondition != '')
                SCFilterCondition = "(" + TempSCFilterCondition.toString() + ")";

            var objStatus = {};

            if (SCFilterCondition != '' && pNeedContentSearch.toString().toUpperCase() == 'Y') {
                _PrintInfo('Prepared searchparam on STATIC_CORE : ' + SCFilterCondition);
                reqSolrHelper.SolrSearchWithPaging(strReqHeader, staticCore, SCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                    objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                    return pCallback(pDocuments, true, false, false, false, false, objStatus);
                });

            } else if (DCFilterCondition != '' && pGlobalSearch.toString().toUpperCase() == 'Y') {
                _PrintInfo('Prepared searchparam on DYNAMIC_CORE : ' + DCFilterCondition);
                reqSolrHelper.SolrSearchWithPaging(strReqHeader, dynamicCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                    objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                    return pCallback(pDocuments, false, true, false, false, false, objStatus);
                });

            } else if (DCFilterCondition != '' && pNeedDataSearch.toString().toUpperCase() == 'Y') {
                _PrintInfo('Prepared searchparam on DYNAMIC_CORE : ' + DCFilterCondition);
                reqSolrHelper.SolrSearchWithPaging(strReqHeader, dynamicCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                    objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                    return pCallback(pDocuments, false, false, true, false, false, objStatus);
                });
            } else if (DCFilterCondition != '' && pAuditVerSearch.toString().toUpperCase() == 'Y') {
                _PrintInfo('Prepared searchparam on AUDIT_LOG_VERSION_CORE Solr ' + DCFilterCondition);
                reqSolrHelper.LogSolrSearchWithPaging(strReqHeader, versionCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                    objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                    return pCallback(pDocuments, false, false, false, true, false, objStatus);
                });
            } else if (DCFilterCondition != '' && pNeedAuditSearch.toString().toUpperCase() == 'Y') {
                _PrintInfo('Prepared searchparam on AUDIT_LOG_CORE Solr ' + DCFilterCondition);
                reqSolrHelper.LogSolrSearchWithPaging(strReqHeader, auditCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                    objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);

                    return pCallback(pDocuments, false, false, false, false, true, objStatus);
                });
            } else {
                objStatus = _PrepareStatusObject('SUCCESS', null, null, null, null);
                return pCallback(null, false, false, false, false, false, objStatus);
            }
        } catch (error) {
            var objErr = _PrepareStatusObject('FAILURE', 'ERR-HAN-40159', 'Error in GetPagingDocuments() function', error, null);
            return pCallback(null, false, false, false, false, false, objErr);
        }
    }

    function _PrepareStatusObject(pStatus, pErrorCode, pErrorMsg, pError, pWarning) {
        var objStatus = {
            Status: pStatus,
            ErrorCode: pErrorCode,
            ErrorMsg: pErrorMsg,
            Error: pError,
            Warning: pWarning
        };
        return objStatus;
    }

    function IsDate(pDate) {
        var date = pDate;
        _PrintInfo(date instanceof Date && !isNaN(date.valueOf()));
        return (date instanceof Date && !isNaN(date.valueOf()));
    }

    function _ClearInputParams() {
        mDSCode = '';
        mEventCode = '';
        mWftpaId = '';
        mTokenId = '';
        mUID = '';
        mAppStsId = '';
        mSId = '';
        mPSId = '';
        mAppId = '';
        mAppUId = '';
        mAppRoles = '';
        mLoginName = '';
        mSystemDesc = '';
        mSolrSearchName = '';
        mDTCode = '';
        mDTTCode = '';
        mRecordPerPage = 0;
        mCurrentPageNo = 0;
        mCategory = '';
        intPageNo = 0;
        mClusterCode = '';
    }

    function _NullInpuParams() {
        mDSCode = null;
        mEventCode = null;
        mWftpaId = null;
        mTokenId = null;
        mUID = null;
        mAppStsId = null;
        mSId = null;
        mPSId = null;
        mAppId = null;
        mAppUId = null;
        mAppRoles = null;
        mLoginName = null;
        mSystemDesc = null;
        mSolrSearchName = null;
        mDTCode = null;
        mDTTCode = null;
        mRecordPerPage = null;
        mCurrentPageNo = null;
        mCategory = null;
        intPageNo = null;
        mClusterCode = null;
    }

    // Initialize input params
    function _InitializeParams(pClientParams, pSessionInfo, pCallback) {
        try {
            // Initialize params
            var SessionId = '';
            // Initialize Input params
            if (pClientParams.SESSION_ID != undefined && pClientParams.SESSION_ID != '')
                SessionId = pClientParams.SESSION_ID;

            if (pClientParams.SOLR_SEARCH_NAME != undefined && pClientParams.SOLR_SEARCH_NAME != '')
                mSolrSearchName = pClientParams.SOLR_SEARCH_NAME;

            if (pClientParams.DS_CODE != undefined && pClientParams.DS_CODE != '')
                mDSCode = pClientParams.DS_CODE;

            if (pClientParams.EVENT_CODE != undefined && pClientParams.EVENT_CODE != '')
                mEventCode = pClientParams.EVENT_CODE;

            if (pClientParams.WFTPA_ID != undefined && pClientParams.WFTPA_ID != '')
                mWftpaId = pClientParams.WFTPA_ID;

            if (pClientParams.TOKEN_ID != undefined && pClientParams.TOKEN_ID != '')
                mTokenId = pClientParams.TOKEN_ID;

            if (pClientParams.DT_CODE != undefined && pClientParams.DT_CODE != '')
                mDTCode = pClientParams.DT_CODE;

            if (pClientParams.DTT_CODE != undefined && pClientParams.DTT_CODE != '')
                mDTTCode = pClientParams.DTT_CODE;

            if (pClientParams.DT_CATEGORY != undefined && pClientParams.DT_CATEGORY != '')
                mCategory = pClientParams.DT_CATEGORY;

            if (pClientParams.BULK_UPDATE != undefined && pClientParams.BULK_UPDATE != '')
                mBulkUpdate = pClientParams.BULK_UPDATE;

            if (pClientParams.PAGENO != undefined && pClientParams.PAGENO != '')
                mCurrentPageNo = pClientParams.PAGENO;

            if (pClientParams.RECORDS_PER_PAGE != undefined && pClientParams.RECORDS_PER_PAGE != '')
                mRecordPerPage = pClientParams.RECORDS_PER_PAGE;

            // Initialize Session params
            Params = pSessionInfo;
            if (Params.U_ID != undefined && Params.U_ID != '')
                mUID = Params.U_ID;

            if (Params.APP_STS_ID != undefined && Params.APP_STS_ID != '')
                mAppStsId = Params.APP_STS_ID;

            if (Params.S_ID != undefined && Params.S_ID != '')
                mSId = Params.S_ID;

            if (Params.PARENT_S_ID != undefined && Params.PARENT_S_ID != '')
                mPSId = Params.PARENT_S_ID;

            if (Params.APP_ID != undefined && Params.APP_ID != '')
                mAppId = Params.APP_ID;

            if (Params.APPU_ID != undefined && Params.APPU_ID != '')
                mAppUId = Params.APPU_ID;

            if (Params.APP_USER_ROLES != undefined && Params.APP_USER_ROLES != '')
                mAppRoles = Params.APP_USER_ROLES;

            if (Params.LOGIN_NAME != undefined && Params.LOGIN_NAME != '')
                mLoginName = Params.LOGIN_NAME;

            if (Params.S_DESC != undefined && Params.S_DESC != '')
                mSystemDesc = Params.S_DESC;

            if (Params.S_CODE != undefined && Params.S_CODE != '')
                mSCode = Params.S_CODE;

            if (Params.CLUSTER_CODE != undefined && Params.CLUSTER_CODE != '')
                mClusterCode = Params.CLUSTER_CODE;

            if (mTokenId == '') {
                // mTokenId = objLogInfo.PROCESS_INFO.PRCT_ID;
                mTokenId = mUID + "-" + (new Date()).getMilliseconds().toString();
            }

            // used for TRAN_LOCK table insert for record lock
            RcrdLclparam.APP_ID = mAppId;
            RcrdLclparam.ACTION_ID = mWftpaId;

            return _PrepareAndSendCallback('SUCCESS', [], '', '', '', null, '', '', 0, '', pCallback);

        } catch (error) {
            return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40160', 'Error in _InitializeParams() ', error, '', '', 0, mTokenId, pCallback);
        }
    }

    // Get redis key from Redis
    function _GetRedisKey(pKey, pCallback) {
        const constSession = 'SESSIONID-';
        pKey = constSession + pKey;
        reqInstanceHelper.GetConfig(pKey, function callbackGetRedisKey(pRes, pErr) {
            pCallback(pRes, pErr);
        });
    }

    function _PrintError(pErrCode, pMessage, pError) {
        reqInstanceHelper.PrintError(serviceName, pError, pErrCode, objLogInfo, pMessage);
    }

    function _PrintInfo(pMessage) {
        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
    }

    // Prepare callback object
    function _PrepareAndSendCallback(pStatus, pQueryResult, pLockingMode, pErrorCode, pErrMsg, pError, pWarning, pSolrSearch, pTotalRecords, pTokenID, pCallback) {
        var objCallback = {
            Status: pStatus,
            ErrorCode: pErrorCode,
            ErrorMsg: pErrMsg,
            Error: pError,
            Warning: pWarning,
            QueryResult: pQueryResult,
            LockingMode: pLockingMode,
            TotalRecords: pTotalRecords,
            TokenID: pTokenID
        };
        return pCallback(objCallback, pSolrSearch, pTotalRecords, pTokenID);
    }

    // Deleting the temporary table entries
    function DeleteTmpTable(pCallback) {
        reqTranDBHelper.DeleteTranDB(pTranDB, 'TMP_PROCESS_ATTACHMENTS', {
            prct_id: mTokenId
        }, objLogInfo, function callbackDelete(pResult, pError) {
            _PrintInfo('TMP_PROCESS_ATTACHMENTS deleted');
            reqTranDBHelper.DeleteTranDB(pTranDB, 'TMP_PROCESS_ITEMS', {
                prct_id: mTokenId
            }, objLogInfo, function callbackDelete(pResult, pError) {
                _PrintInfo('TMP_PROCESS_ITEMS deleted');
                pCallback();
            });
        });
    }
}

// End WFSelect



module.exports = {
    WFSelect: WFSelect
};
/********** End of File ***********/