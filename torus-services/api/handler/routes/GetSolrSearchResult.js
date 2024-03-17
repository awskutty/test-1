/****
 * Api_Name         : /GetSolrSearchResult
 * Description      : To search on solr and return result
 * Last ErrorCode   : ERR-HAN-40209
 * 
 ****/

// Require dependencies
var reqDateFormat = require('dateformat');
var reqExpress = require('express');
var reqHashTable = require('jshashtable');
var reqLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSolrHelper = require('../../../../torus-references/instance/SolrInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var router = reqExpress.Router();

// Global variable declaration
var mTranDB;
var mDepCas;
var i = 1;

// Service Declaration
router.post('/GetSolrSearchResult', function (appRequest, appResponse) {
    try {
        var objLogInfo = null;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {

            // Handle the api close event from when client close the request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            objLogInfo = pLogInfo;
            objLogInfo.HANDLER_CODE = 'SOLR_SEARCH';
            objLogInfo.USER_NAME = pSessionInfo.LOGIN_NAME;
            appResponse.setHeader('Content-Type', 'application/json');

            var strCurPageNo = 1;
            var strKeyColumn = '';
            var strKeyValue = '';
            var strSearchParams = '';
            var strRecordPerPage = 0;
            var strInputParamJson = '';
            var strAppId = '';
            var strDTCode = '';
            var strDTTCode = '';
            var strWftpaId = '';
            var strSearchCode = '';
            var mTotalRecords = 0;
            strInputParamJson = appRequest.body.PARAMS;
            var strReqHeader = appRequest.headers;

            _PrintInfo('Begin');

            // Initialize params
            _InitializeParams(strInputParamJson, pSessionInfo, function callbackInitializeParam(pStatus) {
                if (pStatus.Status == 'SUCCESS') {
                    // Main function to call WFSelect
                    GetSolrSelect(function callbackGetSolrSelect(pResult) {
                        var strResult = JSON.stringify(pResult.Data);
                        var strProcessStatus = (pResult.Warning == null) ? 'SUCCESS' : 'FAILURE';
                        reqInsHelper.SendResponse('GetSolrSearchResult', appResponse, strResult, objLogInfo, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, strProcessStatus, pResult.Warning);
                    });
                } else
                    reqInsHelper.SendResponse('GetSolrSearchResult', appResponse, '', objLogInfo, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error);
            });

            // Getting started to select documents from Solr
            function GetSolrSelect(pCallback) {
                try {
                    var arrSearchInfo = [];

                    // Prepare TMP_FILTER_PARAMS for Key Column, Key_Value
                    if (strKeyColumn != '' && strKeyValue != '' && strKeyValue != 0) {

                        var strBindingName = '';
                        if (strSearchCode == 'SOLR_AUDIT_VER_SEARCH')
                            strBindingName = 'TRN_ID';
                        else if (strSearchCode == 'SOLR_AUDIT_SEARCH')
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
                    }

                    //Prepare TMP_FILTER_PARAMS for Search params 
                    if (strSearchParams != '') {
                        var objParams = '';
                        if (typeof strSearchParams == 'string') {
                            objParams = JSON.parse(strSearchParams);
                        } else {
                            objParams = strSearchParams;
                        }


                        if (strSearchCode == 'SOLR_GLOBAL_SEARCH') { // Solr Tag search
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
                            if (blnSearchParam)
                                objParams = objSrchParams;
                        }

                        for (var i = 0; i < objParams.length; i++) {
                            var rowSearchParam = objParams[i];
                            if (strSearchCode == '') { // normal search
                                if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '')
                                    continue;
                            } else // Solr search with blank search
                            {
                                if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '') {
                                    if (strSearchCode == 'SOLR_DATA_SEARCH')
                                        continue;
                                    rowSearchParam.VALUE = "*";
                                }
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
                            htBetweenFrom.put("BINDING_NAME", rowSearchParam.BINDING_NAME);
                            htBetweenFrom.put("DATA_TYPE", rowSearchParam.DATA_TYPE);
                            htBetweenFrom.put("TMPFP_VALUE", rowSearchParam.VALUE);
                            htBetweenFrom.put("OPERATOR", rowSearchParam.OPERATOR);
                            htBetweenFrom.put("GROUP_NO", 0);
                            htBetweenFrom.put("ISSEARCH", 'Y');
                            arrSearchInfo.push(htBetweenFrom);
                        }
                    }

                    var datHTs = new reqLinq(arrSearchInfo)
                        .Where(function (ht) {
                            return ht.get('DATA_TYPE') === 'DATE';
                        });

                    for (var i = 0; i < datHTs.items.length; i++)
                        datHTs.items[i]['TMPFP_VALUE'] = datHTs.items[i]['TMPFP_VALUE'].replace("'", "").trim();

                    _SolrSearch(arrSearchInfo, function callbackSolrSearch(pResult) {
                        pCallback(pResult);
                    });
                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', '', 'ERR-HAN-40201', 'Error in GetSolrSelect() function ', error, null, pCallback);
                }
            }

            // Prepare Solr searchparam and get the solr document
            function _SolrSearch(pSearchInfo, pCallback) {
                try {
                    //  SOLR search
                    var objResult = {};
                    if (pSearchInfo != null) {
                        var SolrContentSearch = 'N';
                        var SolrDataSearch = 'N';
                        var SolrGlobalSearch = 'N';
                        var SolrAuditSearch = 'N';
                        var SolrAuditVerSearch = 'N';

                        switch (strSearchCode) {
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
                                break;
                        }
                        if (SolrDataSearch == 'Y' || SolrGlobalSearch == 'Y' || SolrContentSearch == 'Y' || SolrAuditSearch == 'Y' || SolrAuditVerSearch == 'Y') {
                            // TODO Solr Select
                            var strConjCond = 'AND';
                            if (SolrGlobalSearch == 'Y')
                                strConjCond = 'OR';


                            if (SolrDataSearch == 'Y' || SolrAuditSearch == 'Y' || SolrAuditVerSearch == 'Y') {
                                if (strDTCode != '') {
                                    var reqHsh = new reqHashTable();
                                    reqHsh.put('BINDING_NAME', 'DT_CODE');
                                    reqHsh.put('TMPFP_VALUE', strDTCode);
                                    reqHsh.put('OPERATOR', '=');
                                    pSearchInfo.push(reqHsh);
                                }
                                if (strDTTCode != '') {
                                    var reqHsh = new reqHashTable();
                                    reqHsh.put('BINDING_NAME', 'DTT_CODE');
                                    reqHsh.put('TMPFP_VALUE', strDTTCode);
                                    reqHsh.put('OPERATOR', '=');
                                    pSearchInfo.push(reqHsh);
                                }
                            }
                            // get paging documents from SOLR 
                            GetPagingDocuments(pSearchInfo, strRecordPerPage, strCurPageNo, SolrContentSearch, SolrDataSearch, SolrGlobalSearch, SolrAuditVerSearch, SolrAuditSearch, strConjCond, function callbackGetPagingDocuments(pDocTables) {
                                try {
                                    if (pDocTables.Data != null) {
                                        var DocTables = pDocTables.Data;
                                        if (DocTables != undefined && DocTables.response != undefined) {
                                            if (DocTables.response.docs.length > 0) {
                                                var arrResult = _objKeyToLowerCase(DocTables.response.docs);
                                                objResult.RowData = arrResult;
                                                objResult.PagingData = DocTables.response.numFound;
                                                _PrepareAndSendCallback('SUCCESS', objResult, null, null, null, null, pCallback);
                                            } else {
                                                _PrepareAndSendCallback('SUCCESS', objResult, null, null, null, 'No data found', pCallback);
                                            }
                                        } else {
                                            _PrepareAndSendCallback('FAILURE', objResult, 'ERR-HAN-40202', 'Error on Solr ', DocTables.message, null, pCallback);
                                        }
                                    } else
                                        pCallback(pDocTables);
                                } catch (error) {
                                    _PrepareAndSendCallback('FAILURE', objResult, 'ERR-HAN-40203', 'Error in GetPagingDocuments() function ', error, null, pCallback);
                                }
                            });
                        } else
                            _PrepareAndSendCallback('FAILURE', objResult, 'ERR-HAN-40204', '', null, 'Solr searchcode not found', pCallback);
                    } else
                        _PrepareAndSendCallback('FAILURE', objResult, 'ERR-HAN-40205', 'Error in GetPagingDocuments() function ', null, 'There is no SearchInfo found', pCallback);
                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', objResult, 'ERR-HAN-40206', 'Error in GetPagingDocuments() function ', error, null, pCallback);
                }
            }

            // Convert object keys to lowercase
            function _objKeyToLowerCase(pArrObj) {
                var arrObject = [];
                for (var i = 0; i < pArrObj.length; i++) {
                    var pObj = {};
                    for (var key in pArrObj[i]) {
                        var strLowerCaseKey = key.toLowerCase();
                        pObj[strLowerCaseKey] = pArrObj[i][key];
                    }
                    arrObject.push(pObj);
                }
                return arrObject;
            }

            // Getting documents from Solr based on Solr searchcode
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
                                        TempSCFilterCondition = TempSCFilterCondition + " " + conjcond + " " + BindingName + ":" + "*" + BindingValue + "*";
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

                    if (SCFilterCondition != '' && pNeedContentSearch.toString().toUpperCase() == 'Y') {
                        _PrintInfo('GetSolrSearchResult', 'Prepared searchparam on STATIC_CORE Solr ' + DCFilterCondition);
                        reqSolrHelper.SolrSearchWithPaging(strReqHeader, staticCore, SCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                            _PrepareAndSendCallback('SUCCESS', pDocuments, null, null, null, null, pCallback);
                        });

                    } else if (DCFilterCondition != '' && pGlobalSearch.toString().toUpperCase() == 'Y') {
                        _PrintInfo('GetSolrSearchResult', 'Prepared searchparam on DYNAMIC_CORE Solr ' + DCFilterCondition);
                        reqSolrHelper.SolrSearchWithPaging(strReqHeader, dynamicCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                            _PrepareAndSendCallback('SUCCESS', pDocuments, null, null, null, null, pCallback);
                        });

                    } else if (DCFilterCondition != '' && pNeedDataSearch.toString().toUpperCase() == 'Y') {
                        _PrintInfo('GetSolrSearchResult', 'Prepared searchparam on DYNAMIC_CORE Solr ' + DCFilterCondition);
                        reqSolrHelper.SolrSearchWithPaging(strReqHeader, dynamicCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                            _PrepareAndSendCallback('SUCCESS', pDocuments, null, null, null, null, pCallback);
                        });
                    } else if (DCFilterCondition != '' && pAuditVerSearch.toString().toUpperCase() == 'Y') {
                        _PrintInfo('Prepared searchparam on AUDIT_LOG_VERSION_CORE Solr ' + DCFilterCondition);
                        reqSolrHelper.LogSolrSearchWithPaging(strReqHeader, versionCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                            _PrepareAndSendCallback('SUCCESS', pDocuments, null, null, null, null, pCallback);
                        });
                    } else if (DCFilterCondition != '' && pNeedAuditSearch.toString().toUpperCase() == 'Y') {
                        _PrintInfo('Prepared searchparam on AUDIT_LOG_CORE Solr ' + DCFilterCondition);
                        reqSolrHelper.LogSolrSearchWithPaging(strReqHeader, auditCore, DCFilterCondition, pRecPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                            _PrepareAndSendCallback('SUCCESS', pDocuments, null, null, null, null, pCallback);
                        });
                    } else
                        _PrepareAndSendCallback('SUCCESS', null, null, null, null, 'Solr searchparam or Solr searchcode not found', pCallback);
                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40207', 'Error in GetPagingDocuments() function', error, null, pCallback);
                }
            }



            // Initialize params
            function _InitializeParams(pInputParamJson, pSessionInfo, pCallback) {
                try {
                    // Initialize client level params
                    if (pInputParamJson.KEY_COLUMN != undefined && pInputParamJson.KEY_COLUMN != '')
                        strKeyColumn = pInputParamJson.KEY_COLUMN;

                    if (pInputParamJson.KEY_VALUE != undefined && pInputParamJson.KEY_VALUE != '')
                        strKeyValue = pInputParamJson.KEY_VALUE;

                    if (pInputParamJson.SEARCHPARAMS != undefined && pInputParamJson.SEARCHPARAMS != '')
                        strSearchParams = pInputParamJson.SEARCHPARAMS;

                    if (pInputParamJson.DT_CODE != undefined && pInputParamJson.DT_CODE != '')
                        strDTCode = pInputParamJson.DT_CODE;

                    if (pInputParamJson.DTT_CODE != undefined && pInputParamJson.DTT_CODE != '')
                        strDTTCode = pInputParamJson.DTT_CODE;

                    if (pInputParamJson.CURR_PGNO != undefined && pInputParamJson.CURR_PGNO != '')
                        strCurPageNo = pInputParamJson.CURR_PGNO;

                    if (pInputParamJson.RECORDS_PER_PAGE != undefined && pInputParamJson.RECORDS_PER_PAGE != '')
                        strRecordPerPage = pInputParamJson.RECORDS_PER_PAGE;

                    if (pInputParamJson.WFTPA_ID != undefined && pInputParamJson.WFTPA_ID != '')
                        strWftpaId = pInputParamJson.WFTPA_ID;

                    if (pInputParamJson.SEARCH_CODE != undefined && pInputParamJson.SEARCH_CODE != '')
                        strSearchCode = pInputParamJson.SEARCH_CODE;

                    // Initialize session level params
                    if (pSessionInfo.APP_ID != undefined && pSessionInfo.APP_ID != '')
                        strAppId = pSessionInfo.APP_ID;



                    _PrepareAndSendCallback('SUCCESS', null, null, null, null, null, pCallback);

                } catch (error) {
                    _PrepareAndSendCallback('FAILURE', null, 'ERR-HAN-40208', 'Error in _InitializeParams() function ', error, null, pCallback);
                }
            }

            // Prepare callback object
            function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
                pCallbackObj = {
                    Status: pStatus,
                    Data: pData,
                    ErrorCode: pErrorCode,
                    ErrorMsg: pErrMsg,
                    Error: pError,
                    Warning: pWarning
                };
                return pCallback(pCallbackObj);
            }

            // Print Error message
            function _PrintError(pErrCode, pMessage, pError) {
                reqInsHelper.PrintError('GetSolrSearchResult', objLogInfo, pErrCode, pMessage, pError);
            }

            // Print information
            function _PrintInfo(pMessage) {
                reqInsHelper.PrintInfo('GetSolrSearchResult', pMessage, objLogInfo);
            }
        });
    } catch (error) {
        reqInsHelper.SendResponse('GetSolrSearchResult', appResponse, '', null, 'ERR-HAN-40209', 'Error on GetSolrSearchResult API ', error);
    }
}); // End of GetSolrSearchResult
module.exports = router;