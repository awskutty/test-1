/**
 * Api_Name         : /TransactionDataSearch
 * Description      : To search the transaction data from trandb
 * Last Error_Code  : ERR_GETATMTDETAILS_00003
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
//const reqSharp = require('sharp'); // Its binaries will be different for Windows and Linux so 
var JLinq = require('node-linq').LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormat = require(modPath + 'dateformat');

// Initialize Global variables
var router = reqExpress.Router();
var reqmoment = require('moment');

var serviceName = 'GetTransactionAttachement';

// Host the auditlog api
router.post('/GetAtmtDetails', function callbackCpsignin(appRequest, appResponse) {
    var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
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
        var mode = appRequest.body.PARAMS.MODE
        objResult.HeaderInfo = [
            { field: 'TRN_ID', header: 'TRN_ID' },
            { field: 'TRNA_ID', header: 'TRNA_ID' },
            { field: 'RELATIVE_PATH', header: 'ATTACHMENT NAME' },
            { field: 'AT_CODE', header: 'FORMAT' }
        ];
        if (serviceModel.AUDIT_ARCHIVAL_MODEL == "DB") {
            // Get the data from database
            if (!mode || mode == "LIVE") {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (dbsession) {
                    getdatafromdb(dbsession)
                })
            } else {
                reqDBInstance.GetFXDBConnection(pHeaders, 'arc_tran_db', objLogInfo, function (dbsession) {
                    getdatafromdb(dbsession)
                })
            }
        } else {
            // Get the data from solr
            GetAtmtwithsolr();
        }


        function getdatafromdb(pconnection) {
            try {
                var strQry = ` SELECT TRN_ID,TRNA_ID,RELATIVE_PATH,AT_CODE FROM TRN_ATTACHMENTS  WHERE TENANT_ID = '${objLogInfo.TENANT_ID}' AND APP_ID = '${objLogInfo.APP_ID}' AND DTT_CODE = '${dtt_code}' AND TRN_ID = '${tran_id}' ORDER BY TRN_ID`

                reqTranDBInstance.ExecuteQueryWithPagingCount(pconnection, strQry, strCurrentPageNo, strRecordsPerPage, objLogInfo, function (pResult, pCount, pError) {
                    try {
                        if (pError) {

                        } else {
                            var arratmt = []
                            for (var i = 0; i < pResult.length; i++) {
                                var objatmt = {};
                                objatmt.RELATIVE_PATH = pResult[i].relative_path;
                                objatmt.TRNA_ID = pResult[i].trna_id;
                                objatmt.TRN_ID = pResult[i].trn_id;
                                objatmt.AT_CODE = pResult[i].at_code;
                                arratmt.push(objatmt);
                            }
                            objResult.atmtData = arratmt;
                            _getTranCommentsfromDB(pconnection)
                        }
                    } catch (error) {

                    }
                })
            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298022', 'Error on querying from db', error);
            }
        }

        function _getTranCommentsfromDB(psession) {
            try {
                var strComtsQry = `SELECT TC.CREATED_DATE,TC.VERSION_NO,TC.COMMENT_TEXT,TS.TS_ID FROM TRANSACTION_SET TS INNER JOIN TRANSACTION_COMMENTS TC ON TC.TS_ID = TS.TS_ID WHERE TS.TENANT_ID='${objLogInfo.TENANT_ID}' AND TS.APP_ID='${objLogInfo.APP_ID}' AND TS.DTT_CODE='${dtt_code}' AND TS.TRN_ID='${tran_id}'`

                reqTranDBInstance.ExecuteSQLQuery(psession, strComtsQry, objLogInfo, function (res, err) {
                    if (err) {

                    } else {
                        if (res.rows.length) {
                            var rowobj = {};
                            var commentsarr = [];
                            for (var i = 0; i < res.rows.length; i++) {
                                rowobj = {};
                                rowobj.COMMENT_TEXT = res.rows[i].comment_text;
                                rowobj.CREATED_DATE = ToDate(res.rows[i].created_date);
                                rowobj.TS_ID = res.rows[i].ts_id;
                                rowobj.VERSION_NO = res.rows[i].version_no;
                                commentsarr.push(rowobj);
                            }
                            objResult.TSComments = commentsarr;
                            objResult.TSCommentPagination = res.length;
                        }
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                    }

                })

            } catch (error) {

            }
        }

        function GetAtmtwithsolr() {
            try {
                // if(dt_code)
                srcCriteria = '(TRN_ID:' + tran_id + ' AND DT_CODE:' + dt_code + ' AND DTT_CODE:' + dtt_code + ')';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_ATMT', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        var solrAtmtData = result.response.docs;
                        var arratmt = [];
                        if (solrAtmtData.length) {
                            solrAtmtData.sort(function (a, b) { // sort object by order field
                                return a.TRNA_ID - b.TRNA_ID;
                            });
                        }
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
        var AtmTPagination = '';
        TranCommentPagination = '';

        getProcessStatusJourneyList();

        // function GethstJourneyListwithsolr() {
        //     try {
        //         srcCriteria = '(DT_CODE:' + dt_code + ' AND DTT_CODE:' + dtt_code + ' AND TRN_ID:' + tran_id + ' AND COLUMN_NAME:STATUS)';
        //         reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_JOURNEY', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
        //             if (error) {
        //                 return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298094', 'Error on querying solr TRAN_JOURNEY for STATUS CASE', error);
        //             } else {
        //                 var TranversionDetailList = result.response.docs;
        //                 var objatmt = {};
        //                 if (TranversionDetailList.length) {
        //                     TranversionDetailList.sort(function (a, b) { // sort object by order field
        //                         return a.VERSION_NO - b.VERSION_NO
        //                     })
        //                     for (var i = 0; i < TranversionDetailList.length; i++) {
        //                         objatmt = {}
        //                         objatmt.TURN_AROUND_TIME = TranversionDetailList[i].TURN_AROUND_TIME
        //                         objatmt.TRN_ID = tran_id;
        //                         objatmt.MODIFIED_DATE = (TranversionDetailList[i].MODIFIED_DATE) ? ToDate(TranversionDetailList[i].MODIFIED_DATE) : '-';
        //                         objatmt.PROCESS_STATUS = TranversionDetailList[i].PROCESS_STATUS;
        //                         objatmt.VERSION_NO = TranversionDetailList[i].VERSION_NO;
        //                         // objatmt.PROCESS_STATUS_TAT = TranversionDetailList[i].PROCESS_STATUS_TAT;
        //                         // objatmt.PROCESS_STATUS_MODIFIED_DATE = TranversionDetailList[i].PROCESS_STATUS_MODIFIED_DATE;
        //                         // objatmt.STATUS_TAT = TranversionDetailList[i].STATUS_TAT;
        //                         // objatmt.STATUS_MODIFIED_DATE = TranversionDetailList[i].STATUS_MODIFIED_DATE;
        //                         objatmt.STATUS = TranversionDetailList[i].STATUS;
        //                         arrversion.push(objatmt);
        //                     }

        //                 }
        //                 getProcessStatusJourneyList();
        //             }
        //         });
        //     } catch (error) {
        //         return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr TRAN_JOURNEY for GetHstJourneyList', error);
        //     }

        // }

        function getProcessStatusJourneyList() {
            try {


                //This will be disabled as per senthil sir commend we disable the code in future we can enabled for Transaction_journey list 

                //  srcCriteria = '(DT_CODE:' + dt_code + ' AND DTT_CODE:' + dtt_code + ' AND TRN_ID:' + tran_id + ' AND COLUMN_NAME:PROCESS_STATUS)';
                // reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_JOURNEY', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                //     if (error) {
                //         return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298093', 'Error on querying TRAN_JOURNEY for Process status solr', error);
                //     } else {
                //         var objatmt = {}
                //         var TranversionDetailProcessList = result.response.docs;
                //         if (TranversionDetailProcessList.length) {
                //             TranversionDetailProcessList.sort(function (a, b) { // sort object by order field
                //                 return a.TRN_VERSION_NO - b.TRN_VERSION_NO
                //             })
                //             for (var i = 0; i < TranversionDetailProcessList.length; i++) {
                //                 objatmt = {}
                //                 objatmt.TURN_AROUND_TIME = TranversionDetailProcessList[i].TURN_AROUND_TIME
                //                 objatmt.TRN_ID = tran_id;
                //                 objatmt.MODIFIED_DATE = (TranversionDetailProcessList[i].MODIFIED_DATE) ? ToDate(TranversionDetailProcessList[i].MODIFIED_DATE) : (TranversionDetailProcessList[i].CREATED_DATE) ? ToDate(TranversionDetailProcessList[i].CREATED_DATE) : '-';
                //                 objatmt.PROCESS_STATUS = TranversionDetailProcessList[i].PROCESS_STATUS;
                //                 objatmt.VERSION_NO = TranversionDetailProcessList[i].TRN_VERSION_NO;
                //                 objatmt.STATUS = TranversionDetailProcessList[i].STATUS;
                //                 objatmt.PROCESS_STATUS_TAT = convertSecToMins(TranversionDetailProcessList[i].PROCESS_STATUS_TAT);
                //                 objatmt.PROCESS_STATUS_MODIFIED_DATE = (TranversionDetailProcessList[i].PROCESS_STATUS_MODIFIED_DATE) ? ToDate(TranversionDetailProcessList[i].PROCESS_STATUS_MODIFIED_DATE) : '-';
                //                 objatmt.STATUS = TranversionDetailProcessList[i].STATUS;
                //                 objatmt.STATUS_TAT = convertSecToMins(TranversionDetailProcessList[i].STATUS_TAT);
                //                 objatmt.STATUS_MODIFIED_DATE = (TranversionDetailProcessList[i].STATUS_MODIFIED_DATE) ? ToDate(TranversionDetailProcessList[i].STATUS_MODIFIED_DATE) : '-';
                //                 objatmt.TRN_MODIFIED_NAME = TranversionDetailProcessList[i].TRN_MODIFIED_NAME;
                //                 objatmt.TRN_SYSTEM_NAME = TranversionDetailProcessList[i].TRN_SYSTEM_NAME;
                //                 arrProcessStatusVersion.push(objatmt);
                //             }
                //             objResult.atmtData = arrversion;
                //             objResult.ProcessStatusArr = arrProcessStatusVersion;
                //             return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                //         } else {
                //             objResult.atmtData = arrversion;
                //             objResult.ProcessStatusArr = [];
                //             return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                //         }
                //     }
                // }, 'sort=MODIFIED_DATE+asc');
                objResult.atmtData = arrversion;
                objResult.ProcessStatusArr = arrProcessStatusVersion;
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');

            } catch (error) {
                return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298001', 'Error on querying solr TRAN_JOURNEY for GetHstJourneyList', error);
            }
        }

        function convertSecToMins(seconds) {
            seconds = Number(seconds);
            var d = Math.floor(seconds / (3600 * 24));
            var h = Math.floor(seconds % (3600 * 24) / 3600);
            var m = Math.floor(seconds % 3600 / 60);
            var s = Math.floor(seconds % 60);

            var dDisplay = d > 0 ? d + (d == 1 ? " day, " : " days, ") : "";
            var hDisplay = h > 0 ? h + (h == 1 ? " hr, " : " hrs, ") : "";
            var mDisplay = m > 0 ? m + (m == 1 ? " min, " : " mins, ") : "";
            var sDisplay = s > 0 ? s + (s == 1 ? " sec" : " secs") : "";
            return dDisplay + hDisplay + mDisplay + sDisplay;
        }
        // Convert string to Date format
        function ToDate(pDate) {
            try {
                if (pDate) {
                    var Restr = reqDateFormat(pDate, "dd-mm-yyyy hh:MM:ss TT");
                    return Restr;
                }

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
        var dtt_code = appRequest.body.PARAMS.DTT_CODE;
        var strRecordsPerPage = '10';
        var strCurrentPageNo = appRequest.body.PARAMS.CURRENT_PAGENO || 1;
        var objLogInfo = {};
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'LoadAtmtFromSolr-Authentication';
        var srcCriteria = '';
        var atmtData;
        var TransactionComment = false;
        var AtmTPagination = '';
        var pcond;
        TranCommentPagination = '';
        var pResults = {};

        // GetAtmtfromsolr();

        GetDataFromDB()

        function GetDataFromDB(traquery) {


            srcCriteria = `TRN_ID='${tran_id}' AND DTT_CODE='${dtt_code}' AND app_id= '${objLogInfo.APP_ID}' AND tenant_id='${objLogInfo.TENANT_ID}'`;
            var traquery = `SELECT relative_path FROM TRN_ATTACHMENTS WHERE ${srcCriteria}`
            try {
                reqDBInstance.GetFXDBConnection(pHeaders, "res_cas", objLogInfo, function callback(resDBsession) {
                    reqTranDBInstance.GetTranDBConn(pHeaders, false, function callbackTranDBConn(pSession) {
                        reqTranDBInstance.ExecuteSQLQuery(pSession, traquery, pLogInfo, function (pResult, err) {
                            // reqTranDBInstance.GetTableFromTranDB(pSession, 'TRN_ATTACHMENTS', {
                            //     APP_ID: objLogInfo.APP_ID,
                            //     TENANT_ID: objLogInfo.TENANT_ID,
                            //     DTT_CODE: dtt_code,
                            //     TRN_ID: tran_id
                            // }, objLogInfo, function (pResult, err) {
                            if (err) {
                                return reqInstanceHelper.SendResponse(serviceName, appResponse, pResult, objLogInfo, 'ERR-AUT-298012', 'Error on querying solr', err);
                            }
                            else {

                                return reqInstanceHelper.SendResponse(serviceName, appResponse, pResult, objLogInfo, '', '', '', 'SUCCESS', '');
                                pResults.push[pResult]
                            }


                        })

                    })

                })
            }

            catch (error) {

            }
        }


        function GetAtmtfromsolr() {
            try {
                // if(dt_code)
                srcCriteria = '(TRN_ID:' + tran_id + ' AND TRNA_ID:' + trna_id + ')';
                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, 'TRAN_ATMT', srcCriteria, strRecordsPerPage, strCurrentPageNo, function callbackLogSolrSearchWithPaging(result, error) {
                    if (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, 'ERR-AUT-298002', 'Error on querying solr', error);
                    } else {
                        var atmtData = result.response.docs || [];
                        var CheckAndConvertTifReqObj = {
                            atmtData
                        };
                        CheckAndConvertTif(CheckAndConvertTifReqObj, function (error, atmtDataConvertedResult, IsTiff) {
                            objResult.atmtData = atmtDataConvertedResult;
                            objResult.AtmTPagination = result.response.numFound;
                            objResult.IsTiff = IsTiff;
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, objResult, objLogInfo, '', '', '', 'SUCCESS', '');
                        });
                    }
                });

                function CheckAndConvertTif(params, CheckAndConvertTifCB) {
                    try {
                        var atmtData = params.atmtData;
                        if (atmtData.length && Object.keys(atmtData[0]).length) {
                            if (atmtData[0].TEXT_DATA && atmtData[0].TEXT_DATA.startsWith('SUkqA')) {
                                reqInstanceHelper.PrintInfo('GETATMTDETAILS', 'Relative Path - ' + atmtData[0].RELATIVE_PATH, objLogInfo);
                                // if (atmtData[0].TEXT_DATA) {
                                reqInstanceHelper.PrintInfo('GETATMTDETAILS', 'Converting TIF Img Formats to JPEG..', objLogInfo);
                                CheckAndConvertTifCB(null, atmtData, true);
                                // Converting base64 to buffer
                                // atmtData[0].TEXT_DATA = new Buffer(atmtData[0].TEXT_DATA, 'base64');
                                // reqSharp(atmtData[0].TEXT_DATA)
                                //     .jpeg()
                                //     .toBuffer()
                                //     .then(function (buffer) {
                                //         // Converting buffer to base64
                                //         reqInstanceHelper.PrintInfo('GETATMTDETAILS', 'Successfully Converted TIF Img Formats to JPEG..', objLogInfo);
                                //         atmtData[0].TEXT_DATA = new Buffer(buffer).toString('base64');
                                //         CheckAndConvertTifCB(null, atmtData);
                                //     })
                                //     .catch(function (err) {
                                //         reqInstanceHelper.PrintError('GETATMTDETAILS', objLogInfo, 'ERR_GETATMTDETAILS_00001', 'Failed to covert TIF Img Format to Jpeg..', err);
                                //         CheckAndConvertTifCB(err, atmtData);
                                //     });
                                // } else {
                                //     reqInstanceHelper.PrintError('GETATMTDETAILS', objLogInfo, 'ERR_GETATMTDETAILS_00002', 'There is No Buffer to covert TIF Img Format to Jpeg..', '');
                                //     CheckAndConvertTifCB(null, atmtData, false);
                                // }

                            } else {
                                reqInstanceHelper.PrintInfo('GETATMTDETAILS', 'This is not a TIF img. No need to use canvas img ', objLogInfo);
                                CheckAndConvertTifCB(null, atmtData, false);
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError('GETATMTDETAILS', objLogInfo, 'ERR_GETATMTDETAILS_00003', 'Catch Error in CheckAndConvertTif()..', error);
                        CheckAndConvertTifCB(err, atmtData, false);
                    }
                }
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
                        var start_date = reqDateFormat(fromDate, "yyyy-mm-dd'T00:00:00Z'");
                    } else if (toDate != '*') {
                        var end_date = reqDateFormat(toDate, "yyyy-mm-dd'T23:59:59Z'");
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