// Require dependencies
var reqSolrHelper = require('../../../../../torus-references/instance/SolrInstance');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var serviceName = 'LogViewerHelper';
var dateFormat = require('dateformat');

function solrLogSearch(pheader, pLogCore, strSearchCondition, pRecordsPerPage, pCurrentPage, objLogInfo, pcallback) {
    //var resObj = {};
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'SolrLogSearch method initiated', objLogInfo);
        var arrResult = [];
        var strResult = {};
        var tenant_id = objLogInfo.TENANT_ID;
        var appId = objLogInfo.APP_ID;
        var needTenant = objLogInfo.Is_Tenant;
        var isAppId = objLogInfo.isAppId
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        if (strSearchCondition != '') {
            var SearchParams = strSearchCondition;
            var SearchCondition = '';
            if (Array.isArray(SearchParams)) {
                for (i = 0; i < SearchParams.length; i++) {
                    var FieldName = SearchParams[i].FIELD;
                    var FieldValue = SearchParams[i].VALUE;
                    var FieldSubValue = SearchParams[i].SUB_VALUE;
                    var CondOperator = SearchParams[i].CONDITION;
                    if (FieldName == "" || CondOperator == "") {
                        continue;
                    }
                    if (FieldValue != "" || FieldSubValue != "") {
                        // BETWEEN operator
                        if (CondOperator.toString().toUpperCase() == "BETWEEN") {
                            if (SearchCondition == "") {
                                if (FieldValue != "") {
                                    var Val = FieldValue.toUpperCase();
                                    if (FieldName == 'STARTTIME') {
                                        var StartDate = dateFormat(Val, 'yyyy-mm-dd');
                                        StartDate = StartDate + 'T00:00:00Z';
                                        SearchCondition = FieldName + ":" + "[ " + StartDate + " TO " + "*" + " ]";
                                    } else {
                                        SearchCondition = FieldName + ":" + "[ " + Val + " TO " + "*" + " ]";
                                    }
                                } else if (FieldSubValue != "") {
                                    var Val = FieldSubValue.toUpperCase();
                                    if (FieldSubValue instanceof Date && !isNaN(new Date(FieldValue)) == true)
                                        val = FieldSubValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();
                                    if (FieldName == 'ENDTIME') {
                                        var EndDate = dateFormat(Val, 'yyyy-mm-dd');
                                        EndDate = EndDate + 'T23:59:59Z';
                                        SearchCondition = SearchCondition + " AND " + FieldName + ":" + "[ " + "*" + " TO " + EndDate + " ]";
                                    } else {
                                        SearchCondition = FieldName + ":" + "[ " + "*" + " TO " + Val + " ]";
                                    }
                                }
                            } else {
                                if (FieldValue != "") {
                                    var Val = FieldValue.toUpperCase();
                                    if (FieldValue instanceof Date && !isNaN(FieldValue.valueOf()) == true)
                                        val = FieldValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();
                                    if (FieldName == 'STARTTIME') {
                                        var StartDate = dateFormat(Val, 'yyyy-mm-dd');
                                        StartDate = StartDate + 'T00:00:00Z';

                                        if (SearchCondition) {
                                            SearchCondition = SearchCondition + " AND " + FieldName + ":" + "[ " + StartDate + " TO " + "*" + " ]";

                                        } else {
                                            SearchCondition = FieldName + ":" + "[ " + StartDate + " TO " + "*" + " ]";
                                        }
                                    } else {
                                        SearchCondition = SearchCondition + " AND " + FieldName + ":" + "[ " + Val + " TO " + "*" + " ]";
                                    }
                                } else if (FieldSubValue != "") {
                                    var Val = FieldSubValue.toUpperCase();
                                    if (FieldSubValue instanceof Date && !isNaN(FieldSubValue.valueOf()) == true)
                                        val = FieldSubValue(now, "dddd, mmmm dS, yyyy, h:MM:ss TT").toString();
                                    if (FieldName == 'ENDTIME') {
                                        var EndDate = dateFormat(Val, 'yyyy-mm-dd');
                                        EndDate = EndDate + 'T23:59:59Z';
                                        SearchCondition = SearchCondition + " AND " + FieldName + ":" + "[ " + "*" + " TO " + EndDate + " ]";
                                    } else {
                                        SearchCondition = SearchCondition + " AND " + FieldName + ":" + "[ " + "*" + " TO " + Val + " ]";
                                    }
                                }
                            }
                        }
                        if (CondOperator == "=") {
                            FieldValue = '"' + FieldValue + '"';
                        }
                        if (FieldValue.indexOf('@') > -1 && CondOperator == 'CONTAINS') {
                            FieldValue = FieldValue.replace('@', '(@)');
                        }

                        if (FieldName == 'MESSAGE') {
                            FieldValue = new Buffer.from(FieldValue).toString('base64')
                                .replace(/=/g, '');
                        }
                        // Other operators (=, CONTAINS)
                        switch (CondOperator) {
                            case "=":
                                if (SearchCondition == "") {
                                    SearchCondition = FieldName + ":" + FieldValue;
                                } else
                                    SearchCondition = SearchCondition + " AND " + FieldName + ":" + FieldValue;
                                break;
                            case "CONTAINS":
                                if (SearchCondition == '')
                                    SearchCondition = FieldName + ":" + "*" + FieldValue + "*";
                                else
                                    SearchCondition = SearchCondition + " AND " + FieldName + ":" + "*" + FieldValue + "*";
                                break;
                            case "STARTS":
                                if (SearchCondition == '')
                                    SearchCondition = FieldName + ":" + FieldValue + "*";
                                else
                                    SearchCondition = SearchCondition + " " + "AND" + " " + FieldName + ":" + FieldValue + "*";
                                break;
                        }
                    }
                }

                if (SearchCondition != "") {
                    if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                        if (needTenant) {
                            SearchCondition = "(" + SearchCondition + ' AND TENANT_ID:(' + tenant_id + " OR 0))";
                        } else {
                            SearchCondition = "(" + SearchCondition + ")";
                        }

                        if (isAppId) {
                            SearchCondition = "(" + SearchCondition + ' AND APP_ID:(' + appId + "))";
                        } else {
                            SearchCondition = "(" + SearchCondition + ")";
                        }
                        // SearchCondition = "(" + SearchCondition + ' AND TENANT_ID:' + tenant_id + ")";
                    } else {
                        SearchCondition = "(" + SearchCondition + ")";
                    }

                    reqInstanceHelper.PrintInfo(serviceName, 'Log Core is ' + pLogCore, objLogInfo);
                }
            } else if (strSearchCondition === '*') {
                if (needTenant) {
                    SearchCondition = `TENANT_ID:("${tenant_id}")`;
                }
                if (isAppId) {
                    if (SearchCondition == '') {
                        SearchCondition = `(APP_ID:("${appId}"))`;
                    } else {
                        SearchCondition = `(${SearchCondition} AND APP_ID:("${appId}"))`;
                    }

                }
                if (!needTenant && !isAppId) {
                    SearchCondition = "*:*";
                }
            }


            if (pLogCore != "AUDIT_LOG") {
                var TraceLogCore = 'TRACE_LOG_CORE';
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    TraceLogCore = 'DEBUG_LOG';
                }

                reqSolrHelper.LogSolrSearchWithPaging(pheader, TraceLogCore, SearchCondition, pRecordsPerPage, pCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                    try {
                        var ResultDocs = pDocuments;
                        if (ResultDocs.response.numFound > 0) {
                            if (ResultDocs != '' && ResultDocs.response.docs.length > 0) {
                                var inarrResult = [];
                                var inobjResult = {};
                                for (j = 0; j < ResultDocs.response.docs.length; j++) {
                                    if (typeof ResultDocs.response.docs[j].MESSAGE === 'string') {
                                        var byt = ResultDocs.response.docs[j].MESSAGE;
                                        var text = new Buffer.from(byt, 'base64').toString();
                                        ResultDocs.response.docs[j].MESSAGE = text;
                                    }
                                    inobjResult = ResultDocs.response.docs[j];
                                    inarrResult.push(inobjResult);
                                }
                                strResult.SolrDocs = inarrResult;
                                strResult.TotalNumberOfDocs = ResultDocs.response.numFound;
                                strResult.RecordsFrom = ResultDocs.response.start + 1;
                                strResult.PageCount = Math.ceil(ResultDocs.response.numFound / pRecordsPerPage);
                                strResult.RecordsTo = ResultDocs.response.start + ResultDocs.response.docs.length;
                                strResult.CurrentPage = pCurrentPage;
                                strResult.SortBy = "STARTTIME";
                                strResult.ArrangedBy = 'DESC';

                                //resObj = sendMethodResponse("SUCCESS", "", strResult, "", "", "");
                                pcallback(null, strResult);
                            }
                        } else {
                            //resObj = sendMethodResponse("SUCCESS", "No Records Found", strResult, "", "", "");
                            pcallback(null, "No Records Found");
                        }
                    } catch (error) {
                        //resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-14503", "Exception occured while fetching data from TRACE_LOG_CORE", error);
                        pcallback(error);
                    }
                });
            } else {
                // reqSolrHelper.SolrSearchWithPaging(pheader, 'AUDIT_LOG_CORE', SearchCondition, intRecordsPerPage, intCurrentPage, function callbackGetSolrPagingDetails(pDocuments) {
                //     return pcallback((pDocuments.response, true, false, false))
                // })
                // if (ResultDocs != '' && ResultDocs.SolrDocs.Count > 0) {
                //     strResult = JSON.parse(ResultDocs)
                // }

                //:Tocheck
                //resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-14504", "Core is Audit Log", "");
                pcallback(error);
            }

        }
    } catch (error) {
        //resObj = sendMethodResponse("FAILURE", "", "", "ERR-AUT-14505", "Exception occured", error);
        pcallback(error);
    }
}
module.exports = {
    SolrLogSearch: solrLogSearch
};