/**
 * Api_Name         : /GetAuditProcessDetails
 * Description      : To search the auditlog info from PRC_TOKENS_CORE
 * Last Error_Code  : ERR-AUT-15001
 Last changes		: muti tenant dummy change build
 */

// Require dependencies
var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqInstanceHelpr = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLINQ = require('node-linq').LINQ;
var reqDateFormat = require('dateformat');

// Initialize Global variables
var router = reqExpress.Router();

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
        var criteria = params.CRITERIA ? params.CRITERIA : {};
        var app_id = objLogInfo.APP_ID ? objLogInfo.APP_ID : '*';
        var menu = criteria.MODULE ? ("\"" + criteria.MODULE + "\"") : '*';
        var menu_group = criteria.MENU_GROUP ? ("\"" + criteria.MENU_GROUP + "\"") : '*';
        var menu_item = criteria.MENU_ITEM ? ("\"" + criteria.MENU_ITEM + "\"") : '*';
        var process_name = criteria.PROCESS_NAME ? ("\"" + criteria.PROCESS_NAME + "\"") : '*';
        var recordsPerPage = null;
        var currentPage = null;
        var searchCriteria = '';
        var groupFiled = 'id';
        switch (mode) {
            case 'get_modules':
                searchCriteria = '(APP_ID:' + app_id + ')';
                groupFiled = 'MODULE';
                break;
            case 'get_menugroups':
                searchCriteria = '(APP_ID:' + app_id + ' AND MODULE:' + menu + ')';
                groupFiled = 'MENU_GROUP';
                break;
            case 'get_menuitems':
                searchCriteria = '(APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ')';
                groupFiled = 'MENU_ITEM';
                break;
            case 'get_processes':
                searchCriteria = '(APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ')';
                groupFiled = 'PROCESS_NAME';
                break;
            case 'get_list':
                recordsPerPage = params.RECORDS_PER_PAGE ? params.RECORDS_PER_PAGE : '1000';
                currentPage = params.CURRENT_PAGENO ? params.CURRENT_PAGENO : '1';
                var prct_id = criteria.PRCT_ID ? criteria.PRCT_ID : '*';
                if (criteria.FILTERS) {
                    var fromDate = criteria.FILTERS.START_DATE ? criteria.FILTERS.START_DATE : '*';
                    var toDate = criteria.FILTERS.END_DATE ? criteria.FILTERS.END_DATE : '*';
                    searchCriteria = '(APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND  MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ' AND PROCESS_NAME:' + process_name + ' AND PRCT_ID:' + prct_id + ' AND CREATED_DATE: [' + fromDate + ' TO ' + toDate + '])';
                }
                else {
                    searchCriteria = '(APP_ID:' + app_id + ' AND MODULE:' + menu + ' AND MENU_GROUP:' + menu_group + ' AND MENU_ITEM:' + menu_item + ' AND PROCESS_NAME:' + process_name + ' AND PRCT_ID:' + prct_id + ')';
                }
                break;
            default:
                searchCriteria = '(APP_ID:' + app_id + ')';
                break;
        }
        getSolrResult(searchCriteria, function (error, result) {
            if (error) {
                return reqInstanceHelpr.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', error);
            } else {
                return reqInstanceHelpr.SendResponse(serviceName, appResponse, prepareResponse(result), objLogInfo);
            }
        });

        function prepareResponse(solrData) {
            var allData = solrData.grouped[groupFiled].doclist.docs;
            var objResult = {};
            objResult.PRCT_DATA = JSON.stringify(allData);
            objResult.RecordsPerPage = recordsPerPage;
            objResult.CurrentPage = currentPage;
            objResult.TotalItems = solrData.grouped[groupFiled].doclist.numFound;
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

                        over_all_doc[i].CREATED_DATE = over_all_doc[i].CREATED_DATE;
                        delete over_all_doc[i].CREATED_CLIENTIP
                    }
                    callback(null, result);
                }
            }, null, groupFiled);
        }

    });
});

module.exports = router;
