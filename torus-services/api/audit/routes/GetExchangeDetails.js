/**
 * Api_Name         : /TransactionDataSearch
 * Description      : To search the transaction data from trandb
 * Last Error_Code  : ERR-AUT-15205
 New service
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var JLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDateFormat = require(modPath + 'dateformat');

var reqMoment = require('moment');
// Initialize Global variables

var router = reqExpress.Router();

var serviceName = 'GetTransactionAttachement';

// Host the auditlog api
router.post('/GetExchangeDetails', function (appRequest, appResponse) {
    var pHeaders = appRequest.headers;

    var serviceModel = reqDBInstance.DBInstanceSession.SERVICE_MODEL;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
        var objResult = {};
        var params = appRequest.body.PARAMS;
        var strRecordsPerPage = 10;
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        var arrDateColumns = [];
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetExchangeDetails';
        var srcCriteria = '';
        var exheaderData = {};
        var resObj = {};

        TranCommentPagination = '';
        var ExhId = params.ExhId;
        var ExhFId = params.ExhFId;
        var filterTable = '';
        var arrDateColumns = ['CREATED_DATE', 'MODIFIED_DATE'];
        var DateSearch = false;
        var StartDateOnly = true;
        var orderByColumn = 'TRN_ID';
        var mode = appRequest.body.PARAMS.MODE;
        var StartDate = ''
        var fileTransdata = {};
        var EndDate = ''
        GetExchangeData();
        function __ToDate(pDate) {
            return reqDateFormat(pDate, "yyyy-mm-dd'T00:00:00Z'");
        }

        if (serviceModel.AUDIT_ARCHIVAL_MODEL == "DB") {
            // Get the data from database
            if (mode == "LIVE") {
                // reqDBInstance.GetFXDBConnection(pHeaders, "dep_cas", objLogInfo, function callback(pSession) {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                    GetExchangeData(pSession)
                })

            } else {
                reqDBInstance.GetFXDBConnection(pHeaders, 'arc_tran_db', objLogInfo, function (pSession) {
                    GetExchangeData(pSession)
                })
            }
        } else {
            // Get the data from solr
            GetExchangeData();
        }

        function GetExchangeData(pSession) {
            try {

                if (serviceModel.AUDIT_ARCHIVAL_MODEL == 'SOLR') {
                    if (params.IS_SEARCH && params.IS_SEARCH == "Y") {
                        orderByColumn = 'EXHF_ID';
                        var FileName = params.FILE_NAME;
                        var DateSearchValue = params.FILTERS.DATE_BETWEEN;
                        StartDate = DateSearchValue.START_DATE ? reqDateFormat(DateSearchValue.START_DATE, "yyyy-mm-dd'T00:00:00Z") : '*';
                        EndDate = DateSearchValue.END_DATE ? reqDateFormat(DateSearchValue.END_DATE, "yyyy-mm-dd'T00:00:00Z") : '*';
                    }
                    filterTable = 'ex_header_files';
                    srcCriteria = `CREATED_DATE:[${StartDate} TO ${EndDate} ] `;
                    srcCriteria1 = `file_name = '${FileName}'`;
                    if (ExhId) {
                        srcCriteria = `EXH_ID:${ExhId} AND FX_TABLE_NAME:ex_header_files`;
                        //"{!join from=EXH_ID to=EXH_ID from=EXHF_ID to=EXHF_ID}EXH_ID:" + ExhId; //`EXH_ID:${ExhId} and FX_TABLE_NAME:ex_header`; 

                    } else if (ExhFId) {
                        srcCriteria = `EXHF_ID:${ExhFId} AND FX_TABLE_NAME:ex_file_trans`;
                        filterTable = 'ex_file_trans';
                    } else if (FileName) {
                        srcCriteria = srcCriteria + " AND FILE_NAME:" + FileName + ' AND FX_TABLE_NAME:ex_header_files';
                        filterTable = 'ex_header_files';

                    }
                    //'(EXH_ID:' + ExhId + ')';
                    console.log("srcCriteria " + srcCriteria);
                    reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'FX_TRAN', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                        if (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                        } else {
                            var FullDoc = result.response.docs;
                            var toltalNumFound = result.response.numFound;
                            var resObj = {};

                            if (filterTable == 'ex_header_files') {
                                var exheaderFileRows = new JLinq(FullDoc).Where(function (doc) {
                                    return doc.FX_TABLE_NAME[0] === "ex_header_files";
                                }).ToArray();
                                // resObj.ExHeaderFiles = ExheaderFiles;
                                var exheaderData = {};
                                exheaderData.data = exheaderFileRows;
                                exheaderData.headerTotalRecords = toltalNumFound;
                                resObj.ExHeaderFiles = exheaderData;
                                resObj.HeaderInfo = [
                                    { "header": "Exhf Id", "field": "EXHF_ID" },
                                    { "header": "File Name", "field": "FILE_NAME" },
                                    { "header": "Status", "field": "FILE_STATUS" }
                                ];
                            } else {
                                var fileTranRows = new JLinq(FullDoc).Where(function (doc) {
                                    return doc.FX_TABLE_NAME[0] === "ex_file_trans";
                                }).ToArray();
                                var fileTransdata = {};
                                fileTransdata.data = fileTranRows;
                                fileTransdata.filetrantotalRecords = toltalNumFound;
                                resObj.FileTrans = fileTransdata;
                                resObj.HeaderInfo = [
                                    { "header": "Trn Id", "field": "TRN_ID" },
                                    { "header": "Ts Id", "field": "TS_ID" },
                                    { "header": "Dt Code", "field": "DT_CODE" },
                                    { "header": "Dtt Code", "field": "DTT_CODE" },
                                    { "header": "Date", "field": "CREATED_DATE", data_type: 'DATETIME' }
                                ];
                            }
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, resObj, objLogInfo, '', '', '', 'SUCCESS', '');
                        }
                    }, `sort=${orderByColumn}+desc`);
                } else {
                    if (params.IS_SEARCH && params.IS_SEARCH == "Y") {
                        orderByColumn = 'EXHF_ID';
                        var FileName = params.FILE_NAME;
                        var DateSearchValue = params.FILTERS.DATE_BETWEEN;
                        StartDate = DateSearchValue.START_DATE ? reqDateFormat(DateSearchValue.START_DATE, "yyyy-mm-dd") : '';
                        EndDate = DateSearchValue.END_DATE ? reqDateFormat(DateSearchValue.END_DATE, "yyyy-mm-dd") : '';
                    }


                    var query = ` SELECT * FROM EX_HEADER_FILES WHERE TENANT_ID ='${objLogInfo.TENANT_ID}' AND APP_ID='${objLogInfo.APP_ID}'`;
                    var pcond = ''
                    if (FileName) {
                        pcond = ` AND FILE_NAME='${FileName}'`
                    }
                    if (StartDate && !EndDate) {
                        pcond = ` AND  CREATED_DATE >= To_DATE('${StartDate}', 'yyyy-mm/dd') `
                    } else if (!StartDate && EndDate) {
                        pcond = ` AND  CREATED_DATE <= To_DATE('${EndDate}', 'yyyy-mm/dd') `
                    } else if (StartDate && EndDate) {
                        // between
                        pcond = `AND CREATED_DATE between TO_DATE ('${StartDate}', 'yyyy-mm/dd') AND TO_DATE ('${EndDate}', 'yyyy-mm/dd') `
                    }
                    else
                        var squery = query + pcond

                    //reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession) {
                    reqTranDBInstance.ExecuteQueryWithPagingCount(pSession, squery, strCurrentPageNo, strRecordsPerPage, objLogInfo, function (res, pCount, err) {
                        if (err) {

                        }
                        else {
                            var resdata = reqInstanceHelper.ArrKeyToUpperCase(res, objLogInfo)
                            exheaderData.data = resdata;
                            exheaderData.headerTotalRecords = pCount[0].count;
                            resObj.ExHeaderFiles = exheaderData;
                            resObj.HeaderInfo = [
                                { "header": "Exhf Id", "field": "EXHF_ID" },
                                { "header": "File Name", "field": "FILE_NAME" },
                                { "header": "Status", "field": "FILE_STATUS" }
                            ];
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, resObj, objLogInfo, '', '', '', 'SUCCESS', '');
                        }
                    })
                    //})


                }
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr', error);
            }

        }
    });
});

module.exports = router;