/**
 * Api_Name         : /TransactionDataSearch
 * Description      : To search the transaction data from trandb
 * Last Error_Code  : ERR-AUT-15205
 */

 
// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqAsync = require('async');
var JLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormat = require(modPath + 'dateformat');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqCommon = require('../../../../torus-references/transaction/Common');

// Initialize Global variables
var router = reqExpress.Router();
var reqmoment = require('moment')

var serviceName = 'GetTransactionAttachement';

// Host the auditlog api
router.post('/GetAtmtDetails', function callbackCpsignin(appRequest, appResponse) {
    var pHeaders = appRequest.headers;

    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {

        var objResult = {};
        var strAppId = pSessionInfo.APP_ID; //'1002' 
        var tran_id = appRequest.body.PARAMS.TRAN_ID;
        var dt_code = appRequest.body.PARAMS.DT_CODE;
        var dtt_code = appRequest.body.PARAMS.DTT_CODE;
        var strRecordsPerPage = '10';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        var arrHeaders = [];
        var arrDateColumns = [];
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetTransactionAttachement-Authentication';
        var srcCriteria = '';
        var atmtData;
        var TransactionComment = false;
        var AtmTPagination = '';
        TranCommentPagination = '';

        GetAtmtwithsolr();

        function GetAtmtwithsolr() {
            try {
                // if(dt_code)
                srcCriteria = '(TRN_ID:' + tran_id + ')';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_ATMT', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        var solrAtmtData = result.response.docs;
                        var arratmt = [];
                        for (var i = 0; i < solrAtmtData.length; i++) {
                            var objatmt = {};
                            objatmt.RELATIVE_PATH = solrAtmtData[i].RELATIVE_PATH;
                            objatmt.TRNA_ID = solrAtmtData[i].TRNA_ID;
                            objatmt.TRN_ID = solrAtmtData[i].TRN_ID;
                            objatmt.AT_CODE = solrAtmtData[i].AT_CODE;
                            arratmt.push(objatmt);
                        }
                        objResult.atmtData = arratmt;
                        objResult.AtmTPagination = result.response.numFound;
                        srcCriteria = '(TRN_ID:' + tran_id + ' AND DT_CODE:' + dt_code + ' AND DTT_CODE:' + dtt_code + ' AND FX_TABLE_NAME:transaction_set' + ')';
                        TransactionComment = true;
                        getTranCommentsInSolr(srcCriteria, function callbackTranComments(resp) {
                            if (resp) {
                                if (resp.response.docs.length == 0) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                                } else {
                                    var ts_id = resp.response.docs[0].TS_ID;
                                    var tscondition = '(TS_ID:' + ts_id + ' AND FX_TABLE_NAME:transaction_comments' + ')';
                                    getTranCommentsInSolr(tscondition, function callbackTSComment(res, error) {
                                        if (res) {
                                            if (res.response.docs.length == 0) {
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                                            } else {
                                                var rowobj = {};
                                                var commentsarr = [];
                                                var rowData = res.response.docs;
                                                for (var i = 0; i < rowData.length; i++) {
                                                    rowobj = {};
                                                    rowobj.COMMENT_TEXT = (typeof rowData[i].COMMENT_TEXT == 'string' && rowData[i].COMMENT_TEXT) || rowData[i].COMMENT_TEXT[0];
                                                    rowobj.CREATED_DATE = ToDate(rowData[i].CREATED_DATE);
                                                    rowobj.TS_ID = rowData[i].TS_ID;
                                                    rowobj.VERSION_NO = rowData[i].VERSION_NO;
                                                    commentsarr.push(rowobj);
                                                }
                                                objResult.TSComments = commentsarr;
                                                objResult.TSCommentPagination = res.response.numFound;
                                                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                                            }

                                        }
                                    });
                                }

                            }
                        });
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr', error);
            }

        }


        function getTranCommentsInSolr(criteria, callback) {
            try {
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'FX_TRAN', criteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        callback(result);
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr in FX_TRAN', error);
            }
            // return reqInstanceHelper.SendResponse(serviceName, appResponse, atmtData, objLogInfo, '', '', '', 'SUCCESS', '');

        }



        function __ConvertDateColumn(pRes) {
            for (var k = 0; k < arrDateColumns.length; k++) {
                var strColumnName = arrDateColumns[k].toLowerCase();
                for (var j = 0; j < pRes.length; j++) {
                    var Restr = reqDateFormat(pRes[j][strColumnName], "yyyy-mm-dd HH:MM:ss");
                    pRes[j][strColumnName] = Restr;
                }
            }

        }

        // Convert string to Date format
        function ToDate(pDate) {
            try {
                if (pDate) {
                    var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss TT");
                    return Restr;
                } else {
                    return pDate;
                }

            } catch (error) {
                reqInstanceHelper.PrintInfo('GETATMTDETAILS', 'Error While Converting a Date - ' + pDate, objLogInfo);
            }
        }



        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelper.PrintError('GETATMTDETAILS', pError, pErrCode, objLogInfo, pErrMessage);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelper.PrintInfo('GETATMTDETAILS', pMessage, objLogInfo);
        }



    });
});

