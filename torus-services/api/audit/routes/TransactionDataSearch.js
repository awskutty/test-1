/**
 * Api_Name         : /TransactionDataSearch
 * Description      : To search the transaction data from trandb
 * Last Error_Code  : ERR-AUT-15205
 * Last Modified For: Load Data from table 
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormat = require(modPath + 'dateformat');
var reqMoment = require('moment');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqCommon = require('../../../../torus-references/transaction/Common');

// Initialize Global variables
var router = reqExpress.Router();

var serviceName = 'TransactionDataSearch';

// Host the auditlog api
router.post('/TransactionDataSearch', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    var pHeaders = appRequest.headers;
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
        var mFXDB;
        var mTranDB;
        var objResult = {};
        var strAppId = pSessionInfo.APP_ID; //'1002' 
        var strTENANT_ID = pSessionInfo.TENANT_ID;
        //var strPRCT_ID = appRequest.body.PARAMS.PRCT_ID;
        var strDTCODE = appRequest.body.PARAMS.DT_CODE;
        var strDTTCODE = appRequest.body.PARAMS.DTT_CODE;
        var strTargetTable = appRequest.body.PARAMS.TARGET_TABLE;
        var strKeyColumn = appRequest.body.PARAMS.PRIMARY_COLUMN;
        var objFilters = appRequest.body.PARAMS.FILTERS;
        var Exchangeprocess = appRequest.body.PARAMS.PROCESS;
        var Exffg_Code = appRequest.body.PARAMS.EXFFG_CODE;
        var ConnectionMode = appRequest.body.PARAMS.MODE;
        var strRecordsPerPage = '10';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        var arrHeaders = [];
        var arrDateColumns = [];

        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'TransactionDataSearch-Authentication';
        var exprocessCriteria = '';
        var TntFilterFilter = false;
        if (Exchangeprocess === 'EXCHANGE') {


            if (serviceModel.AUDIT_ARCHIVAL_MODEL == "SOLR") {
                var fromDate = objFilters.START_DATE ? objFilters.START_DATE : '*';
                var toDate = objFilters.END_DATE ? objFilters.END_DATE : '*';
                arrDateColumns = ['CREATED_DATE', 'MODIFIED_DATE'];
                exprocessCriteria = '(TENANT_ID:' + strTENANT_ID + ' AND EXFFG_CODE:' + Exffg_Code + ' AND CREATED_DATE:[' + fromDate + ' TO ' + toDate + ']' + ')';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'FX_TRAN', exprocessCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', error);
                    } else {
                        objResult.ExchangeData = result.response.docs;
                        objResult.TotalRecords = result.response.numFound;
                        objResult.HeaderInfo = [
                            { "header": "Exh Id", "field": "EXH_ID" },
                            { "header": "Exffg COde", "field": "EXFFG_CODE" },
                            { "header": "Date", "field": "CREATED_DATE", data_type: 'DATETIME' }
                        ];
                        // __ConvertDateColumn(objResult.ExchangeData);
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                        // return _PrepareAndSendCallback('SUCCESS', auditLogVersionData, '', '', null, null, )
                    }
                }, `sort=EXH_ID+d`);
            } else {
                // Get data from Table
                __InitializeDB(pHeaders, function () {
                    var exprocessCriteria1 = `exffg_code ='${Exffg_Code}'AND tenant_id='${strTENANT_ID}' AND app_id='${strAppId}'`;
                    var squery = `SELECT exh_id,created_date,exffg_code from ex_header where ` + exprocessCriteria1;
                    // reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession) {
                    reqTranDBInstance.ExecuteQueryWithPagingCount(mTranDB, squery, strCurrentPageNo, strRecordsPerPage, objLogInfo, function (res, pCount, err) {
                        if (err) {

                        }
                        else {
                            var resdata = reqInstanceHelper.ArrKeyToUpperCase(res, objLogInfo)
                            objResult.ExchangeData = resdata;
                            objResult.TotalRecords = pCount[0].count;
                            objResult.HeaderInfo = [
                                { "header": "Exh Id", "field": "EXH_ID" },
                                { "header": "Exffg COde", "field": "EXFFG_CODE" },
                                { "header": "Date", "field": "CREATED_DATE", data_type: 'DATETIME' }
                            ];

                            return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                        }
                    })
                    // })
                })
            }

        } else {
            __InitializeDB(pHeaders, function () {
                if (strTargetTable && strKeyColumn && ConnectionMode) {
                    afterGetDetails();
                } else {
                    var cond = {
                        dt_code: strDTCODE,
                        app_id: strAppId
                    };
                    reqDBInstance.GetTableFromFXDB(mFXDB, 'DT_INFO', [], cond, objLogInfo, function (error, result) {
                        try {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'errcode', 'errmsg', error);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'DT_INFO table result count - ' + result.rows.length, objLogInfo);
                                var objDTInfo = result.rows[0];
                                var objDTTRelation = {};
                                if (objDTInfo) {
                                    objDTTRelation = JSON.parse(objDTInfo.relation_json);
                                    reqCommon.DoFilterRecursiveArr(objDTTRelation, strDTTCODE, 'DTT_CODE', 'CHILD_DTT_RELEATIONS', objLogInfo, function (cItemSet) {
                                        try {
                                            strTargetTable = cItemSet.TARGET_TABLE;
                                            strKeyColumn = cItemSet.PRIMARY_COLUMN;
                                            ConnectionMode = cItemSet.MODE;
                                            afterGetDetails();
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'errcode', 'errmsg', error);
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'errcode', 'errmsg', error);
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'errcode', 'errmsg', error);
                        }
                    });
                }
            });

        }


        function afterGetDetails() {
            __GetDFDDetail(function callbackGetDFDDetail(pDttDFDs) {
                if (pDttDFDs.Status == 'SUCCESS') {
                    if (pDttDFDs.Data.indexOf("TENANT_ID") > -1) {
                        TntFilterFilter = true;
                    }
                    __PrepareHeaderInfo(pDttDFDs.Data);
                    var strCond = __PrepareSearchParam();
                    _PrintInfo('Criteria is ' + strCond);
                    __GetTransactionData(strTargetTable, ConnectionMode, arrHeaders.join(), strCond, function callbackGetTransactionData(pStatusObject) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, pStatusObject.ErrorCode, pStatusObject.ErrorMsg, pStatusObject.Error);
                    });
                } else
                    reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, pDttDFDs.ErrorCode, pDttDFDs.ErrorMsg, pDttDFDs.Error);
            });
        }

        function __GetDFDDetail(pCallback) {
            reqDBInstance.GetTableFromFXDB(mFXDB, 'DTT_INFO', ['DTT_DFD_JSON'], {
                APP_ID: strAppId,
                DTT_CODE: strDTTCODE
            }, objLogInfo, function callbackres(err, res) {
                var strDttDfd = '';
                if (err) {
                    return _PrepareAndSendCallback('FAILURE', '', 'ERR-AUT-15201', 'Error on executing DTT_INFO table', err, null, pCallback);
                } else if (res) {
                    if (res.rows.length > 0)
                        strDttDfd = res.rows[0]['dtt_dfd_json'];
                    return _PrepareAndSendCallback('SUCCESS', strDttDfd, '', '', null, null, pCallback);
                }
            });
        }

        function __PrepareHeaderInfo(pDttDfd) {
            try {
                var arrDFDs = [];
                arrHeaders.push(strKeyColumn);
                arrDFDs.push({
                    LABEL_NAME: strKeyColumn,
                    TARGET_COLUMN: strKeyColumn,
                    DF_SEARCH: {},
                    TRAN_SEARCH: 'Y',
                    data_type: 'NUMBER'
                });
                var strDttDfd = pDttDfd.replace(/\\/g, '');
                var objDttDfd = JSON.parse(strDttDfd);
                var arrDataFormat = objDttDfd.DATA_FORMATS;
                for (var df = 0; df < arrDataFormat.length; df++) {
                    var arrDFD = arrDataFormat[df].DF_DETAILS;
                    for (var i = 0; i < arrDFD.length; i++) {
                        var currentDFD = arrDFD[i];
                        // Assigning or changing the P_KeyColumn as the TARGET_COLUMN Name [Value]
                        if (currentDFD && currentDFD.LABEL_NAME.toUpperCase() == 'P_KEYCOLUMN') {
                            currentDFD.LABEL_NAME = currentDFD.TARGET_COLUMN;
                        }
                        var objDFD = {
                            LABEL_NAME: currentDFD.LABEL_NAME,
                            TARGET_COLUMN: currentDFD.TARGET_COLUMN,
                            DF_SEARCH: currentDFD.DF_SEARCH,
                            TRAN_SEARCH: 'Y',
                            data_type: currentDFD.DATA_TYPE
                        };
                        if (currentDFD.TARGET_COLUMN) {
                            arrDFDs.push(objDFD);
                        }
                        if (currentDFD.TARGET_COLUMN) {
                            arrHeaders.push(currentDFD.TARGET_COLUMN);
                        }
                        if (currentDFD.DATA_TYPE == 'DATETIME') {
                            arrDateColumns.push(currentDFD.TARGET_COLUMN);
                        }
                    }
                }
                // Adding Static Columns
                arrHeaders.push('CREATED_BY');
                arrHeaders.push('CREATED_DATE');
                arrDateColumns.push('CREATED_DATE');
                arrHeaders.push('VERSION_NO');
                arrDFDs.push({ DF_SEARCH: {}, LABEL_NAME: 'CREATED_BY', TARGET_COLUMN: 'CREATED_BY', data_type: 'TEXT' });
                arrDFDs.push({ DF_SEARCH: {}, LABEL_NAME: 'CREATED_DATE', TARGET_COLUMN: 'CREATED_DATE', data_type: 'DATETIME' });
                arrDFDs.push({ DF_SEARCH: {}, LABEL_NAME: 'VERSION_NO', TARGET_COLUMN: 'VERSION_NO', data_type: 'INTEGER' });
                objResult.HeaderInfo = arrDFDs;
            } catch (error) {
                _PrintError('ERR-AUT-15202', 'Error on __PrepareHeaderInfo() ', error);
            }
        }

        function __GetTransactionData(pTargetTable, pMode, pColumns, pCond, pCallback) {
            try {
                var DateColumns = ['CREATED_DATE', 'MODIFIED_DATE']
                for (var i = 0; i < DateColumns.length; i++) {
                    const regex = new RegExp(`\\b${DateColumns[i]}\\b`, "gi");
                    pColumns = pColumns.replace(regex, `TO_CHAR(${DateColumns[i]},'YYYY-MM-DD HH:MI:SS:MS AM') as ${DateColumns[i]}`);
                }

                var DateOnly = ['VALUE_DATE']
                for (var i = 0; i < DateOnly.length; i++) {
                    const regex = new RegExp(`\\b${DateOnly[i]}\\b`, "gi");
                    pColumns = pColumns.replace(regex, `TO_CHAR(${DateOnly[i]},'YYYY-MM-DD') as ${DateOnly[i]}`);
                }
                var strQry = 'SELECT ' + pColumns + ' FROM ' + pTargetTable;
                var filterColumns = pColumns;
                var finalColumns = filterColumns.split(',');
                var strCriteria = '';
                var filterMode = pMode;
                // strQry = "SELECT MSTAM_ID,AUDIT_NAME,AUDIT_REF_NO,to_char(AUDIT_DATE,'yyyy-mm-dd ') AUDIT_DATE ,C_NAME,CREATED_DATE FROM MST_AUDIT_MASTER"
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && serviceModel.AUDIT_ARCHIVAL_MODEL == "SOLR") {
                    if (pCond != '') {
                        strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND TENANT_ID:' + strTENANT_ID + pCond + ')';
                    } else {
                        strCriteria = '(DT_CODE:' + strDTCODE + ' AND DTT_CODE:' + strDTTCODE + ' AND TENANT_ID:' + strTENANT_ID + ')';
                    }
                } else {
                    if (pCond) {
                        strQry = strQry + ' WHERE ' + pCond;
                    }
                    else {
                        strQry = strQry;
                    }
                }
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && serviceModel.AUDIT_ARCHIVAL_MODEL == "SOLR") {
                    reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN', strCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                        if (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', error);
                        } else {
                            var auditLogVersionData = result.response.docs;
                            var finalres = [];
                            var rowobj = {};
                            for (var i = 0; i < auditLogVersionData.length; i++) {
                                rowobj = {};
                                for (var j = 0; j <= finalColumns.length; j++) {
                                    for (keys in auditLogVersionData[i]) {
                                        if (finalColumns[j] === keys) {
                                            if (Array.isArray(auditLogVersionData[i][keys])) {
                                                rowobj[finalColumns[j].toLowerCase()] = auditLogVersionData[i][keys][0];
                                            } else {
                                                rowobj[finalColumns[j].toLowerCase()] = auditLogVersionData[i][keys];
                                            }

                                        }
                                    }

                                }
                                finalres.push(rowobj);
                            }
                            // __ConvertDateColumn(finalres);
                            objResult.TransactionData = finalres;
                            objResult.RecordsPerPage = strRecordsPerPage;
                            objResult.TotalItems = result.response.numFound;
                            objResult.PageCount = Math.ceil(result.response.numFound / strRecordsPerPage);
                            var strOffset = (strCurrentPageNo * strRecordsPerPage) - strRecordsPerPage;
                            objResult.RecordsFrom = strOffset + 1;
                            objResult.RecordsTo = strOffset + finalres.length;
                            objResult.CurrentPage = strCurrentPageNo;
                            objResult.PRIMARY_COLUMN = strKeyColumn;

                            return _PrepareAndSendCallback('SUCCESS', objResult, '', '', null, null, pCallback);


                        }
                    });
                } else {
                    reqTranDBInstance.ExecuteQueryWithPagingCount(mTranDB, strQry, strCurrentPageNo, strRecordsPerPage, objLogInfo, function callbackGetTransactionData(res, pCount, err) {
                        if (err)
                            return _PrepareAndSendCallback('FAILURE', '', 'ERR-AUT-15203', 'Error on executing query', err, null, pCallback);
                        else {
                            objResult.RecordsPerPage = strRecordsPerPage;
                            //objResult.CurrentPage = strCurrentPageNo;
                            if (res) {
                                // __ConvertDateColumn(res);
                                objResult.TransactionData = res;
                                objResult.ArchivalMode = serviceModel.AUDIT_ARCHIVAL_MODEL;
                                objResult.TotalItems = pCount[0].count;
                                objResult.PageCount = Math.ceil(pCount[0].count / strRecordsPerPage);
                                var strOffset = (strCurrentPageNo * strRecordsPerPage) - strRecordsPerPage;
                                objResult.RecordsFrom = strOffset + 1;
                                objResult.RecordsTo = strOffset + res.length;
                                objResult.CurrentPage = strCurrentPageNo;
                                objResult.PRIMARY_COLUMN = strKeyColumn;
                            } else {
                                objResult.TransactionData = [];
                                objResult.TotalItems = 0;
                                objResult.RecordsFrom = 0;
                                objResult.RecordsTo = 0;
                                objResult.CurrentPage = 0;
                            }
                            return _PrepareAndSendCallback('SUCCESS', '', '', '', null, null, pCallback);
                        }
                    });
                }
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', '', 'ERR-AUT-15204', 'Error on __GetTransactionData()', error, null, pCallback);
            }
        }

        function __ConvertDateColumn(pRes) {
            for (var k = 0; k < arrDateColumns.length; k++) {
                var strColumnName = arrDateColumns[k].toLowerCase();
                for (var j = 0; j < pRes.length; j++) {
                    try {
                        // var Restr = reqDateFormat(pRes[j][strColumnName], 'YYYY-MM-DD hh:mm:ss A');
                        var Restr = reqMoment(pRes[j][strColumnName]).format('DD-MM-YYYY hh:mm:ss A');
                    } catch (error) {

                    }
                    if (pRes[j][strColumnName]) {
                        pRes[j][strColumnName] = Restr;
                    } else {
                        pRes[j][strColumnName.toUpperCase()] = Restr;
                    }
                }
            }

        }

        // function __InitializeDB(pHeaders, prescallback) {
        //     reqDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function callback(dbsession) {
        //         mFXDB = dbsession;
        //         reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession){
        //             mTranDB = pSession;
        //             prescallback();
        //         })
        //     })
        // }


        function __InitializeDB(pHeaders, prescallback) {
            reqDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function callback(dbsession) {
                mFXDB = dbsession;
                // Get Live db connection 
                if (!ConnectionMode || ConnectionMode == 'LIVE') {
                    reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession) {
                        mTranDB = pSession;
                        prescallback();
                    });
                } else {
                    // Get archival db connection
                    reqDBInstance.GetFXDBConnection(pHeaders, "arc_tran_db", objLogInfo, function callback(dbsession) {
                        mTranDB = dbsession;
                        prescallback();
                    })
                }
            })
        }



        function __PrepareSearchParam() {
            var strWhereCond = '';
            try {
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && serviceModel.AUDIT_ARCHIVAL_MODEL == "SOLR") {
                    if (objFilters != undefined && objFilters != null)
                        Object.keys(objFilters).forEach(function (key) {
                            if (key.toUpperCase() == 'TRN_ID' && objFilters[key]) {
                                strWhereCond = __AppendCriteria(strWhereCond, strKeyColumn, objFilters[key], '');
                            } else if (key.toUpperCase() == 'USER_NAME' && objFilters[key]) {
                                if (strWhereCond) {
                                    strWhereCond = strWhereCond + ' AND (CREATED_BY_NAME :' + (objFilters[key]).toUpperCase() + ' OR MODIFIED_BY_NAME :' + (objFilters[key]).toUpperCase() + ')';
                                } else {
                                    strWhereCond = '(CREATED_BY_NAME :' + (objFilters[key]).toUpperCase() + ' OR MODIFIED_BY_NAME :' + (objFilters[key]).toUpperCase() + ')';
                                    // strWhereCond = '(CREATED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\' OR MODIFIED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\')';
                                }
                            } else if (key == 'DATE_BETWEEN') {
                                var objDate = objFilters[key];
                                if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                    // new Date(objDate.START_DATE).toISOString(),
                                    // strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', reqDateFormat(objDate.START_DATE, "yyyy-mm-dd'T00:00:00Z'"), '');
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', objDate.START_DATE, '');
                                } else if (objDate.START_DATE != "" && objDate.END_DATE != "" && objDate.END_DATE != "null" && objDate.START_DATE != "null") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', reqDateFormat(objDate.START_DATE, "yyyy-mm-dd'T00:00:00Z'"), reqDateFormat(objDate.END_DATE, "yyyy-mm-dd'T23:59:59Z'"));
                                    // strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', objDate.START_DATE, objDate.END_DATE);
                                }
                            } else if (key == 'DATE_COLUMNS') {
                                var dateColumns = objFilters[key];
                                var dateColKeys = Object.keys(dateColumns);
                                for (var i = 0; i < dateColKeys.length; i++) {
                                    var targetCol = dateColKeys[i];
                                    var objDate = dateColumns[targetCol];
                                    if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                        strWhereCond = __AppendCriteria(strWhereCond, targetCol, reqDateFormat(objDate.START_DATE, "yyyy-mm-dd'T00:00:00Z'"), '');
                                    } else if (objDate.START_DATE != "" && objDate.END_DATE != "") {
                                        strWhereCond = __AppendCriteria(strWhereCond, targetCol, reqDateFormat(objDate.START_DATE, "yyyy-mm-dd'T00:00:00Z'"), reqDateFormat(objDate.END_DATE, "yyyy-mm-dd'T23:59:59Z'"));
                                    }
                                }
                            } else {
                                if (objFilters[key] != '' && objFilters[key] != null && objFilters[key] != undefined) {
                                    if (arrDateColumns.indexOf(key) >= 0) // Date target column
                                        strWhereCond = __AppendCriteria(strWhereCond, key, objFilters[key].from, objFilters[key].to);
                                    else // Text tartget column
                                        strWhereCond = __AppendCriteria(strWhereCond, key, objFilters[key], '');
                                }
                            }
                        });
                } else {
                    if (objFilters != undefined && objFilters != null)
                        Object.keys(objFilters).forEach(function (key) {
                            if (key.toUpperCase() == 'TRN_ID' && objFilters[key]) {
                                strWhereCond = __AppendCriteria(strWhereCond, strKeyColumn, objFilters[key], '');
                            } else if (key.toUpperCase() == 'USER_NAME' && objFilters[key]) {
                                if (strWhereCond) {
                                    strWhereCond = strWhereCond + ' AND (CREATED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\' OR MODIFIED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\')';
                                } else {
                                    strWhereCond = '(CREATED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\' OR MODIFIED_BY_NAME LIKE \'' + (objFilters[key]).toUpperCase() + '%\')';
                                }
                            } else if (key == 'DATE_BETWEEN') {
                                var objDate = objFilters[key];
                                if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', __ToDate(objDate.START_DATE), '');
                                } else if (objDate.START_DATE != "" && objDate.END_DATE != "") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', __ToDate(objDate.START_DATE), __ToDate(objDate.END_DATE));
                                }
                            } else if (key == 'DATE_COLUMNS') {
                                var dateColumns = objFilters[key];
                                var dateColKeys = Object.keys(dateColumns);
                                for (var i = 0; i < dateColKeys.length; i++) {
                                    var targetCol = dateColKeys[i];
                                    var objDate = dateColumns[targetCol];
                                    if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                        strWhereCond = __AppendCriteria(strWhereCond, targetCol, __ToDate(objDate.START_DATE), '');
                                    } else if (objDate.START_DATE != "" && objDate.END_DATE != "") {
                                        strWhereCond = __AppendCriteria(strWhereCond, targetCol, __ToDate(objDate.START_DATE), __ToDate(objDate.END_DATE));
                                    }
                                }
                            } else {
                                if (objFilters[key] != '' && objFilters[key] != null && objFilters[key] != undefined) {
                                    if (arrDateColumns.indexOf(key) >= 0) // Date target column
                                        strWhereCond = __AppendCriteria(strWhereCond, key, objFilters[key].from, objFilters[key].to);
                                    else // Text tartget column
                                        strWhereCond = __AppendCriteria(strWhereCond, key, objFilters[key], '');
                                }
                            }
                        });
                }
                return strWhereCond;
            } catch (error) {
                _PrintError('ERR-AUT-15205', 'Error on __PrepareSearchParam() ', error);
            }

        }

        function __ToDate(pDate) {
            return reqDateFormatter.ConvertDate(pDate, pHeaders);
        }

        function __AppendCriteria(pWhereCond, pColumn, pValue, pValue1) {
            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0' && serviceModel.AUDIT_ARCHIVAL_MODEL == "SOLR") {
                if (pValue1 == '' || pValue1 == undefined || pValue1 == null) { // ordinary column
                    if (arrDateColumns.indexOf(pColumn) >= 0 || pColumn == 'CREATED_DATE') { // Date target column with start value alone
                        if (pWhereCond == '')
                            pWhereCond = ' AND ' + pColumn + ' :[' + '"' + pValue + '"' + " TO *" + ']';
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn + ' :[' + '"' + pValue + '"' + " TO *" + ']';
                        // pWhereCond = pWhereCond + ' AND ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd 23:59:59")) + "'";
                    } else if (pColumn.toUpperCase() == 'PRCT_ID') {
                        if (pWhereCond == '')
                            pWhereCond = ' AND ' + pColumn.toUpperCase() + ' : "' + pValue + '"';
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn.toUpperCase() + ' : "' + pValue + '"';
                    } else {
                        if (pWhereCond == '')
                            pWhereCond = ' AND ' + pColumn.toUpperCase() + ' : "' + pValue.toUpperCase() + '"';
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn.toUpperCase() + ' : "' + pValue.toUpperCase() + '"';
                    }
                } else { // Date between
                    if (pWhereCond == '')
                        pWhereCond = ' AND ' + pColumn + ":[" + pValue + " TO " + pValue1 + "]";
                    else
                        pWhereCond = pWhereCond + ' AND ' + pColumn + ":[" + pValue + " TO " + pValue1 + "]";
                    // pWhereCond = pWhereCond + ' AND ' + pColumn + " :['" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd 23:59:59")) + "'";
                }
            } else {
                if (pValue1 == '' || pValue1 == undefined || pValue1 == null) { // ordinary column
                    if (arrDateColumns.indexOf(pColumn) >= 0 || pColumn == 'CREATED_DATE') { // Date target column with start value alone
                        if (pWhereCond == '')
                            pWhereCond = ' ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd 23:59:59")) + "'";
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue, "yyyy-mm-dd 23:59:59")) + "'";
                    } else if (pColumn.toUpperCase() == 'PRCT_ID') {
                        if (pWhereCond == '')
                            pWhereCond = ' ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                    } else {
                        if (pWhereCond == '')
                            pWhereCond = ' ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                        else
                            pWhereCond = pWhereCond + ' AND ' + pColumn.toUpperCase() + " = '" + pValue + "'";
                    }
                } else { // Date between
                    if (pWhereCond == '')
                        pWhereCond = ' ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd 23:59:59")) + "'";
                    else
                        pWhereCond = pWhereCond + ' AND ' + pColumn + " BETWEEN '" + pValue + "'  AND '" + __ToDate(reqDateFormat(pValue1, "yyyy-mm-dd 23:59:59")) + "'";
                }
            }
            return pWhereCond;
        }

        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelper.PrintError('Getdttypes', pError, pErrCode, objLogInfo, pErrMessage);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelper.PrintInfo('Getdttypes', pMessage, objLogInfo);
        }

        // Prepare callback object
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
    });
});

module.exports = router;