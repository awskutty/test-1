/*
@Api_Name           : /SearchLogDetails,
@Description        : To search the log data from Solr
@Last_Error_code    : ERR-AUT-14506
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogviewerHelper = require('./helper/LogviewerHelper');

//Global Variables
var strSearchQuery = "select * from trace_log $WHERE order by starttime desc";
var strTotalRecordsQry = "select count(app_id) as count from trace_log $WHERE";


var serviceName = 'SearchLogDetails';

// Host the GetAppInfo api
router.post('/SearchLogDetails', function (appRequest, appResponse, pNext) {
    try {
        var objLogInfo;
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var TraceLogCore = 'TRACE_LOG_CORE';
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            TraceLogCore = 'DEBUG_LOG';
        }

        // Prepare json to send to client
        function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
            var obj = {
                "STATUS": status,
                "SUCCESS_MESSAGE": successMessage,
                "SUCCESS_DATA": SuccessDataObj,
                "ERROR_CODE": errorCode,
                "ERROR_MESSAGE": errorMessage,
                "ERROR_OBJECT": errorObject
            };
            return obj;
        }

        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

            objLogInfo.HANDLER_CODE = 'SEARCH_LOG_DETAILS';
            objLogInfo.PROCESS = 'SearchLogDetails-Authentication';
            objLogInfo.ACTION = 'SearchLogDetails';

            // Handle the close event when client closes the api request
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);

            var strCondition = '';
            var serviceModel = reqDBInstance.DBInstanceSession.SERVICE_MODEL;
            var intRecordsPerPage = 10;
            var intCurrentPage = 0;
            var ClientParams = appRequest.body.PARAMS;
            var pheader = appRequest.headers;
            var strSeviceModel = '';
            objLogInfo['Is_Tenant'] = ClientParams.isTenant;
            objLogInfo['isAppId'] = ClientParams.isAppId;
            strCondition = ClientParams.LOG_DETAILS.length ? ClientParams.LOG_DETAILS : [{ FIELD: "LOGTYPE", VALUE: "INFO", CONDITION: "=" }];
            if (ClientParams.RECORDS_PER_PAGE != '')
                intRecordsPerPage = ClientParams.RECORDS_PER_PAGE;
            if (ClientParams.PAGE_NO != '' && ClientParams.PAGE_NO != undefined)
                intCurrentPage = ClientParams.PAGE_NO;

            if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                logSearch();
            } else {
                DBLogSearch(pheader, "TRACE", strCondition, intRecordsPerPage, intCurrentPage, function (Logresult) {
                    if (Logresult.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, Logresult.SUCCESS_DATA, '', '', '', '');
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', '', Logresult.ERROR_CODE, Logresult.ERROR_MESSAGE, Logresult.ERROR_OBJECT);
                    }
                })
				
				
            }

            // Search with solr query with input conditions

            function logSearch() {
                try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Log Search method initated successfully', objLogInfo);
                    objLogInfo['Is_Tenant'] = ClientParams.isTenant;
                    objLogInfo['isAppId'] = ClientParams.isAppId;
                    if (ClientParams.LOG_DETAILS != '')
                        strCondition = ClientParams.LOG_DETAILS;
                    if (ClientParams.RECORDS_PER_PAGE != '')
                        intRecordsPerPage = ClientParams.RECORDS_PER_PAGE;
                    if (ClientParams.PAGE_NO != '' && ClientParams.PAGE_NO != undefined)
                        intCurrentPage = ClientParams.PAGE_NO;
                    reqInstanceHelper.PrintInfo(serviceName, 'Search log method called', objLogInfo);
                    SearchLog(pheader, TraceLogCore, strCondition, intRecordsPerPage, intCurrentPage, function (Logresult) {
                        if (Logresult.STATUS === "SUCCESS") {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, Logresult.SUCCESS_DATA, '', '', '', '');
                        } else {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', '', Logresult.ERROR_CODE, Logresult.ERROR_MESSAGE, Logresult.ERROR_OBJECT);
                        }
                    });
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, '', 'ERR-AUT-14501', 'Exception occured in logsearch method', error);
                }
            }


            // Call the log search based on Service Model
            function SearchLog(pheader, pLogCore, strSearchCondition, pRecordsPerPage, pageNum, pcallback) {
                if (strSearchCondition == '') {
                    strSearchCondition = "*"
                }
                var pServiceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                try {
                    if (pServiceModel != '' && pServiceModel != undefined) {
                        strSeviceModel = pServiceModel.TYPE;
                    }
                    reqInstanceHelper.PrintInfo(serviceName, 'Service model is ' + strSeviceModel, objLogInfo);
                    reqLogviewerHelper.SolrLogSearch(pheader, pLogCore, strSearchCondition, pRecordsPerPage, pageNum, objLogInfo, function CallbackSolrLogSearch(error, result) {
                        if (error) {
                            pcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14502', 'Exception occured in SearchLog', error));
                        } else {
                            if (result.SolrDocs && result.SolrDocs.length) {
                                var solrDoc = result.SolrDocs;
                                for (let x = 0; x < solrDoc.length; x++) {
                                    var element = solrDoc[x];
                                    if (element.HOST_NAME) {
                                        element.MESSAGE = element.MESSAGE.replace(new RegExp(element.HOST_NAME + ' \t', 'g'), '');
                                    }
                                    delete element.CLIENTIP;
                                    delete element.CLIENTURL;
                                    delete element.SERVICEURL
                                }
                            }
                            pcallback(sendMethodResponse("SUCCESS", "", result, "", "", ""));
                        }
                    });

                } catch (error) {
                    pcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-14502', 'Exception occured in SearchLog', error));
                }
            }

            function DBLogSearch(pheader, pLogCore, strSearchCondition, pRecordsPerPage, pageNum, pcallback) {
                try {
                    var arrResult = [];
                    var strResult = {};
                    if (strSearchCondition != '') {
                        var SearchParams = strSearchCondition;
                        var SearchCondition = '';
                        for (i = 0; i < SearchParams.length; i++) {
                            var FieldName = SearchParams[i].FIELD
                            var FieldValue = SearchParams[i].VALUE
                            var FieldSubValue = SearchParams[i].SUB_VALUE
                            var CondOperator = SearchParams[i].CONDITION
                            if (FieldName == "" || CondOperator == "") {
                                continue
                            }

                            // Solr Condition formation
                            if (FieldName.toUpperCase == 'ACTION' || FieldName.toUpperCase == 'PROCESS' || FieldName.toUpperCase == 'SERVICE_URL' || FieldName.toUpperCase == 'PRCT_ID') {
                                FieldName = "el." + FieldName
                            }
                            if (FieldValue != "" || FieldSubValue != "") {
                                // BETWEEN operator
                                if (CondOperator.toString().toUpperCase() == "BETWEEN") {
                                    if (SearchCondition == "") {
                                        if (FieldValue != "") {
                                            var Val = FieldValue.toUpperCase();
                                            // if (new Date(FieldValue) instanceof Date && !isNaN(new Date(FieldValue)) == true)
                                            //     val = FieldValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();
                                            SearchCondition = FieldName + " >= '" + Val + "'"
                                        } else if (FieldSubValue != "") {
                                            var Val = FieldSubValue.toUpperCase();
                                            if (FieldSubValue instanceof Date && !isNaN(new Date(FieldValue)) == true)
                                                val = FieldSubValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();

                                            SearchCondition = FieldName + " <= '" + Val + "'"
                                        }
                                    } else {
                                        if (FieldValue != "") {
                                            var Val = FieldValue.toUpperCase();
                                            if (FieldValue instanceof Date && !isNaN(FieldValue.valueOf()) == true)
                                                val = FieldValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();
                                            SearchCondition = SearchCondition + " AND " + FieldName + " >= '" + Val + "'"
                                        } else if (FieldSubValue != "") {
                                            var Val = FieldSubValue.toUpperCase();
                                            if (FieldSubValue instanceof Date && !isNaN(FieldSubValue.valueOf()) == true)
                                                val = FieldSubValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();
                                            SearchCondition = SearchCondition + " AND " + FieldName + " <= '" + Val + "'"
                                        }
                                    }
                                }

                                // Other operators (=, CONTAINS)
                                switch (CondOperator) {
                                    case "=":
                                        if (SearchCondition == "") {
                                            SearchCondition = FieldName + " = '" + FieldValue + "'"
                                        } else
                                            SearchCondition = SearchCondition + " AND " + FieldName + " = '" + FieldValue + "'"
                                        break;
                                    case "CONTAINS":
                                        if (SearchCondition == '')
                                            SearchCondition = FieldName + " like " + "('%" + FieldValue + "%')"
                                        else
                                            SearchCondition = SearchCondition + " AND " + FieldName + " like " + "('%" + FieldValue + "%')"
                                        break;
                                    case "STARTS":
                                        // if (SearchCondition == '')
                                        //     SearchCondition = FieldName + " like " + "('" + FieldValue + "%')"
                                        // else
                                        //     SearchCondition = SearchCondition + " AND " + FieldName + " like " + "('" + FieldValue + "%')"
                                        // break;
                                        if (SearchCondition == '')

                                            SearchCondition = FieldName + ":" + FieldValue + "*"
                                        else
                                            SearchCondition = SearchCondition + " " + "AND" + " " + FieldName + ":" + FieldValue + "*"
                                        break
                                }
                            }
                        }
                        // Search condition formation finished. 
                        // Search Solr and return result json 
                        if (SearchCondition != "") {
                            // SearchCondition = "(" + SearchCondition.trimEnd(" AND ").Trim() + ")"
                            SearchCondition = "(" + SearchCondition + ")"
                            //SearchCondition = "(" + SearchCondition + " & sort STARTTIME desc)"
                            if (pLogCore != "AUDIT_LOG") {
                                //reqSolrHelper.LogSolrSearchWithPaging(pheader, 'TRACE_LOG_CORE', SearchCondition, intRecordsPerPage, intCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                                //SearchLog(strSeviceModel, function callbackGetSolrPagingDetails(pDocuments) {
                                reqDBInstance.GetFXDBConnection(pheader, 'log_cas', objLogInfo, function CallbackGetFXDBConn(pClient) {
                                    // reqTranDBInstance.GetTranDBConn(pheader, false, function (pClient) {
                                    try {
                                        if (SearchCondition != '') {
                                            SearchCondition = ' where ' + SearchCondition
                                        }
                                        var strQry = strSearchQuery.replace('$WHERE', SearchCondition)
                                        var strTmpTotalRecordsQry = strTotalRecordsQry.replace('$WHERE', SearchCondition)
                                        // Assign paging offsets
                                        var strOffset = (pageNum * pRecordsPerPage) - pRecordsPerPage;

                                        function _wrapRawQuery(pTranDB, pQuery, pDBType) {
                                            try {
                                                if (pDBType.toLowerCase() == 'oracledb') {
                                                    return pTranDB().from(pTranDB.raw('(' + pQuery + ')'));
                                                } else {
                                                    return pTranDB().from(pTranDB.raw('(' + pQuery + ') as rawquery'));
                                                }
                                                // return pTranDB.raw(pQuery);
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, error, '', null);
                                            }
                                        }
                                        strQry = _wrapRawQuery(pClient.DBConn.Connection, strQry, pClient.DBConn.DBType).limit(pRecordsPerPage).offset(strOffset); // + ' offset ' + strOffset + ' limit ' + pRecordsPerPage
                                        var strTotalRecords = '0';
                                        reqDBInstance.ExecuteQuery(pClient, strTmpTotalRecordsQry, objLogInfo, function CallbackTotalRec(pError, pResCount) {
                                            // reqTranDBInstance.ExecuteSQLQuery(pClient, strTmpTotalRecordsQry, objLogInfo, function (pResCount, pError) {
                                            try {
                                                if (!pError) {
                                                    strTotalRecords = pResCount.rows[0].count

                                                    reqDBInstance.ExecuteQuery(pClient, strQry.toString(), objLogInfo, function CallbackExecuteQry(pError, pResult) {
                                                        // reqTranDBInstance.ExecuteSQLQuery(pClient, strQry.toString(), objLogInfo, function (pResult, pError) {
                                                        try {
                                                            var ResultDocs = pResult
                                                            if (ResultDocs != '' && ResultDocs.rows.length > 0) {
                                                                var inarrResult = [];
                                                                var inobjResult = {};
                                                                for (j = 0; j < ResultDocs.rows.length; j++) {
                                                                    // if (typeof ResultDocs.rows[j].MESSAGE === 'string') {
                                                                    //     var byt = ResultDocs.rows[j].MESSAGE;
                                                                    //     var text = new Buffer(byt, 'base64').toString();
                                                                    //     ResultDocs.rows[j].MESSAGE = text
                                                                    // }
                                                                    inobjResult = ResultDocs.rows[j];
                                                                    inarrResult.push(inobjResult);
                                                                }
                                                                strResult.SolrDocs = arrKeyToUpperCase(inarrResult, objLogInfo);
                                                                strResult.TotalNumberOfDocs = strTotalRecords;
                                                                strResult.RecordsFrom = strOffset + 1;
                                                                strResult.PageCount = Math.ceil(strTotalRecords / intRecordsPerPage);
                                                                strResult.RecordsTo = strOffset + ResultDocs.rows.length;
                                                                strResult.CurrentPage = intCurrentPage;
                                                                strResult.SortBy = "STARTTIME";
                                                                strResult.ArrangedBy = 'DESC';
                                                                // pcallback(strResult);
                                                                pcallback(sendMethodResponse("SUCCESS", "", strResult, "", "", ""));
                                                            } else {
                                                                strResult.TotalNumberOfDocs = 0;
                                                                strResult.RecordsFrom = 0;
                                                                strResult.PageCount = 0;
                                                                strResult.RecordsTo = 0;
                                                                strResult.CurrentPage = 0;
                                                                strResult.SortBy = "STARTTIME";
                                                                strResult.ArrangedBy = 'DESC';
                                                                // pcallback(strResult);
                                                                pcallback(sendMethodResponse("SUCCESS", "", strResult, "", "", ""));

                                                            }
                                                        } catch (ex) {
                                                            return reqInstanceHelper.SendResponse("ERR-FX-10152", "Error in SearchLogDetails function ERR-002 " + ex)
                                                        }
                                                    })
                                                }
                                            } catch (ex) {
                                                return reqInstanceHelper.SendResponse("ERR-FX-10152", "Error in SearchLogDetails function ERR-002 " + ex)
                                            }
                                        })
                                    } catch (ex) {
                                        return reqInstanceHelper.SendResponse("ERR-FX-10152", "Error in SearchLogDetails function ERR-002 " + ex)
                                    }
                                })
                            } else {
                                // To Do - for audit log
                            }
                        }

                    }
                } catch (error) {
                    return reqInstanceHelper.SendResponse("ERR-FX-10152", "Error in SearchLogDetails function ERR-002 " + error)
                }
            }

            //this will return object with keys in uppercase
            function arrKeyToUpperCase(pArr, pLogInfo) {
                try {
                    var arrForReturn = [];
                    for (var i = 0; i < pArr.length; i++) {
                        var obj = pArr[i];
                        var objNew = new Object();
                        for (var key in obj) {
                            var strUpperCaseKey = key.toUpperCase();
                            objNew[strUpperCaseKey] = obj[key];
                        }
                        arrForReturn.push(objNew);
                    }
                    return arrForReturn;
                } catch (error) {
                    printError(error, 'ERR-FX-12217', pLogInfo);
                    return null;
                }
            }
        });
    } catch (error) {
        resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-14506", "Exception occured", error);
        pcallback(resObj);
    }
});

module.exports = router;
/*********** End of Service **********/