/*
@Api_Name         : /ExportPdf,
@Description      : To Get the Solr data which is used for PDf download in Client Side
@Last_Error_code  : ERR_EXPORTPDF_0007
@Changed for      : page break , page height  
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDateFormat = require('dateformat');

var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');


var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqSvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var async = require('async');
router.post('/ExportPdf', function (appRequest, appResponse) {
    try {
        var ServiceName = 'ExportPdf';
        var errCode = '';
        var errMessage = '';
        var arrDateColumns = [];
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS || {};
        var strDTCODE = params.DT_CODE;
        var strDTTCODE = params.DTT_CODE;
        var tranOnly = params.TRAN_ONLY;
        var strKeyColumn = params.PRIMARY_COLUMN;
        var objFilters = params.FILTERS;
        var isTranOnly = params.TRAN_ONLY;
        var DttDesc = params.DTT_DESC;
        var maxRowsCount = 1000;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            var strTENANT_ID = objSessionInfo.TENANT_ID || 'keeqb';
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (clt_cas_instance) {
                    var cond = {};
                    cond.setup_code = 'AUDIT_EXPORT';
                    var AUDIT_EXPORT = {};
                    reqSvchelper.GetSetupJson(clt_cas_instance, cond, objLogInfo, function (res) {
                        if (res.Status == 'SUCCESS') {
                            if (res.Data.length) {
                                var setup_json = JSON.parse(res.Data[0].setup_json);
                                if (setup_json) {
                                    var objsetupJson = setup_json.audit_export;
                                    var reqColumnsDtl = objsetupJson.filter((vale) => {
                                        return vale.DTT_CODE == strDTTCODE;
                                    });

                                    if (reqColumnsDtl.length) {
                                        AUDIT_EXPORT = reqColumnsDtl[0].COLUMNS;
                                        maxRowsCount = isTranOnly ? reqColumnsDtl[0].MAX_ROWS : reqColumnsDtl[0].MAX_ROWS_WITH_IMAGE;
                                    } else {
                                        errCode = 'ERR_EXPORTPDF_0011';
                                        errMessage = 'Tenant Setup Not for selected dtt_code ';
                                        reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                                        return reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, '');
                                    }
                                }
                            }

                            if (params && Object.keys(params).length) {
                                reqInstanceHelper.PrintInfo(ServiceName, '**************** AUDIT EXPORT CONFIGURATION ****************', objLogInfo);
                                reqInstanceHelper.PrintInfo(ServiceName, 'Max Record Count - ' + maxRowsCount, objLogInfo);
                                reqInstanceHelper.PrintInfo(ServiceName, 'DT_CODE - ' + strDTCODE, objLogInfo);
                                reqInstanceHelper.PrintInfo(ServiceName, 'DTT_CODE - ' + strDTTCODE, objLogInfo);
                                var reqGetDataFromSolrCoreObj = {};
                                reqGetDataFromSolrCoreObj.DT_CODE = strDTCODE;
                                reqGetDataFromSolrCoreObj.DTT_CODE = strDTTCODE;
                                reqGetDataFromSolrCoreObj.CORE_NAME = 'TRAN';
                                reqGetDataFromSolrCoreObj.MAX_ROWS_COUNT = maxRowsCount;
                                reqGetDataFromSolrCoreObj.AUDIT_EXPORT = AUDIT_EXPORT;
                                GetDataFromSolrCore(reqGetDataFromSolrCoreObj, objLogInfo, function (error, result) {
                                    try {

                                        var TrnData = result;
                                        var content = [

                                            {
                                                "table": {
                                                    "body": [
                                                        [{
                                                            text: "Report Name : ",
                                                            style: "label"
                                                        }, {
                                                            text: `${reqColumnsDtl[0].REPORT_NAME}`,
                                                            style: "ReportHeader"
                                                        }]
                                                    ]
                                                },
                                                layout: 'noBorders'
                                            }
                                            ,
                                            {
                                                "table": {
                                                    "body": [
                                                        [{
                                                            text: "Report Date : ",
                                                            style: "label"
                                                        }, {
                                                            text: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo, "DD-MMM-YYYY hh.mm A"),
                                                            style: "ReportHeader"
                                                        }]
                                                    ]
                                                },
                                                layout: 'noBorders'
                                            },
                                            {
                                                "table": {
                                                    "body": [
                                                        [{
                                                            text: "Total Records : ",
                                                            style: "label"
                                                        }, {
                                                            text: result.length,
                                                            style: "ReportHeader"
                                                        }]
                                                    ]
                                                },
                                                layout: 'noBorders'
                                            },
                                            '\n\n'

                                        ];
                                        var pdfStyle = {
                                            styles: {
                                                tableHeader: {
                                                    fontSize: 15,
                                                    align: 'center',
                                                    bold: true,
                                                    margin: [0, 0, 0, 10],
                                                    fillColor: 'gray'

                                                },
                                                ReportHeader: {
                                                    fontSize: 20,
                                                    color: 'blue'
                                                },
                                                label: {
                                                    fontSize: 20,
                                                    color: 'black'
                                                },
                                                NoImg: {
                                                    color: "red",
                                                    fontSize: 15
                                                }
                                            },
                                            pageStyle: {
                                                width: reqColumnsDtl[0].PAGE_WIDTH || 1200,
                                                height: reqColumnsDtl[0].PAGE_HEIGHT || 1000
                                            },
                                            FileName: `${reqColumnsDtl[0].REPORT_NAME}- ${reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo, "DD-MMM-YYYY hh.mm A")}.pdf`
                                        };

                                        if (error) {
                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, error);
                                        } else {
                                            var reqColumn = reqColumnsDtl[0].COLUMNS.split(',');
                                            if (isTranOnly) {
                                                var colHeader = _preparePdfColHeader(reqColumn);
                                                var bodyData = [];
                                                bodyData.push(colHeader);
                                                _prepareColumnValues(result, reqColumn, bodyData);
                                                var tabledata = {};
                                                tabledata.table = { body: bodyData };
                                                content.push(tabledata);
                                                var resData = {
                                                    pdfcontent: content,
                                                    pdfstyles: pdfStyle
                                                };
                                                reqInstanceHelper.SendResponse(ServiceName, appResponse, resData, objLogInfo, '', '', '');
                                            } else {
                                                reqGetDataFromSolrCoreObj.CORE_NAME = 'TRAN_ATMT';
                                                reqGetDataFromSolrCoreObj.TRAN_ONLY = tranOnly;
                                                reqSolrInstance.GetSolrLogConn(pHeaders, 'TRAN_ATMT', function (solr_atmt_instance, error) {
                                                    async.forEachOfSeries(result, function (data, idx, Callback) {

                                                        var solrAtmtCond = `DTT_CODE:"${strDTTCODE}" AND TENANT_ID:"${strTENANT_ID}" AND TRN_ID: ${data[data.KEY_COLUMN[0]]}`;
                                                        var solrAtmtQuery = solr_atmt_instance.createQuery().q(solrAtmtCond).fl("TEXT_DATA,RELATIVE_PATH");
                                                        solr_atmt_instance.search(solrAtmtQuery, function (error, solrDocs) {
                                                            if (solrDocs && solrDocs.response && solrDocs.response.docs && solrDocs.response.docs.length) {
                                                                TrnData[idx]["IMAGEDATA"] = solrDocs.response.docs;
                                                            }
                                                            Callback();
                                                        });
                                                    }, function (error) {
                                                        if (!error) {
                                                            for (var i = 0; i < TrnData.length; i++) {
                                                                var tableobj = {};
                                                                var tableBody = [];
                                                                var colHeader = [{
                                                                    text: 'SNo',
                                                                    style: 'tableHeader'
                                                                }];
                                                                for (var col = 0; col < reqColumn.length; col++) {
                                                                    var colhdObj = {};
                                                                    colhdObj.text = reqColumn[col];
                                                                    colhdObj.style = 'tableHeader';
                                                                    colHeader.push(colhdObj);
                                                                }

                                                                tableBody.push(colHeader);

                                                                var objdata = TrnData[i];
                                                                delete objdata.KEY_COLUMN;
                                                                var columvalues = [];
                                                                columvalues.push(i + 1);
                                                                for (var j = 0; j < reqColumn.length; j++) {
                                                                    if (objdata[reqColumn[j]]) {
                                                                        columvalues.push(objdata[reqColumn[j]]);
                                                                    } else {
                                                                        columvalues.push('');
                                                                    }
                                                                }
                                                                tableBody.push(columvalues);

                                                                // _prepareColumnValues([TrnData[i]], reqColumn, tableBody);

                                                                tableobj.table = { body: tableBody };
                                                                content.push(tableobj);
                                                                var columns = [];
                                                                content.push('\n');
                                                                if (TrnData[i].IMAGEDATA) {
                                                                    for (var k = 0; k < TrnData[i].IMAGEDATA.length; k++) {
                                                                        if (TrnData[i].IMAGEDATA[k].RELATIVE_PATH[0].indexOf('.TIF') == -1) {
                                                                            var imgobj = {};
                                                                            imgobj.image = `data:image/jpeg;base64,${TrnData[i].IMAGEDATA[k].TEXT_DATA}`;
                                                                            imgobj.width = reqColumnsDtl[0].IMG_WIDTH || 300;
                                                                            columns.push(imgobj);
                                                                        } else {
                                                                            content.push({
                                                                                text: "Not able to show image ",
                                                                                style: "NoImg"

                                                                            },
                                                                            );
                                                                        }
                                                                    }

                                                                    if (i < TrnData.length) {
                                                                        content.push({ columns, columnGap: 10, pageBreak: 'after' });
                                                                        content.push('\n\n\n');
                                                                    }

                                                                } else {
                                                                    content.push({
                                                                        text: "Image not available",
                                                                        style: "NoImg"
                                                                    }, "\n\n\n");
                                                                }
                                                            }
                                                            var resData = {
                                                                pdfcontent: content,
                                                                pdfstyles: pdfStyle
                                                            };
                                                            reqInstanceHelper.SendResponse(ServiceName, appResponse, resData, objLogInfo, '', '', '');

                                                        }

                                                    });
                                                });

                                            }
                                        }
                                    } catch (error) {
                                        errCode = 'ERR_EXPORTPDF_0010';
                                        errMessage = 'Exception Occured after GetDataFromSolrCore ';
                                        reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                                        reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, '');
                                    }
                                });
                            } else {
                                errCode = 'ERR_EXPORTPDF_0001';
                                errMessage = 'There is No Input Param from client side';
                                reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                                reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, '');
                            }
                        } else {
                            errCode = 'ERR_EXPORTPDF_0003';
                            errMessage = 'Error While Getting AUDIT_EXPORT From Platform Setup Table..';
                            reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, '');
                            reqInstanceHelper.SendResponse(ServiceName, appResponse, '', objLogInfo, errCode, errMessage, 'FAILURE');
                        }
                    });

                });
            });

            function _preparePdfColHeader(pColumns) {
                try {
                    reqInstanceHelper.PrintInfo(ServiceName, '_preparePdfColHeader function executing', objLogInfo);
                    var colHeader = [{
                        text: 'SNo',
                        style: 'tableHeader'
                    }];

                    for (var i = 0; i < pColumns.length; i++) {
                        var colobj = {};
                        colobj.text = pColumns[i];
                        colobj.style = 'tableHeader';
                        colHeader.push(colobj);
                    }
                    return colHeader;
                } catch (error) {
                    console.log(error);
                }
            }


            function _prepareColumnValues(pRows, reqColumn, body) {
                try {
                    for (var i = 0; i < pRows.length; i++) {
                        var objdata = pRows[i];
                        delete objdata.KEY_COLUMN;
                        var columvalues = [];
                        columvalues.push(i + 1);
                        for (var j = 0; j < reqColumn.length; j++) {
                            if (objdata[reqColumn[j]]) {
                                columvalues.push(objdata[reqColumn[j]]);
                            } else {
                                columvalues.push('');
                            }
                        }
                        body.push(columvalues);

                    }
                    return;
                } catch (error) {

                }
            }
            function __PrepareSearchParam() {
                var strWhereCond = '';
                try {
                    if (objFilters) {
                        Object.keys(objFilters).forEach(function (key) {
                            if (key.toUpperCase() == 'TRN_ID' && objFilters[key]) {
                                strWhereCond = __AppendCriteria(strWhereCond, strKeyColumn, objFilters[key], '');
                            } else if (key.toUpperCase() == 'USER_NAME' && objFilters[key]) {
                                if (strWhereCond) {
                                    strWhereCond = strWhereCond + ' AND (CREATED_BY_NAME :' + (objFilters[key]).toUpperCase() + ' OR MODIFIED_BY_NAME :' + (objFilters[key]).toUpperCase() + ')';
                                } else {
                                    strWhereCond = '(CREATED_BY_NAME :' + (objFilters[key]).toUpperCase() + ' OR MODIFIED_BY_NAME :' + (objFilters[key]).toUpperCase() + ')';
                                }
                            } else if (key == 'DATE_BETWEEN') {
                                var objDate = objFilters[key];
                                if (objDate.START_DATE != "" && objDate.END_DATE == "") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', objDate.START_DATE, '');
                                } else if (objDate.START_DATE != "" && objDate.END_DATE != "" && objDate.END_DATE != "null" && objDate.START_DATE != "null") {
                                    strWhereCond = __AppendCriteria(strWhereCond, 'CREATED_DATE', reqDateFormat(objDate.START_DATE, "yyyy-mm-dd'T00:00:00Z'"), reqDateFormat(objDate.END_DATE, "yyyy-mm-dd'T23:59:59Z'"));
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

                    }
                    return strWhereCond;
                } catch (error) {
                    errCode = 'ERR_EXPORTPDF_0003';
                    errMessage = 'Catch Error in __PrepareSearchParam()..';
                    reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
                }

            }


            function __AppendCriteria(pWhereCond, pColumn, pValue, pValue1) {
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
                return pWhereCond;
            }



            function GetDataFromSolrCore(params, objLogInfo, GetDataFromSolrCoreCB) {
                try {

                    // var Columdtl = params.AUDIT_EXPORT;
                    var Columdtl = params.AUDIT_EXPORT.toUpperCase() + ",KEY_COLUMN".replace(/ /g, '');
                    var dt_code = params.DT_CODE;
                    var dtt_code = params.DTT_CODE;
                    var maxRowsCount = params.MAX_ROWS_COUNT;
                    var coreName = params.CORE_NAME;
                    reqSolrInstance.GetSolrLogConn(pHeaders, coreName, function (solr_tran_instance, error) {
                        if (error) {
                            errCode = 'ERR_EXPORTPDF_0006';
                            errMessage = 'Error While Getting Solr Connection ';
                            reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
                            GetDataFromSolrCoreCB(error, []);
                        } else {

                            var solrCond = '';
                            var filterCond = '';
                            if (coreName.toUpperCase() == 'TRAN') {
                                filterCond = __PrepareSearchParam();
                            }

                            // solrCond = `DT_CODE:${dt_code}`;
                            solrCond = `DT_CODE:"${dt_code}" AND DTT_CODE:"${dtt_code}" AND TENANT_ID:"${strTENANT_ID}"` + filterCond;
                            // solrCond = `(DT_CODE:"${dt_code}" AND DTT_CODE:"${dtt_code}")`;
                            reqInstanceHelper.PrintInfo(ServiceName, coreName + ' Sol Query | ' + solrCond, objLogInfo);
                            var solrQuery = solr_tran_instance.createQuery().q(solrCond).fl(Columdtl);
                            solrQuery.start(0).rows(maxRowsCount);
                            try {
                                solr_tran_instance.search(solrQuery, function (error, solrDocs) {
                                    if (error) {
                                        errCode = 'ERR_EXPORTPDF_0004';
                                        errMessage = 'Error While Getting Data from Solr ' + coreName + ' Core..';
                                        reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
                                        GetDataFromSolrCoreCB(error, []);
                                    } else {
                                        if (solrDocs && solrDocs.response) {
                                            reqInstanceHelper.PrintInfo(ServiceName, coreName + ' Sol Docs Count | ' + solrDocs.response.numFound, objLogInfo);
                                            GetDataFromSolrCoreCB(error, solrDocs.response.docs);
                                        } else {

                                            GetDataFromSolrCoreCB(error, []);
                                        }
                                    }
                                });
                            } catch (error) {
                                errCode = 'ERR_EXPORTPDF_0005';
                                errMessage = 'Catch Error in solr_tran_instance Callback()';
                                reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
                                GetDataFromSolrCoreCB(error, []);
                            }
                        }
                    });
                } catch (error) {
                    errCode = 'ERR_EXPORTPDF_0006';
                    errMessage = 'Catch Error in GetDataFromSolrCore() ';
                    reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
                    GetDataFromSolrCoreCB(error, []);
                }
            }
        });
    } catch (error) {
        errCode = 'ERR_EXPORTPDF_0002';
        errMessage = 'Catch Error in router.post(/AddConnector)...';
        reqInstanceHelper.PrintError(ServiceName, objLogInfo, errCode, errMessage, error);
        reqInstanceHelper.SendResponse(ServiceName, appResponse, null, null, errCode, errMessage, error, 'FAILURE', '');
    }
});
module.exports = router;