router.post('/GetHstTSJourneyList', function callbackCpsignin(appRequest, appResponse) {
    var FirstCreatedDate = '';
    var ProcessStatusDate = '';
    var arrversion = [];
    var arrProcessStatusVersion = [];
    var pHeaders = appRequest.headers;

    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {

        var objResult = {};
        var strAppId = pSessionInfo.APP_ID; //'1002' 
        var tran_id = appRequest.body.PARAMS.TRAN_ID;
        var dt_code = appRequest.body.PARAMS.DT_CODE;
        var dtt_code = appRequest.body.PARAMS.DTT_CODE;
        var strRecordsPerPage = '10';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        var arrHeaders = [];
        var arrDateColumns = [];
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetHstTSJourneyList-Authentication';
        var srcCriteria = '';
        var hsttsListData;
        var AtmTPagination = '';
        TranCommentPagination = '';

        GethstJourneyListwithsolr();

        function GethstJourneyListwithsolr() {
            try {
                // if(dt_code)

                srcCriteria = '(RECORD_ID:' + tran_id + ' AND COLUMN_NAME:STATUS)';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_VERSION_DETAIL', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298094', 'Error on querying solr TRAN_VERSION_DETAIL for STATUS CASE', error);
                    } else {
                        var TranversionDetailList = result.response.docs;
                        if (TranversionDetailList.length) {
                            TranversionDetailList.sort(function (a, b) { // sort object by order field
                                return a.VERSION_NO - b.VERSION_NO
                            })
                            var arrversionDetail = [];
                            for (var i = 0; i < TranversionDetailList.length; i++) {
                                var objatmt = {};
                                objatmt.VERSION_NO = TranversionDetailList[i].VERSION_NO;
                                arrversionDetail.push(objatmt);
                            }
                            reqAsync.forEachSeries(arrversionDetail, function (version, callbackseries) {
                                var strCatName = '';
                                var objCat = {};

                                _getversion(version, function (res) {
                                    callbackseries()
                                });

                            }, function (pErr) {
                                if (pErr)
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, pErr, objLogInfo, '', '', '', 'FAILURE', '');
                                else
                                    getProcessStatusJourneyList();
                            })
                        } else {
                            objResult.atmtData = [];
                            objResult.ProcessStatusArr = [];
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                        }


                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr fx_tran for GetHstJourneyList', error);
            }

        }

        function getProcessStatusJourneyList() {
            try {
                // if(dt_code)

                srcCriteria = '(RECORD_ID:' + tran_id + ' AND COLUMN_NAME:PROCESS_STATUS)';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_VERSION_DETAIL', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298093', 'Error on querying TRAN_VERSION_DETAIL for Process status solr', error);
                    } else {
                        var TranversionDetailProcessList = result.response.docs;
                        if (TranversionDetailProcessList.length) {
                            TranversionDetailProcessList.sort(function (a, b) { // sort object by order field
                                return a.VERSION_NO - b.VERSION_NO
                            })
                            var arrversionDetailProcessArr = [];
                            for (var i = 0; i < TranversionDetailProcessList.length; i++) {
                                var objatmt = {};
                                objatmt.VERSION_NO = TranversionDetailProcessList[i].VERSION_NO;
                                arrversionDetailProcessArr.push(objatmt);
                            }
                            reqAsync.forEachSeries(arrversionDetailProcessArr, function (version, callbackseries) {
                                var strCatName = '';
                                var objCat = {};

                                _getProcessStatsversion(version, function (res) {
                                    callbackseries()
                                });

                            }, function (pErr) {
                                if (pErr)
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, pErr, objLogInfo, '', '', '', 'FAILURE', '');
                                else
                                    arrversion.sort(function (a, b) { // sort object by order field
                                        return a.VERSION_NO - b.VERSION_NO
                                    })
                                arrProcessStatusVersion.sort(function (a, b) { // sort object by order field
                                    return a.VERSION_NO - b.VERSION_NO
                                })
                                ProcessStatusDate = '';
                                FirstCreatedDate = '';
                                objResult.atmtData = arrversion;
                                objResult.ProcessStatusArr = arrProcessStatusVersion;
                                // objResult.ListPagination = result.response.numFound;
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                            })
                        } else {
                            objResult.atmtData = [];
                            objResult.ProcessStatusArr = [];
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                        }



                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr fx_tran for GetHstJourneyList', error);
            }

        }






        function __ConvertDateColumn(pRes) {
            for (var k = 0; k < arrDateColumns.length; k++) {
                var strColumnName = arrDateColumns[k].toLowerCase();
                for (var j = 0; j < pRes.length; j++) {
                    var Restr = reqDateFormat(pRes[j][strColumnName], "yyyy-mm-dd HH:MM:ss");
                    pRes[j][strColumnName] = Restr;
                }
            }

        }


        function _getversion(versionNO, callback) {
            versionNO = versionNO.VERSION_NO
            srcCriteria = '(TRN_ID:' + tran_id + ' AND VERSION_NO:' + versionNO + ')'
            reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_VERSION', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                if (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298091', 'Error on querying Tran_version solr', error);
                } else {
                    var TranversionList = result.response.docs;

                    if (TranversionList.length) {
                        for (var i = 0; i < TranversionList.length; i++) {
                            var objatmt = {};
                            if (FirstCreatedDate == '') {
                                FirstCreatedDate = JSON.parse(TranversionList[i].NEW_DATA).CREATED_DATE;
                                objatmt.MODIFIED_DATE = ToDate(FirstCreatedDate);
                                objatmt.PROCESS_STATUS = JSON.parse(TranversionList[i].NEW_DATA).PROCESS_STATUS;
                                objatmt.TRN_ID = tran_id;
                                objatmt.VERSION_NO = TranversionList[i].VERSION_NO;
                                objatmt.TURN_AROUND_TIME = '-'
                                objatmt.STATUS = JSON.parse(TranversionList[i].NEW_DATA).STATUS;
                            } else {
                                var modifiydate = JSON.parse(TranversionList[i].NEW_DATA).MODIFIED_DATE;
                                var Difference = reqmoment.utc(reqmoment(modifiydate, "HH:mm:ss").diff(reqmoment(FirstCreatedDate, "HH:mm:ss"))).format("HH:mm:ss")
                                objatmt.TURN_AROUND_TIME = Difference
                                FirstCreatedDate = JSON.parse(TranversionList[i].NEW_DATA).MODIFIED_DATE;
                                objatmt.TRN_ID = tran_id;
                                objatmt.MODIFIED_DATE = ToDate(modifiydate);
                                objatmt.PROCESS_STATUS = JSON.parse(TranversionList[i].NEW_DATA).PROCESS_STATUS;
                                objatmt.VERSION_NO = TranversionList[i].VERSION_NO;
                                objatmt.STATUS = JSON.parse(TranversionList[i].NEW_DATA).STATUS;
                            }

                            arrversion.push(objatmt);
                            callback();

                            // arrversion.push(objatmt);
                        }
                    } else {
                        callback();
                    }

                }
            });
        }


        function _getProcessStatsversion(versionNO, callback) {
            versionNO = versionNO.VERSION_NO
            srcCriteria = '(TRN_ID:' + tran_id + ' AND VERSION_NO:' + versionNO + ')'
            reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_VERSION', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                if (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298092', 'Error on querying  tran version for process_status solr', error);
                } else {
                    var TranversionprocessstatusList = result.response.docs;

                    if (TranversionprocessstatusList.length) {
                        for (var i = 0; i < TranversionprocessstatusList.length; i++) {
                            var objatmt = {};
                            if (ProcessStatusDate == '') {
                                ProcessStatusDate = JSON.parse(TranversionprocessstatusList[i].NEW_DATA).CREATED_DATE;
                                objatmt.MODIFIED_DATE = ToDate(ProcessStatusDate);
                                objatmt.PROCESS_STATUS = JSON.parse(TranversionprocessstatusList[i].NEW_DATA).PROCESS_STATUS;
                                objatmt.TRN_ID = tran_id;
                                objatmt.VERSION_NO = TranversionprocessstatusList[i].VERSION_NO;
                                objatmt.TURN_AROUND_TIME = '-'
                                // objatmt.STATUS = JSON.parse(TranversionList[i].NEW_DATA).STATUS;
                            } else {
                                var modifiydate = JSON.parse(TranversionprocessstatusList[i].NEW_DATA).MODIFIED_DATE;
                                var Difference = reqmoment.utc(reqmoment(modifiydate, "HH:mm:ss").diff(reqmoment(ProcessStatusDate, "HH:mm:ss"))).format("HH:mm:ss")
                                objatmt.TURN_AROUND_TIME = Difference
                                FirstCreatedDate = JSON.parse(TranversionprocessstatusList[i].NEW_DATA).MODIFIED_DATE;
                                objatmt.TRN_ID = tran_id;
                                objatmt.MODIFIED_DATE = ToDate(modifiydate);
                                objatmt.PROCESS_STATUS = JSON.parse(TranversionprocessstatusList[i].NEW_DATA).PROCESS_STATUS;
                                objatmt.VERSION_NO = TranversionprocessstatusList[i].VERSION_NO;
                                // objatmt.STATUS = JSON.parse(TranversionList[i].NEW_DATA).STATUS;
                            }
                            arrProcessStatusVersion.push(objatmt);
                            callback();
                        }
                    } else {
                        callback();
                    }





                }
            });
        }




        // Convert string to Date format
        function ToDate(pDate) {
            try {
                var Restr = reqDateFormat(pDate, "yyyy-mm-dd hh:MM:ss TT");
                return Restr;
            } catch (error) {

            }

        }



        function _PrintError(pErrCode, pErrMessage, pError) {
            reqInstanceHelper.PrintError('GETATMTDETAILS', pError, pErrCode, objLogInfo, pErrMessage);
        }

        function _PrintInfo(pMessage) {
            reqInstanceHelper.PrintInfo('GETATMTDETAILS', pMessage, objLogInfo);
        }



    });
});



