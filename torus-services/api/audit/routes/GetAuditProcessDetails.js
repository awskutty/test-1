/**
 * Api_Name         : /GetAuditProcessDetails
 * Description      : To search the auditlog info from PRC_TOKENS_CORE
 * Last Error_Code  : ERR-AUT-15001
 Last changes		: 4267 - WP_TTA_Process lookup date search is not working properly_VAS
 */

// Require dependencies
var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqInstanceHelpr = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance')
var reqDateFormat = require('dateformat');
// Initialize Global variables
var router = reqExpress.Router();
var moment = require('moment');

var serviceName = 'GetAuditProcessDetails';

// Host the auditlog api
router.post('/GetAuditProcessDetails', function (appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, pSessionInfo) {
        var PrctCore = 'PRC_TOKENS_CORE';
        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
            PrctCore = 'PRC_TOKEN';
        }
        var headers = appRequest.headers;
        var params = appRequest.body.PARAMS;
        var mode = params.MODE;
        var ConnectionMode = appRequest.body.PARAMS.ConnectionMode;
        var criteria = params.CRITERIA ? params.CRITERIA : {};
        var app_id = objLogInfo.APP_ID ? objLogInfo.APP_ID : '*';
        var tenant_id = objLogInfo.TENANT_ID || '*';
        var menu = criteria.MODULE ? ("\"" + criteria.MODULE + "\"") : '*';
        var menu_group = criteria.MENU_GROUP ? ("\"" + criteria.MENU_GROUP + "\"") : '*';
        var menu_item = criteria.MENU_ITEM ? ("\"" + criteria.MENU_ITEM + "\"") : '*';
        var process_name = criteria.PROCESS_NAME ? ("\"" + criteria.PROCESS_NAME + "\"") : '*';
        var recordsPerPage = null;
        var currentPage = null;
        var searchCriteria = '';
        var groupFiled = 'id';

        if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
            switch (mode) {
                case 'get_modules':
                    searchCriteria = 'APP_ID:' + app_id + ')';
                    groupFiled = 'MODULE';
                    break;
                case 'get_menugroups':
                    searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ')';
                    groupFiled = 'MENU_GROUP';
                    break;
                case 'get_menuitems':
                    searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ')';
                    groupFiled = 'MENU_ITEM';
                    break;
                case 'get_processes':
                    searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ')';
                    groupFiled = 'PROCESS_NAME';
                    break;
                case 'get_list':
                    recordsPerPage = params.RECORDS_PER_PAGE ? params.RECORDS_PER_PAGE : '1000';
                    currentPage = params.CURRENT_PAGENO ? params.CURRENT_PAGENO : '1';
                    var prct_id = criteria.PRCT_ID ? criteria.PRCT_ID : '*';
                    if (criteria.FILTERS) {
                        var fromDate = criteria.FILTERS.START_DATE ? reqDateFormat(criteria.FILTERS.START_DATE, "yyyy-mm-dd'T00:00:00Z'") : '*';
                        var toDate = criteria.FILTERS.END_DATE ? reqDateFormat(criteria.FILTERS.END_DATE, "yyyy-mm-dd'T23:59:59Z'") : '*';
                        searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND  MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ' AND PROCESS_NAME:' + process_name + ' AND PRCT_ID:' + prct_id + ' AND CREATED_DATE: [' + fromDate + ' TO ' + toDate + '])';
                    }
                    else {
                        searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ' AND PROCESS_NAME:' + process_name + ' AND PRCT_ID:' + prct_id + ')';
                    }
                    break;
                default:
                    searchCriteria = 'APP_ID:' + app_id + ')';
                    break;
            }
            searchCriteria = '(TENANT_ID:' + tenant_id + ' AND ' + searchCriteria;
            getSolrResult(searchCriteria, function (error, result) {
                if (error) {
                    return reqInstanceHelpr.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', error);
                } else {
                    return reqInstanceHelpr.SendResponse(serviceName, appResponse, prepareResponse(result), objLogInfo);
                }
            });
        } else {
            _getDbConnection(function (pSession) {
                var qery = ""
                switch (mode) {
                    case 'get_modules':
                        // searchCriteria = 'APP_ID:' + app_id + ')';
                        // groupFiled = 'MODULE';
                        qery = `SELECT DISTINCT module from prc_tokens`
                        break;
                    case 'get_menugroups':
                        // searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ')';
                        // groupFiled = 'MENU_GROUP';
                        // qery = `SELECT DISTINCT menu_group, module,menu_item,process_name,prct_id,created_by,created_date from prc_tokens`
                        qery = `SELECT DISTINCT menu_group from prc_tokens`
                        break;
                    case 'get_menuitems':
                        // searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ')';
                        // groupFiled = 'MENU_ITEM';
                        qery = `SELECT DISTINCT menu_item from prc_tokens`
                        break;
                    case 'get_processes':
                        // searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ')';
                        // groupFiled = 'PROCESS_NAME';
                        qery = `SELECT DISTINCT process_name from prc_tokens`
                        break;
                    case 'get_list':
                        recordsPerPage = params.RECORDS_PER_PAGE ? params.RECORDS_PER_PAGE : '1000';
                        currentPage = params.CURRENT_PAGENO ? params.CURRENT_PAGENO : '1';
                        // var prct_id = criteria.PRCT_ID ? criteria.PRCT_ID : '*';
                        // if (criteria.FILTERS) {
                        //     var fromDate = criteria.FILTERS.START_DATE ? reqDateFormat(criteria.FILTERS.START_DATE, "yyyy-mm-dd'T00:00:00Z'") : '*';
                        //     var toDate = criteria.FILTERS.END_DATE ? reqDateFormat(criteria.FILTERS.END_DATE, "yyyy-mm-dd'T23:59:59Z'") : '*';
                        //     searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND  MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ' AND PROCESS_NAME:' + process_name + ' AND PRCT_ID:' + prct_id + ' AND CREATED_DATE: [' + fromDate + ' TO ' + toDate + '])';
                        // }
                        // else {
                        //     searchCriteria = 'APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ' AND PROCESS_NAME:' + process_name + ' AND PRCT_ID:' + prct_id + ')';
                        // }
                        qery = `select menu_group,menu_item,process_name,prct_id,created_by,created_date from prc_tokens`
                        break;
                    default:
                        searchCriteria = 'APP_ID:' + app_id + ')';
                        break;
                }
                qery = qery + ` where app_id = '${objLogInfo.APP_ID}' and tenant_id='${objLogInfo.TENANT_ID}'`
                if (criteria.MODULE) {
                    qery = qery + ` and module = '${criteria.MODULE}'`
                }
                if (criteria.MENU_GROUP) {
                    qery = qery + ` and menu_group = '${criteria.MENU_GROUP}'`
                }
                if (criteria.MENU_ITEM) {
                    qery = qery + ` and menu_item = '${criteria.MENU_ITEM}'`
                }
                if (criteria.PROCESS_NAME) {
                    qery = qery + ` and process_Name = '${criteria.PROCESS_NAME}'`
                }
                if (criteria.PRCT_ID) {
                    qery = qery + ` and prct_id = '${criteria.PRCT_ID}'`
                }

                if (criteria.FILTERS) {
                    var from_date = criteria.FILTERS.START_DATE;
                    var to_date = criteria.FILTERS.END_DATE;
                    var createddate = moment(from_date, 'YYYY-MM-DD HH:mm:ss:SSS').format('YYYY-MM-DD HH:mm:ss.SSS');
                    if (to_date) {
                        var end_date = moment(to_date, 'YYYY-MM-DD HH:mm:ss:SSS').format('YYYY-MM-DD HH:mm:ss.SSS');
                        var parts = end_date.split(' ');
                        var datePart = parts[0];
                        var timePart = parts[1];
                        var endDate = `${datePart} 23:59:59.000`;
                    }
                    if (from_date && to_date) {
                        qery = qery + `and created_date between '${createddate}' and '${endDate}'`
                    }
                    else if (from_date && !to_date) {
                        qery = qery + `and created_date>='${createddate}'`
                    }
                    else if (!from_date && to_date) {
                        qery = qery + `and created_date<='${endDate}'`
                    }
                }

                if (mode !== 'get_list') {
                    getdatawithoutpage(qery)
                } else {
                    getdatawithpage(qery)
                }
                function getdatawithoutpage(pQuery) {
                    try {
                        //  reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession) {
                        reqTranDBInstance.ExecuteSQLQuery(pSession, pQuery, objLogInfo, function (pResult, perr) {
                            if (perr) {
                            } else {
                                var resdata = reqInstanceHelpr.ArrKeyToUpperCase(pResult.rows, objLogInfo)
                                return reqInstanceHelpr.SendResponse(serviceName, appResponse, prepareResponse(resdata, pResult.rows.length), objLogInfo);
                            }
                        })
                        //})

                    } catch (error) {

                    }
                }

                function getdatawithpage(pQuery) {
                    try {
                        //reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession) {
                        reqTranDBInstance.ExecuteQueryWithPagingCount(pSession, pQuery, currentPage, recordsPerPage, objLogInfo, function (pResult, pCount, pError) {
                            if (pError) {

                            } else {
                                var resdata = reqInstanceHelpr.ArrKeyToUpperCase(pResult, objLogInfo)
                                return reqInstanceHelpr.SendResponse(serviceName, appResponse, prepareResponse(resdata, pCount[0].count), objLogInfo);
                            }
                        })
                        // })

                    } catch (error) {

                    }
                }
            })

            function _getDbConnection(pCallback) {
                if (!ConnectionMode || ConnectionMode == "LIVE") {
                    reqTranDBInstance.GetTranDBConn(headers, false, function (pSession) {
                        pCallback(pSession)
                    })
                } else if (ConnectionMode == "ARCHIVAL") {
                    reqDBInstance.GetFXDBConnection(headers, 'arc_tran_db', objLogInfo, function (pSession) {
                        pCallback(pSession)
                    })
                }
            }

        }


        function prepareResponse(data, totalItems) {
            var objResult = {};
            objResult.PRCT_DATA = JSON.stringify(data);
            objResult.RecordsPerPage = recordsPerPage;
            objResult.CurrentPage = currentPage;
            objResult.TotalItems = totalItems;
            objResult.HeaderInfo = [
                { field: 'PRCT_ID', header: 'Prct_id' },
                { field: 'MENU_GROUP', header: 'Menu Group' },
                { field: 'MENU_ITEM', header: 'Menu Item' },
                { field: 'PROCESS_NAME', header: 'Process Name' },
                { field: 'CREATED_BY', header: 'Created by' },
                { field: 'CREATED_DATE', header: 'Created Date', data_type: 'DATETIME' }
            ];
            objResult.AUDIT_ARCHIVAL_MODEL = serviceModel.AUDIT_ARCHIVAL_MODEL
            return objResult;
        }

        // Convert string to Date format
        function ToDate(pDate) {
            try {
                var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss TT");
                return Restr;
            } catch (error) {

            }
        }

        function getSolrResult(searchCriteria, callback) {
            reqSolrInstance.LogSolrSearchWithPaging(headers, PrctCore, searchCriteria, recordsPerPage, currentPage, function (result, error) {
                if (error)
                    callback(error);
                else {
                    var over_all_doc = result.grouped[groupFiled] ? result.grouped[groupFiled].doclist.docs : result.grouped.id.doclist.docs;
                    for (var i = 0; i < over_all_doc.length; i++) {
                        // over_all_doc[i].CREATED_DATE = ToDate(over_all_doc[i].CREATED_DATE);
                        over_all_doc[i].CREATED_DATE = over_all_doc[i].CREATED_DATE;
                        delete over_all_doc[i].CREATED_CLIENTIP
                        delete over_all_doc[i].MODIFIED_CLIENTIP
                    }
                    callback(null, result);
                }
            }, null, groupFiled);
        }

    });
});

module.exports = router;
