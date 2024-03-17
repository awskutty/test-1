/**
 * Api_Name         : /LoadApplnReport,
 * Description      : To Load the ApplnReport, sharing mode and actions from CODE_DESCRIPTIONS
 * Last_Error_code  : ERR-RPT-60206
 **/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqAsync = require(modPath + 'async');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLinq = require('node-linq').LINQ;

const RPTDEFINFO = "SELECT ARPTD_ID,RPT_NAME FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID=? ;";
const RPTSHAREMODE = "SELECT CD_CODE,CODE_VALUE FROM CODE_DESCRIPTIONS WHERE CD_CODE IN ('SHARING_MODE','SHARING_ACTION')";

// Host the method to express
router.post('/LoadApplnReport', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'application/json');

    // variable declaration
    var strTenantId = '';
    var strAppId = '';
    var strInputParam = appRequest.body.PARAMS;
    var IS_SEARCH = appRequest.body.PARAMS.IS_SEARCH;
    var rpt_name = strInputParam['RPT_NAME'];
    var rpt_path = strInputParam['RPT_PATH'];
    var strReqHeader = appRequest.headers;
    var mFXDB;
    var mCltCas;


    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, pSessionInfo) {
        try {
            strTenantId = objLogInfo.TENANT_ID;
            objLogInfo.HANDLER_CODE = 'LoadApplnReport';

            _PrintInfo('Begin');

            _PrintInfo('Calling _InitializeDB  function');
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _PrintInfo('Initializing params...');

                _InitializeParams(strInputParam, pSessionInfo);

                _PrintInfo('Calling _GetReportDefinitionsInfo function');
                _GetReportDefinitionsInfo(function callback(pResult) {
                    var strResult = null;
                    if (pResult.Status == 'SUCCESS') {
                        strResult = JSON.stringify(pResult.Data);
                        _PrintInfo('Result : ' + strResult);
                    }
                    return _SendResponse(strResult, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                });
            });

        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60201', 'Error in LoadApplnReport() function', error, null);
        }

        // To get RPT_DEFINITIONS_INFO
        function _GetReportDefinitionsInfo(pCallback) {
            try {
                _GetRptAndSharingInfo(function callbackGetRptAndSharingInfo(pRptDef, pShareInfo, pStatusObject) {
                    var objResult = {};
                    try {
                        if (pStatusObject.Status == 'SUCCESS') {
                            // Prepare the report definitions info
                            var arrRptDef = _PrepareRptDefinitions(pRptDef);
                            objResult.REPORT_DETAILS = arrRptDef;

                            // Prepare the report sharing mode and action
                            for (var i = 0; i < pShareInfo.length; i++) {
                                var dr = pShareInfo[i];
                                var code = dr['cd_code'];
                                var value = dr['code_value'];
                                var tempValue = JSON.parse(value);
                                objResult[code] = value;
                            }
                            return _PrepareAndSendCallback('SUCCESS', objResult, '', '', null, null, pCallback);
                        } else {
                            return _PrepareAndSendCallback(pStatusObject.Status, objResult, pStatusObject.ErrorCode, pStatusObject.ErrorMsg, pStatusObject.Error, pStatusObject.Warning, pCallback);
                        }
                    } catch (error) {
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60202', 'Error on _GetReportDefinitionsInfo()', error, null, pCallback);
                    }
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60203', 'Error on _GetReportDefinitionsInfo()', error, null, pCallback);
            }
        }

        // To get Report and Sharing info
        function _GetRptAndSharingInfo(pCallback) {
            // get Rpt definitions info table
            try {
                reqAsync.parallel({
                    RptDefInfo: function (parCb) {
                        // Prepare report definitions info
                        var arrRptInfo = [];
                        // reqFXDBInstance.GetTableFromFXDB(mFXDB, 'APP_RPT_DEFINITIONS_INFO', ['ARPTD_ID', 'RPT_NAME', 'RPT_DESC', 'PARENT_ARPTD_ID', 'RPT_PATH','QUERY_PARAMS'], {
                        //     APP_ID: strAppId,
                        //     TENANT_ID: strTenantId
                        // }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                        var rptinfoqry = `SELECT app_id, arptd_id,rpt_name,rpt_desc,parent_arptd_id,rpt_path,query_params FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID='${strAppId}' AND (TENANT_ID='${strTenantId.toLowerCase()}' OR TENANT_ID IS NULL OR TENANT_ID='')`;
                        reqFXDBInstance.ExecuteQuery(mFXDB, rptinfoqry, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                            var obj = {};
                            if (pError) {
                                obj = _PrepareCallbackObject('FAILURE', arrRptInfo, 'ERR-RPT-60204', 'Error on querying APP_RPT_DEFINITIONS_INFO table', pError, null);
                            } else if (pResult != undefined) {
                                _PrintInfo('Got Result from APP_RPT_DEFINITIONS_INFO table');
                                arrRptInfo = pResult.rows;
                                for (var i = 0; i < arrRptInfo.length; i++) {
                                    if (arrRptInfo[i]['rpt_path'] == undefined) {
                                        arrRptInfo[i]['rpt_path'] = "/reports/Myreports";
                                    } else {
                                        arrRptInfo[i]['rpt_path'] = arrRptInfo[i]['rpt_path'].replace(/ /g, "_");
                                    }
                                }
                                if (IS_SEARCH == 'Y') {
                                    if (rpt_name != '') {
                                        arrRows = new reqLinq(arrRptInfo).Where(function (row) {
                                            return row['rpt_desc'].toLowerCase().indexOf(rpt_name.toLowerCase()) != -1;
                                        }).ToArray();
                                        arrRptInfo = arrRows;
                                    } else if (rpt_path != '') {
                                        arrRows = new reqLinq(arrRptInfo).Where(function (row) {
                                            return row['rpt_path'].toLowerCase().indexOf(rpt_path.toLowerCase()) != -1;
                                        }).ToArray();
                                        arrRptInfo = arrRows;
                                    } else if (rpt_name != '' && rpt_path != '') {
                                        arrRows = new reqLinq(arrRptInfo).Where(function (row) {
                                            return (row['rpt_desc'].toLowerCase().indexOf(rpt_name.toLowerCase()) != -1 && row['rpt_path'].toLowerCase().indexOf(rpt_path.toLowerCase()) != -1);
                                        }).ToArray();
                                    }
                                }

                                obj = _PrepareCallbackObject('SUCCESS', arrRptInfo, '', '', null, null);
                            }
                            parCb(null, obj);
                        });
                    },
                    SharingMode: function (parCb) {
                        // Prepare Report sharing mode 
                        var arrShareMode = [];
                        reqFXDBInstance.ExecuteQuery(mCltCas, RPTSHAREMODE, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                            var obj = {};
                            if (pError) {
                                obj = _PrepareCallbackObject('FAILURE', arrShareMode, 'ERR-RPT-60205', 'Error on querying CODE_DESCRIPTIONS table to get Sharingmode and action', pError, null);
                            } else if (pResult != undefined) {
                                arrShareMode = pResult.rows;
                                obj = _PrepareCallbackObject('SUCCESS', arrShareMode, '', '', null, null);
                                _PrintInfo('Got result from RPTSHAREMODE table');
                            }
                            parCb(null, obj);
                        });
                    }
                }, function endCallback(err, result) {
                    // return rpt_definitions_info and sharing mode and sharing action
                    var obj = {};
                    if (result.RptDefInfo.Status == 'SUCCESS' && result.SharingMode.Status == 'SUCCESS') { // both are success case
                        obj = _PrepareCallbackObject('SUCCESS', null, '', '', null, null, pCallback);
                        return pCallback(result.RptDefInfo.Data, result.SharingMode.Data, obj);
                    } else { // anyone failed case
                        if (result.RptDefInfo.Status == 'FAILURE') {
                            obj = _PrepareCallbackObject(result.RptDefInfo.Status, null, result.RptDefInfo.ErrorCode, result.RptDefInfo.ErrorMsg, result.RptDefInfo.Error, result.RptDefInfo.Warning);
                            return pCallback(result.RptDefInfo.Data, result.SharingMode.Data, obj);
                        } else {
                            obj = _PrepareCallbackObject(result.SharingMode.Status, null, result.SharingMode.ErrorCode, result.SharingMode.ErrorMsg, result.SharingMode.Error, result.SharingMode.Warning);
                            return pCallback(result.RptDefInfo.Data, result.SharingMode.Data, obj);
                        }
                    }
                });
            } catch (error) {
                var obj = _PrepareCallbackObject('FAILURE', null, 'ERR-RPT-60206', 'Error on _GetRptAndSharingInfo()', error, null);
                return pCallback([], [], obj);
            }
        }

        // To prepare the RPT_DEFINITIONS_INFO
        function _PrepareRptDefinitions(pRows) {
            var arrRptInfo = [];
            var arrRows = new reqLinq(pRows).Where(function (row) {
                return row["parent_arptd_id"] == '0';
            }).ToArray();

            for (var i = 0; i < arrRows.length; i++) {
                var objRptInfo = {};
                objRptInfo.RPT_NAME = arrRows[i]['rpt_name'];
                objRptInfo.RPT_DESC = (arrRows[i]['rpt_desc'] != undefined && arrRows[i]['rpt_desc'] != null) ? arrRows[i]['rpt_desc'] : "";
                objRptInfo.ARPTD_ID = arrRows[i]['arptd_id'];
                objRptInfo.RPT_PATH = arrRows[i]['rpt_path'];
                if (arrRows[i]['query_params'] == "" || arrRows[i]['query_params'] == null) {
                    arrRows[i]['query_params'] = '[]';
                }
                objRptInfo.RPT_SESSION = JSON.parse(arrRows[i]['query_params']);
                arrRptInfo.push(objRptInfo);
            }
            return arrRptInfo;
        }

        // Initializing DB
        function _InitializeDB(pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClientDep) {
                _PrintInfo('Cassandra connection Initiated Successfully');
                mFXDB = pClientDep;
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClientClt) {
                    _PrintInfo('Cassandra connection Initiated Successfully');
                    mCltCas = pClientClt;
                    pCallback('Success');
                });

            });
        }

        // To Initialize the params
        function _InitializeParams(pClientParam, pSessionInfo) {
            //Prepare Client Side Params
            if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                strAppId = pSessionInfo['APP_ID'].toString();
        }

        // To print the Error
        function _PrintError(pErrCode, pMessage, pError) {
            reqInsHelper.PrintError('LoadApplnReport', objLogInfo, pErrCode, pMessage, pError);
        }

        // To print the information 
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo('LoadApplnReport', pMessage, objLogInfo);
        }

        // To prepare and send callback object
        function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
            var objCallback = {
                Status: pStatus,
                Data: pData,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            };
            return pCallback(objCallback);
        }

        // To prepare the callback object
        function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning) {
            var objCallback = {
                Status: pStatus,
                Data: pData,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            };
            return objCallback;
        }

        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
            return reqInsHelper.SendResponse('LoadApplnReport', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }

    });
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});



module.exports = router;
/*********** End of Service **********/