router.post('/LoadAtmtFromSolr', function callbackCpsignin(appRequest, appResponse) {
    var pHeaders = appRequest.headers;

    reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {

        var objResult = {};
        var tran_id = appRequest.body.PARAMS.TRN_ID; // TrasnactionId
        var trna_id = appRequest.body.PARAMS.TRNA_ID; //Attachment Id
        var strRecordsPerPage = '10';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'LoadAtmtFromSolr-Authentication';
        var srcCriteria = '';
        var atmtData;
        var TransactionComment = false;
        var AtmTPagination = '';
        TranCommentPagination = '';

        GetAtmtfromsolr();

        function GetAtmtfromsolr() {
            try {
                // if(dt_code)
                srcCriteria = '(TRN_ID:' + tran_id + ' AND TRNA_ID:' + trna_id + ')';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_ATMT', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        objResult.atmtData = result.response.docs;
                        objResult.AtmTPagination = result.response.numFound;
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr', error);
            }

        }
    });
});

router.post('/GetExchangeDetails', function (appRequest, appResponse) {
    var pHeaders = appRequest.headers;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {

        var objResult = {};
        var params = appRequest.body.PARAMS;
        var strRecordsPerPage = '100';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objFilters = appRequest.body.PARAMS.FILTERS;
        var objLogInfo = {};
        var arrDateColumns = [];
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'GetExchangeDetails';
        var srcCriteria = '';

        TranCommentPagination = '';
        var ExhId = params.ExhId;
        var ExhFId = params.ExhFId;
        var FileName = params.FILE_NAME;
        var filterTable = '';
        GetExchangeData();

        function GetExchangeData() {
            try {
                if (ExhId) {
                    srcCriteria = "{!join from=EXH_ID to=EXH_ID from=EXHF_ID to=EXHF_ID}EXH_ID:" + ExhId;
                } else if (ExhFId) {
                    srcCriteria = "EXHF_ID:" + ExhFId;
                    filterTable = 'ex_header_files';
                } else if (FileName) {
                    var fromDate = objFilters.DATE_BETWEEN.START_DATE ? objFilters.DATE_BETWEEN.START_DATE : '*';
                    var toDate = objFilters.DATE_BETWEEN.END_DATE ? objFilters.DATE_BETWEEN.END_DATE : '*';
                    if (fromDate != '*') {
                        var start_date = reqDateFormat(fromDate, "yyyy-mm-dd'T00:00:00Z'")
                    } else if (toDate != '*') {
                        var end_date = reqDateFormat(toDate, "yyyy-mm-dd'T23:59:59Z'")
                    }
                    srcCriteria = "FILE_NAME:*" + FileName + "* AND CREATED_DATE:[" + start_date + 'TO' + end_date + "]";
                }
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'FX_TRAN', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        var FullDoc = result.response.docs;
                        var resObj = {};
                        // var ExHFTotalRecords = result.response.numFound;
                        // var ExFileTranTotalRecords = result.response.numFound;
                        var ExheaderFiles = new JLinq(FullDoc).Where(function (doc) {
                            return doc.FX_TABLE_NAME[0] === "ex_header_files";
                        }).ToArray();
                        resObj.ExheadertotalRecords = ExheaderFiles.length;
                        resObj.ExHeaderFiles = ExheaderFiles;
                        var fileTrans = new JLinq(FullDoc).Where(function (doc) {
                            return doc.FX_TABLE_NAME[0] === "ex_file_trans";
                        }).ToArray();
                        resObj.FileTrans = fileTrans;
                        resObj.filetrantotalRecords = fileTrans.length;
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, resObj, objLogInfo, '', '', '', 'SUCCESS', '');
                    }
                });
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr', error);
            }

        }
    });
});

module.exports = router;