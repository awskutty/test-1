/**
 * Api_Name         : /ReconcilationData
 * Description      : To Reconcilation data solr and database
 * Last Error_Code  : ERR-AUT-
 New service
 */

var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSolrInstance = require('../../../../torus-references/instance/SolrInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqmoment = require('moment');
var reqDateFormat = require('dateformat');
var serviceName = 'ReconcilationData';
router.post('/GetReconcilationData', function (appRequest, appResponse) {
    try {
        var pHeaders = appRequest.headers;
        var params = appRequest.body.PARAMS;
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, pSessionInfo) {
            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (depSessoion) {
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (TrndbSession) {


                    mainfunction();

                    async function mainfunction() {
                        try {
                            var fullResObj = {};
                            _PrintInfo('Query dt info table to get transaction table list ');
                            var fullTableLists = await getTableList('dt_info', [], {});
                            var tranTableList = _getTranTableList(fullTableLists);
                            _PrintInfo(`Got the transaction table list. Total tables | ${tranTableList.length}`);
                            var whereCond = _prepareWhereCond();
                            var resArr = [];
                            for (var i = 0; i < tranTableList.length; i++) {
                                var resobj = {};
                                var commonQuery = `SELECT COUNT(*) AS COUNT FROM ${tranTableList[i].tableName} WHERE ${whereCond}`;
                                var tableRes = await executequery(commonQuery);
                                resobj.entity = tranTableList[i].tableName;
                                resobj.database = tableRes;
                                var solrDate = reqDateFormat(params.SearchDate, 'yyyy-mm-dd');
                                var solrWhereCond = `DTT_CODE:${tranTableList[i].dttCode} AND TENANT_ID:${objLogInfo.TENANT_ID} AND CREATED_DATE:[${solrDate}T00:00:00Z TO ${solrDate}T23:59:59Z]`;
                                var solrcountRes = await getdatacountfromsolr('TRAN', solrWhereCond);
                                resobj.solr = solrcountRes;
                                resArr.push(resobj);
                            }
                            fullResObj.tranRecon = resArr;

                            _PrintInfo(`Got the transaction entity reconciliation data. Goin to get fx table data.`);

                            var fxTableList = await getTableList('ARC_FX_TABLES', ['table_name', 'parent_table_name'], {});
                            fxTableList = tablesort(fxTableList);
                            _PrintInfo(`Got the fx table list from arch fx table. Total table count |${fxTableList.length}`);
                            var fxRearr = [];
                            for (var fxt = 0; fxt < fxTableList.length; fxt++) {
                                var fxResobj = {};
                                var commonFXQuery = `SELECT COUNT(*) AS COUNT FROM ${fxTableList[fxt].table_name} WHERE ${whereCond}`;
                                var fxTableRes = await executequery(commonFXQuery);
                                fxResobj.entity = fxTableList[fxt].table_name.toUpperCase();
                                fxResobj.database = fxTableRes;
                                var solrDate = reqDateFormat(params.SearchDate, 'yyyy-mm-dd');
                                var solrWhereCond = `FX_TABLE_NAME:${fxTableList[fxt].table_name} AND CREATED_DATE:[${solrDate}T00:00:00Z TO ${solrDate}T23:59:59Z] AND TENANT_ID:${objLogInfo.TENANT_ID}`;
                                var solrcountRes = await getdatacountfromsolr('FX_TRAN', solrWhereCond);
                                fxResobj.solr = solrcountRes;
                                fxRearr.push(fxResobj);
                            }
                            fullResObj.fxTranRecon = fxRearr;
                            _PrintInfo(`Got the Fx entity reconciliation data. Goin to other framework table data.`);
                            var commonTables = ['TRN_ATTACHMENTS', 'TRANSACTION_COMMENTS'];
                            var otherTableResarr = [];
                            for (var ct = 0; ct < commonTables.length; ct++) {
                                var otherResobj = {};
                                var commonFXQuery = `SELECT COUNT(*) AS COUNT FROM ${commonTables[ct]} WHERE ${whereCond}`;
                                var commonTableRes = await executequery(commonFXQuery);
                                otherResobj.entity = commonTables[ct].toUpperCase();
                                otherResobj.database = commonTableRes;
                                var solrDate = reqDateFormat(params.SearchDate, 'yyyy-mm-dd');

                                var solrWhereCond = '';
                                var pCoreName = '';
                                if (commonTables[ct] == 'TRANSACTION_COMMENTS') {
                                    solrWhereCond = `FX_TABLE_NAME:transaction_comments AND TENANT_ID:${objLogInfo.TENANT_ID} AND CREATED_DATE:[${solrDate}T00:00:00Z TO ${solrDate}T23:59:59Z]`;
                                    pCoreName = 'FX_TRAN';
                                } else if (commonTables[ct] == 'TRN_ATTACHMENTS') {
                                    pCoreName = 'TRAN_ATMT';
                                    solrWhereCond = `CREATED_DATE:[${solrDate}T00:00:00Z TO ${solrDate}T23:59:59Z] AND TENANT_ID:${objLogInfo.TENANT_ID}`;
                                }

                                _PrintInfo(`Quering solr core name | ${pCoreName}. solr where condition | ${solrWhereCond}`);
                                var solrcountRes = await getdatacountfromsolr(pCoreName, solrWhereCond);
                                otherResobj.solr = solrcountRes;
                                otherTableResarr.push(otherResobj);
                            }
                            fullResObj.otherTranRecon = otherTableResarr;
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, fullResObj, objLogInfo, '', '', '', 'SUCCESS', '');
                        } catch (error) {
                            _PrintInfo(`Exception occured ${error}`);
                        }
                    }

                    function tablesort(ptableList) {
                        try {
                            var parentTables = ptableList.filter((value) => {
                                if (!value.parent_table_name) {
                                    return true;
                                }
                            });

                            parentTables.sort(function (a, b) {
                                if (a.table_name < b.table_name) { return -1; }
                                if (a.table_name > b.table_name) { return 1; }
                                return 0;
                            });
                            console.table(parentTables);
                            var sortedTableList = [];
                            for (var i = 0; i < parentTables.length; i++) {
                                sortedTableList.push(parentTables[i]);
                                ptableList.filter((value) => {
                                    if (value.parent_table_name == parentTables[i].table_name) {
                                        sortedTableList.push(value);
                                        findchildofchild(value);
                                    }
                                });
                            }
                            return sortedTableList;

                            function findchildofchild(pdata) {
                                ptableList.filter((value) => {
                                    if (pdata.table_name == value.parent_table_name) {
                                        sortedTableList.push(value);
                                        findchildofchild(value);
                                    }
                                });
                            }

                        } catch (error) {
                            _PrintInfo(`Exception occured while sorting table list ${error}`);
                        }
                    }

                    function _prepareWhereCond() {
                        _PrintInfo('Prepare where condition');
                        var whereCond = '';
                        //check timezone mode, if UTC mode prepare condition with UTC  condition
                        // if (objLogInfo.TIMEZONE_INFO.utc_mode.toLowerCase() == 'true') {
                        //     // var startDate = reqDateFormatter.GetUTCStartDate({ 'START_DATE': params.SearchDate }, objLogInfo);
                        //     // var endDate = reqDateFormatter.GetUTCEndDate({ 'END_DATE': reqmoment(params.SearchDate).add(1, 'd').utc().format() }, objLogInfo);
                        //     var endDate = reqDateFormatter.GetUTCEndDate({ 'END_DATE': params.SearchDate }, objLogInfo);
                        //     whereCond = reqDateFormatter.GetSearchCriteriaForUTC(pHeaders, objLogInfo, 'CREATED_DATE', params.SearchDate, endDate);
                        // } else {
                        // non UTC mode created date treated like business date column
                        whereCond = reqDateFormatter.GetSearchCriteriaForBusinessColumn(pHeaders, objLogInfo, 'CREATED_DATE', params.SearchDate);
                        // }
                        whereCond = `${whereCond} AND TENANT_ID = '${objLogInfo.TENANT_ID}'`;
                        _PrintInfo('where condition | ' + whereCond);
                        return whereCond;
                    }
                    function getTableList(pTableName, pColList, pCond) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo(`query table ${pTableName}`);
                                reqDBInstance.GetTableFromFXDB(depSessoion, pTableName, pColList, pCond, objLogInfo, function (pErr, pRes) {
                                    if (pErr) {
                                        _PrintInfo(`Error occured ${pErr}`);
                                    } else {
                                        resolve(pRes.rows);
                                    }
                                });
                            } catch (error) {
                                _PrintInfo(`Exception occured ${error}`);
                            }
                        });
                    }

                    function executequery(pQuery) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo(`query : ${pQuery}`);
                                reqTranDBInstance.ExecuteSQLQuery(TrndbSession, pQuery, objLogInfo, function (pRes, pErr) {
                                    if (pErr) {
                                        _PrintInfo(`Error occured ${pErr}`);
                                        resolve('Err occured');
                                    } else {
                                        _PrintInfo(`count : ${pRes.rows[0].count}`);
                                        resolve(pRes.rows[0].count);
                                    }
                                });
                            } catch (error) {
                                _PrintInfo(`Exception occured ${error}`);
                            }
                        });
                    }

                    function getdatacountfromsolr(pCoreName, pstrCriteria) {
                        return new Promise((resolve, reject) => {
                            try {
                                reqSolrInstance.LogSolrSearchWithPaging(pHeaders, pCoreName, pstrCriteria, 1, 1, function callbackLogSolrSearchWithPaging(result, error) {
                                    if (error) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-15001', 'Error on querying solr', error);
                                        resolve('error occured');
                                    } else {
                                        resolve(result.response.numFound);
                                    }
                                });
                            } catch (error) {
                                _PrintInfo(`Exception occured ${error}`);
                            }
                        });
                    }

                    function _getTranTableList(pTableList) {
                        try {
                            _PrintInfo('Getting tansaction table list started');
                            var trntabl = [];
                            for (var i = 0; i < pTableList.length; i++) {
                                var parsedDataJson = JSON.parse(pTableList[i].relation_json);
                                for (var j = 0; j < parsedDataJson.length; j++) {
                                    if (parsedDataJson[j].CATEGORY === "T") {
                                        var tableObj = {};
                                        tableObj.tableName = parsedDataJson[j].TARGET_TABLE;
                                        tableObj.dttCode = parsedDataJson[j].DTT_CODE;
                                        trntabl.push(tableObj);
                                    }
                                    if (parsedDataJson[j].CHILD_DTT_RELEATIONS.length) {
                                        callrecursive(parsedDataJson[j].CHILD_DTT_RELEATIONS);
                                    }
                                }

                                function callrecursive(pData) {
                                    for (var k = 0; k < pData.length; k++) {
                                        if (pData[k].CATEGORY === "T") {
                                            var tableObj = {};
                                            tableObj.tableName = pData[k].TARGET_TABLE;
                                            tableObj.dttCode = pData[k].DTT_CODE;
                                            trntabl.push(tableObj);
                                        }
                                        if (pData[k].CHILD_DTT_RELEATIONS.length) {
                                            callrecursive(pData[k].CHILD_DTT_RELEATIONS);
                                        }
                                    }
                                }
                            }
                            _PrintInfo('Getting tansaction table end');
                            return trntabl;

                        } catch (error) {
                            _PrintInfo(`Exception occured ${error}`);
                        }
                    }

                    function _PrintInfo(pMessage) {
                        reqInstanceHelper.PrintInfo(serviceName, pMessage, objLogInfo);
                    }

                });
            });
        });
    } catch (error) {
        _PrintInfo(`Exception occured ${error}`);
    }
});
module.exports = router;