/****
 * Api_Name          : /GetWFSelect,
 * Description       : Loading data's on listview, treeview and paged data list,
 * Last_Error_Code   : ERR-HAN-40163
 ****/

// Require dependencies
var reqExpress = require('express');
var reqHashTable = require('jshashtable');
var reqLinq = require('node-linq').LINQ;
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqWFSelectHelper = require('../../../../torus-references/common/serviceHelper/WFSelectHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var reqInsHlpr = require('../../../../torus-references/common/InstanceHelper')
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')

// Host api to server
router.post('/GetWFSelect', function callbackGetWFSelect(appRequest, apppResponse) {
    var objLogInfo = null;
    try {
        // Global variable declaration
        var mTranDB;
        var mDepCas;
        var mCltCas;
        var i = 1
        // Close event when client closes the api request
        appRequest.on('close', function () {
            reqTranDBInstance.CallRollback(mTranDB);
        });
        appRequest.on('finish', function () {
            reqTranDBInstance.CallRollback(mTranDB);
        });
        appRequest.on('end', function () {
            reqTranDBInstance.CallRollback(mTranDB);
        });

        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
            objLogInfo = pLogInfo
            objLogInfo.PROCESS = 'GetWFSelect-Handler';
            objLogInfo.ACTION_DESC = 'GetWFSelect';
            objLogInfo.USER_NAME = pSessionInfo.LOGIN_NAME;
            objLogInfo.HANDLER_CODE = 'BIND_RECORD_FROM_QUERY'
            apppResponse.setHeader('Content-Type', 'application/json');

            var strCurrentPageNo = 0;
            var strKeyColumn = '';
            var strKeyValue = '';
            var strSearchParams = '';
            var strFilters = '';
            var strRecordPerPage = 0;
            var strIsTreeview = '';
            var strHandlerCode = '';
            var strDataBindings = '';
            var strBulkUpdate = '';
            var strInputParamJson = '';
            var strSolrSearchName = ''
            var strAppId = '';
            var strDTCode = '';
            strInputParamJson = appRequest.body.PARAMS
            var strReqHeader = appRequest.headers

            _PrintInfo('Begin');
            // Initialize params
            _InitializeParams(strInputParamJson, pSessionInfo, function callbackInitializeParams(pStatus, pError) {
                if (pStatus == 'SUCCESS') {
                    // Initialize DB
                    _InitializeTrnDB(strReqHeader, function callbackInitializeDB(pStatus) {
                        // Main function to call WFSelect
                        GetWFSelect();
                    })
                } else
                    _PrepareAndSendResponse('FAILURE', 'ERR-HAN-40101', 'Error on _InitializeParams()', pError, null)
            })

            function GetWFSelect() {
                try {
                    var arrSearchInfo = [];

                    // var searchPrepareParams = {
                    //     strKeyColumn: strKeyColumn,
                    //     strKeyValue: strKeyValue,
                    //     strSolrSearchName: strSolrSearchName,
                    //     strSearchParams: strSearchParams,
                    //     strFilters: strFilters
                    // }

                    // prepareSearchInfo(searchPrepareParams);

                    // function prepareSearchInfo(searchPrepareParams) {
                    //     var strKeyColumn = searchPrepareParams.strKeyColumn;
                    //     var strKeyValue = searchPrepareParams.strKeyValue;
                    //     var strSolrSearchName = searchPrepareParams.strSolrSearchName;
                    //     var strSearchParams = searchPrepareParams.strSearchParams;
                    //     var strFilters = searchPrepareParams.strFilters;
                    //     // Prepare TMP_FILTER_PARAMS for Key Column, Key_Value
                    //     if (strKeyColumn != '' && strKeyValue != '' && strKeyValue != 0) {

                    //         var strBindingName = '';
                    //         if (strSolrSearchName == 'SOLR_AUDIT_VER_SEARCH')
                    //             strBindingName = 'TRN_ID'
                    //         else if (strSolrSearchName == 'SOLR_AUDIT_SEARCH')
                    //             strBindingName = 'RECORD_ID'
                    //         else
                    //             strBindingName = strKeyColumn

                    //         var htSrchInfo = new reqHashTable();
                    //         htSrchInfo.put('BINDING_NAME', strBindingName)
                    //         htSrchInfo.put('DATA_TYPE', 'NUMBER')
                    //         htSrchInfo.put('TMPFP_VALUE', strKeyValue)
                    //         htSrchInfo.put('OPERATOR', '=')
                    //         htSrchInfo.put('GROUP_NO', 0)
                    //         htSrchInfo.put('ISSEARCH', 'Y')
                    //         arrSearchInfo.push(htSrchInfo);
                    //     }

                    //     //Prepare TMP_FILTER_PARAMS for Search params 
                    //     if (strSearchParams != '') {
                    //         var objParams = JSON.parse(strSearchParams)

                    //         if (strSolrSearchName == 'SOLR_GLOBAL_SEARCH') { // Solr Tag search
                    //             var blnSearchParam = false
                    //             var objSrchParams = []
                    //             for (var j = 0; j < objParams.length; j++) {
                    //                 var rowSearchParam = objParams[j];
                    //                 if (rowSearchParam.VALUE != "") // find if any search param without empty, then set the variable as true
                    //                 {
                    //                     blnSearchParam = true;
                    //                     objSrchParams.push(rowSearchParam)
                    //                 }
                    //             }
                    //             if (blnSearchParam)
                    //                 objParams = objSrchParams
                    //         }

                    //         for (var i = 0; i < objParams.length; i++) {
                    //             var rowSearchParam = objParams[i];
                    //             if (strSolrSearchName == '') { // normal search
                    //                 if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '')
                    //                     continue;
                    //             } else // Solr search with blank search
                    //             {
                    //                 if (rowSearchParam.VALUE != undefined && rowSearchParam.VALUE == '') {
                    //                     if (strSolrSearchName == 'SOLR_DATA_SEARCH')
                    //                         continue;
                    //                     rowSearchParam.VALUE = "*"
                    //                 }
                    //             }
                    //             if (rowSearchParam.Operator == undefined && rowSearchParam.Operator == '')
                    //                 rowSearchParam.operator = '='
                    //             var htBetweenFrom = new reqHashTable();
                    //             if (rowSearchParam.OPERATOR.toLowerCase() == 'between' && rowSearchParam.VALUE.toString != '' && rowSearchParam.TOVALUE.toString != '') {
                    //                 htBetweenFrom.put('OPERATOR', '>=')
                    //                 htBetweenFrom.put('TMPFP_VALUE', rowSearchParam.VALUE)
                    //                 htBetweenFrom.put('DATA_TYPE', rowSearchParam.DATA_TYPE)
                    //                 htBetweenFrom.put('BINDING_NAME', rowSearchParam.BINDING_NAME)
                    //                 htBetweenFrom.put('ISSEARCH', 'Y')
                    //                 htBetweenFrom.put("GROUP_NO", 0)
                    //                 arrSearchInfo.push(htBetweenFrom)

                    //                 var htBetweenTo = new reqHashTable()
                    //                 htBetweenTo.put("BINDING_NAME", rowSearchParam.BINDING_NAME)
                    //                 htBetweenTo.put("OPERATOR", '<=')
                    //                 htBetweenTo.put("DATA_TYPE", rowSearchParam.DATA_TYPE)
                    //                 htBetweenTo.put("TMPFP_VALUE", rowSearchParam.TOVALUE)
                    //                 htBetweenTo.put("ISSEARCH", 'Y')
                    //                 htBetweenTo.put("GROUP_NO", 0)
                    //                 arrSearchInfo.push(htBetweenTo)
                    //                 continue;
                    //             }
                    //             htBetweenFrom.put("BINDING_NAME", rowSearchParam.BINDING_NAME)
                    //             htBetweenFrom.put("DATA_TYPE", rowSearchParam.DATA_TYPE)
                    //             htBetweenFrom.put("TMPFP_VALUE", rowSearchParam.VALUE)
                    //             htBetweenFrom.put("OPERATOR", rowSearchParam.OPERATOR)
                    //             htBetweenFrom.put('CONTROL_TYPE', ((rowSearchParam.CONTROL_TYPE != undefined) ? rowSearchParam.CONTROL_TYPE : ""))
                    //             htBetweenFrom.put("GROUP_NO", 0)
                    //             htBetweenFrom.put("ISSEARCH", 'Y')
                    //             arrSearchInfo.push(htBetweenFrom)
                    //         }
                    //     }

                    //     //Prepare TMP_FILTER_PARAMS for FILTERS
                    //     var resDS;
                    //     if (strFilters != '') {
                    //         resDS = JSON.parse(strFilters);
                    //         for (var i = 0; i < resDS.length; i++) {
                    //             var rowFilter = resDS[i];
                    //             if (strSolrSearchName == '') { // normal search
                    //                 if (rowFilter.BINDING_VALUE == undefined || rowFilter.BINDING_VALUE == null || rowFilter.BINDING_VALUE == '')
                    //                     continue;
                    //             } else // Solr search with blank search
                    //             {
                    //                 if (rowFilter.BINDING_VALUE == undefined || rowFilter.BINDING_VALUE == null || rowFilter.BINDING_VALUE == '')
                    //                     rowFilter.BINDING_VALUE = "*"
                    //             }
                    //             var strDataType = 'NUMBER';
                    //             if (rowFilter.DATA_TYPE != '')
                    //                 strDataType = rowFilter.DATA_TYPE

                    //             var htSrchInfo = new reqHashTable();
                    //             htSrchInfo.put('BINDING_NAME', rowFilter.BINDING_NAME)
                    //             htSrchInfo.put('DATA_TYPE', strDataType)
                    //             htSrchInfo.put('TMPFP_VALUE', rowFilter.BINDING_VALUE)
                    //             htSrchInfo.put('OPERATOR', rowFilter.OPRTR)
                    //             htSrchInfo.put('GROUP_NO', 0)
                    //             htSrchInfo.put('CONJ_OPERATOR', (rowFilter.CONJ_OPERATOR == null) ? "" : rowFilter.CONJ_OPERATOR)
                    //             if (strSolrSearchName.indexOf('AUDIT') > 0)
                    //                 htSrchInfo.put('ISSEARCH', 'Y')
                    //             else
                    //                 htSrchInfo.put('ISSEARCH', 'N')

                    //             arrSearchInfo.push(htSrchInfo)
                    //         }
                    //     }
                    // }

                    if (strIsTreeview == 'Y') {
                        // Treeview handling with new handler
                        var objTabResult = {};
                        if (strHandlerCode == 'GET_DATA_TEMPLATE') {
                            _GetDataTemplate(function callbackGetDataTemplate(pTabResult) {
                                objTabResult.RowData = JSON.stringify(pTabResult.QueryResult);
                                _Response(objTabResult, pTabResult);
                            })
                        } else { //TreeView handling
                            reqWFSelectHelper.WFSelect(strRecordPerPage, arrSearchInfo, strInputParamJson, pSessionInfo, mTranDB, mDepCas, mCltCas, objLogInfo, strReqHeader, function callbackWFSelect(pResult, pIsSolrSearch, pTotalRecords) {
                                try {
                                    _PrepareWFSelectResult(pResult, pIsSolrSearch, pTotalRecords);
                                } catch (error) {
                                    _PrintError("ERR-HAN-40102", "Error in GetWFSelect() function ", error)
                                }
                            })
                        }
                    } else {
                        //For listview
                        reqWFSelectHelper.WFSelect(strRecordPerPage, arrSearchInfo, strInputParamJson, pSessionInfo, mTranDB, mDepCas, mCltCas, objLogInfo, strReqHeader, function callbackWFSelect(pResult, pIsSolrSearch, pTotalRecords) {
                            try {
                                _PrepareWFSelectResult(pResult, pIsSolrSearch, pTotalRecords)
                            } catch (error) {
                                _PrintError("ERR-HAN-40103", "Error in GetWFSelect() function ", error)
                            }
                        })
                    }
                } catch (error) {
                    _PrepareAndSendResponse('FAILURE', 'ERR-HAN-40104', 'Error in GetWFSelect() function', error, null)
                }
            }

            // Prepare WFSelect result
            function _PrepareWFSelectResult(pWFResult, pIsSolrSearch, pTotalRecords) {
                try {
                    var objTabResult = {};
                    if (pWFResult.QueryResult.length == 0) {
                        objTabResult.RowData = ''
                        _Response(objTabResult, pWFResult);
                    } else {
                        if (strIsTreeview == 'Y') {
                            // Treeview handling
                            var bindings = strDataBindings;
                            var treeTemplates = JSON.parse(bindings.toUpperCase())
                            if (treeTemplates.length > 0) {
                                var treeTemplate = treeTemplates[0];
                                var arr = _FormTreeviewData(pWFResult.QueryResult, treeTemplate)
                                if (!arr instanceof Array) {
                                    pWFResult.ErrorCode = 'ERR-HAN-40105'
                                    pWFResult.ErrorMsg = 'Error on _FormTreeviewData()'
                                    pWFResult.Error = arr
                                    objTabResult.RowData = JSON.stringify([])
                                } else
                                    objTabResult.RowData = JSON.stringify(arr)
                                objTabResult.LockingMode = pWFResult.LockingMode
                            }
                            arr = null;
                            bindings = null
                        } else {
                            //For listview
                            objTabResult.RowData = JSON.stringify(pWFResult.QueryResult)
                            objTabResult.PagingData = (pIsSolrSearch == 'Y') ? pTotalRecords : pWFResult.TotalRecords
                            objTabResult.LockingMode = pWFResult.LockingMode
                        }
                        _Response(objTabResult, pWFResult);
                    }
                } catch (error) {
                    _PrepareAndSendResponse('FAILURE', 'ERR-HAN-40106', 'Error in _PrepareWFSelectResult() function', error, null)
                }
            }

            // Prepare and send response
            function _Response(pTableResult, pWFResult) {
                var strResult = pTableResult
                var strWarning = (pWFResult.Warning != undefined && pWFResult.Warning != null && pWFResult.Warning != '') ? pWFResult.Warning : ''
                var strProcessStatus = (pWFResult.Warning != null && pWFResult.Warning != '') ? 'FAILURE' : 'SUCCESS'
                var ErrorMsg = (pWFResult.ErrorMsg != null && pWFResult.ErrorMsg != '') ? pWFResult.ErrorMsg : ''
                var Error = (pWFResult.Error != null && pWFResult.Error != '') ? pWFResult.Error : ''
                var ErrorCode = (pWFResult.ErrorCode != null && pWFResult.ErrorCode != '') ? pWFResult.ErrorCode : ''
                strInputParamJson = null;
                strReqHeader = null;
                appRequest.body.PARAMS = null;
                reqInsHlpr.SendResponse('WFSelect', apppResponse, strResult, objLogInfo, ErrorCode, ErrorMsg, Error, strProcessStatus, strWarning)
                pTableResult = null;
                strResult = null;
                strWarning = null;
                strProcessStatus = null;
                ErrorMsg = null;
                Error = null;
                ErrorCode = null;
                pWFResult = null;
            }

            // Get DataTemplate - New handlercode
            function _GetDataTemplate(pCallback) {
                var arrData = [];
                try {
                    reqFXDBInstance.GetTableFromFXDB(mDepCas, 'DT_INFO', ['RELATION_JSON'], {
                        APP_ID: strAppId,
                        DT_CODE: strDTCode
                    }, objLogInfo, function callback(pError, pResult) {
                        try {
                            if (pError) {
                                return _PrepareAndSendCallback('FAILURE', [], '', 'ERR-HAN-40107', 'Error on querying DT_INFO table', pError, null, '', 0, '', pCallback)
                            } else {
                                if (pResult.rows.length > 0) {
                                    var objRelationJson = JSON.parse(pResult.rows[0]['relation_json'])
                                    for (var i = 0; i < objRelationJson.length; i++) {
                                        _GetChildDTT(objRelationJson[i], strDTCode, arrData)
                                    }
                                }
                                objRelationJson = null;
                            }
                            return _PrepareAndSendCallback('SUCCESS', arrData, '', '', '', null, null, '', 0, '', pCallback)
                        } catch (error) {
                            return _PrepareAndSendCallback('FAILURE', arrData, '', 'ERR-HAN-40108', 'Error in _GetDataTemplate() function ', error, null, '', 0, '', pCallback)
                        }
                    })
                } catch (error) {
                    return _PrepareAndSendCallback('FAILURE', arrData, '', 'ERR-HAN-40109', 'Error in _GetDataTemplate() function ', error, null, '', 0, '', pCallback)
                }
            }

            // Get child DTT 
            function _GetChildDTT(pRelationJson, pDTCode, pArrData) {
                try {
                    var objRelationJson = pRelationJson
                    var objData = {}
                    var objFormRow = {}
                    objData.label = objRelationJson['DTT_DESCRIPTION']

                    objFormRow.dt_code = pDTCode
                    objFormRow.dtt_code = objRelationJson['DTT_CODE']
                    objFormRow.doc_name = objRelationJson['DTT_DESCRIPTION']
                    objFormRow.node_text = objRelationJson['DTT_DESCRIPTION']
                    objFormRow.dtt_description = objRelationJson['DTT_DESCRIPTION']
                    objFormRow.foreign_column = objRelationJson['FOREIGN_COLUMN']
                    objFormRow.target_table = objRelationJson['TARGET_TABLE']
                    objFormRow.primary_column = objRelationJson['PRIMARY_COLUMN']
                    objFormRow.category = objRelationJson['CATEGORY']
                    objData.data = objFormRow
                    objData.children = []
                    pArrData.push(objData)

                    // find on child dtt relation
                    for (var i = 0; i < objRelationJson.CHILD_DTT_RELEATIONS.length; i++) {
                        _GetChildDTT(objRelationJson.CHILD_DTT_RELEATIONS[i], pDTCode, objData.children)
                    }
                    objFormRow = null;
                    objData = null;
                    objRelationJson = null;
                } catch (error) {
                    _PrintError("ERR-HAN-40110", "Error in _GetChildDTT() function ", error)
                }
            }


            // Prepare Treeview data
            function _FormTreeviewData(pRows, pTreeTemplate) {
                try {
                    var parentColumn = pTreeTemplate.FOREIGN_COLUMN.toString().toLowerCase();;
                    var targetColumn = pTreeTemplate.TARGET_COLUMN.toString().toLowerCase();

                    if (pTreeTemplate.IS_RECURSIVE == 'Y' && pTreeTemplate.CHILDREN.length == 0) {
                        //IsFinal mode
                        //Parent level rows
                        var dtRes = new reqLinq(pRows)
                            .Where(function (row) {
                                return row[parentColumn] === '0' || row[parentColumn] === 0;
                            });
                        var arrParent = [];
                        var expanded_icon = "";
                        var collapsed_icon = "";

                        if (dtRes.items.length > 0) {
                            for (var i = 0; i < dtRes.items.length; i++) {
                                // Parent level row
                                var objParent = {};
                                var parent = dtRes.items[i];
                                objParent.label = parent[pTreeTemplate.LABEL[0].TARGET_COLUMN.toString().toLowerCase()];
                                if (parent.collapsed_icon != undefined && parent.collapsed_icon.length > 1) {
                                    collapsed_icon = parent.collapsed_icon;
                                } else {
                                    collapsed_icon = "fa fa-folder";
                                }
                                if (parent.expanded_icon != undefined && parent.expanded_icon.length > 1) {
                                    expanded_icon = parent.expanded_icon;
                                } else {
                                    expanded_icon = "fa fa-folder-open";
                                }
                                //objParent.icon = "collapsed_icon";
                                objParent.expandedIcon = expanded_icon;
                                objParent.collapsedIcon = collapsed_icon;
                                var objFormRow = {};
                                Object.keys(parent).forEach(function (key) {
                                    objFormRow[key] = parent[key];
                                });
                                objParent.data = objFormRow;
                                objParent.children = [];

                                _FormChildRows(pRows, pTreeTemplate, parent[targetColumn], objParent.children)
                                arrParent.push(objParent);
                            }
                            // objParent = null;
                            objFormRow = null;
                            parent = null;
                            dtRes = null;
                            parentColumn = null;
                            targetColumn = null;

                        }
                        return arrParent;
                    }
                } catch (error) {
                    _PrintError("ERR-HAN-40111", "Error in _FormTreeviewData() function ", error)
                }
            }

            //Prepare treeview child rows
            function _FormChildRows(pRows, pTreeTemplate, pParentValue, pParent) {
                try {
                    var parentColumn = pTreeTemplate.FOREIGN_COLUMN.toLowerCase()
                    var targetColumn = pTreeTemplate.TARGET_COLUMN.toLowerCase()
                    var dtRes = new reqLinq(pRows)
                        .Where(function (row) {
                            return row[parentColumn] === pParentValue;
                        });

                    if (dtRes.items.length > 0) {
                        for (var i = 0; i < dtRes.items.length; i++) {
                            var objChild = {};
                            var expanded_icon = ""
                            var collapsed_icon = ""
                            var parent = dtRes.items[i];
                            objChild.label = parent[pTreeTemplate.LABEL[0].TARGET_COLUMN.toString().toLowerCase()]
                            //arrValues.indexOf(selval) > -1 ? false : true;
                            if (parent.collapsed_icon != undefined && parent.collapsed_icon.length > 1) {
                                collapsed_icon = parent.collapsed_icon;
                            } else {
                                collapsed_icon = "fa fa-folder";
                            }
                            if (parent.expanded_icon != undefined && parent.expanded_icon.length > 1) {
                                expanded_icon = parent.expanded_icon;
                            } else {
                                expanded_icon = "fa fa-folder-open";
                            }
                            // objChild.icon = collapsed_icon;
                            objChild.expandedIcon = expanded_icon;
                            objChild.collapsedIcon = collapsed_icon;
                            var objFormRow = {};
                            Object.keys(parent).forEach(function (key) {
                                objFormRow[key] = parent[key];
                            });
                            objChild.data = objFormRow;
                            objChild.children = [];
                            pParent.push(objChild);
                            _FormChildRows(pRows, pTreeTemplate, parent[targetColumn], objChild.children);
                        }
                        // objChild = null
                        objFormRow = null;
                        parent = null;
                        dtRes = null;
                        parentColumn = null;
                        targetColumn = null;
                    }
                } catch (error) {
                    // objChild = null
                    objFormRow = null;
                    parent = null;
                    parentColumn = null;
                    targetColumn = null;
                    dtRes = null;
                    _PrintError("ERR-HAN-40112", "Error in _FormChildRows() function ", error)
                }
            }

            // Initialize input params
            function _InitializeParams(pInputParamJson, pSessionInfo, pCallback) {
                try {
                    if (pInputParamJson.KEY_COLUMN != undefined && pInputParamJson.KEY_COLUMN != '')
                        strKeyColumn = pInputParamJson.KEY_COLUMN;

                    if (pInputParamJson.KEY_VALUE != undefined && pInputParamJson.KEY_VALUE != '')
                        strKeyValue = pInputParamJson.KEY_VALUE;

                    if (pInputParamJson.SEARCHPARAMS != undefined && pInputParamJson.SEARCHPARAMS != '')
                        strSearchParams = pInputParamJson.SEARCHPARAMS;

                    if (pInputParamJson.FILTERS != undefined && pInputParamJson.FILTERS != '')
                        strFilters = pInputParamJson.FILTERS;

                    if (pInputParamJson.IS_TREEVIEW != undefined && pInputParamJson.IS_TREEVIEW != '')
                        strIsTreeview = pInputParamJson.IS_TREEVIEW;

                    if (pInputParamJson.HANDLER_CODE != undefined && pInputParamJson.HANDLER_CODE != '')
                        strHandlerCode = pInputParamJson.HANDLER_CODE;

                    if (pInputParamJson.DATA_BINDINGS != undefined && pInputParamJson.DATA_BINDINGS != '')
                        strDataBindings = pInputParamJson.DATA_BINDINGS;

                    if (pInputParamJson.BULK_UPDATE != undefined && pInputParamJson.BULK_UPDATE != '')
                        strBulkUpdate = pInputParamJson.BULK_UPDATE;

                    if (pSessionInfo.APP_ID != undefined && pSessionInfo.APP_ID != '')
                        strAppId = pSessionInfo.APP_ID;

                    if (pInputParamJson.DT_CODE != undefined && pInputParamJson.DT_CODE != '')
                        strDTCode = pInputParamJson.DT_CODE;

                    if (pInputParamJson.SOLR_SEARCH_NAME != undefined && pInputParamJson.SOLR_SEARCH_NAME != '')
                        strSolrSearchName = pInputParamJson.SOLR_SEARCH_NAME;

                    pCallback('SUCCESS', null)
                } catch (error) {
                    pCallback('FAILURE', error)
                }
            }

            function _InitializeTrnDB(pHeaders, pCallback) {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                    mDepCas = pClient
                    reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                        mCltCas = pCltClient
                        reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                            mTranDB = pSession
                            pCallback('Success')
                        })
                    })
                })
            }

            function _PrintError(pErrCode, pErrMessage, pError) {
                reqInsHlpr.PrintError('WFSelect', pError, pErrCode, objLogInfo, pErrMessage)
            }

            function _PrintInfo(pMessage) {
                reqInsHlpr.PrintInfo('WFSelect', pMessage, objLogInfo)
            }

            // Prepare callback object
            function _PrepareAndSendResponse(pStatus, pErrorCode, pErrMsg, pError, pWarning) {
                var objCallback = {
                    Status: pStatus,
                    ErrorCode: pErrorCode,
                    ErrorMsg: pErrMsg,
                    Error: pError,
                    Warning: pWarning
                }
                _Response({}, objCallback)
            }

            // Prepare callback object
            function _PrepareAndSendCallback(pStatus, pQueryResult, pLockingMode, pErrorCode, pErrMsg, pError, pWarning, pSolrSearch, pTotalRecords, pTokenID, pCallback) {
                var objCallback = {
                    Status: pStatus,
                    ErrorCode: pErrorCode,
                    ErrorMsg: pErrMsg,
                    Error: pError,
                    Warning: pWarning,
                    QueryResult: pQueryResult,
                    LockingMode: pLockingMode,
                    TotalRecords: pTotalRecords
                }
                return pCallback(objCallback, pSolrSearch, pTotalRecords, pTokenID)
            }
        });


    } catch (error) {
        reqInsHlpr.SendResponse('WFSelect', apppResponse, {}, objLogInfo, 'ERR-HAN-40113', 'Error in GetWFSelect() function', error)
    }
}); // End of WFSelect

module.exports = router;