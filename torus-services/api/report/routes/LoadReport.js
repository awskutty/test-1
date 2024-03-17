/*
@Api_Name         : /LoadReport
@Description      : To load the shared report for current app user and appuser roles
@Last_Error_code  : ERR-RPT-60009
*/

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

const RPTDEFINFO = "SELECT APP_ID ,ARPTD_ID, RPT_NAME FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID=? AND PARENT_ARPTD_ID='0' ALLOW FILTERING;";
const RPTSHARING = "SELECT ARPTD_ID,SHARING_ACTION FROM APP_RPT_SHARING WHERE APP_ID=? AND SHARING_MODE=?  AND SHARING_VALUE=? ALLOW FILTERING; ";

// Host the api
router.post('/LoadReport', function (appRequest, appResponse) {
    // variable declaration
    var strAppuId = '';
    var strAppId = '';
    var strApprId = '';
    var strInputParam = appRequest.body.PARAMS;
    var IS_SEARCH = appRequest.body.PARAMS.IS_SEARCH;
    var rpt_name = strInputParam['RPT_NAME'];
    var rpt_path = strInputParam['RPT_PATH'];
    var strReqHeader = appRequest.headers;
    var objLogInfo;
    var mDepCas;
    var mCltCas;
    var RptCond = {};

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
        try {
            objLogInfo = pLogInfo;
            var strtntId = objLogInfo.TENANT_ID;
            objLogInfo.HANDLER_CODE = 'LoadReport';
            _PrintInfo('Begin');

            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            // Initialize DB
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                    if (pInputStatus.Status == 'SUCCESS') {
                        // Main function to load report
                        _GetRptDefinition(function callback(pResult) {
                            var strResult = pResult.Data;
                            return _SendResponse(pResult.Data, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                        });
                    } else
                        return _SendResponse(null, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60001', 'Error in calling LoadReport API function', error, null);
        }

        // To get report definition
        function _GetRptDefinition(pCallback) {
            try {
                var arrRptInfo = [];
                var arrResult = [];
                var arrRptId = [];
                _PrintInfo('Querying APP_RPT_DEFINITIONS_INFO table');
                RptCond['APP_ID'] = strAppId;
                RptCond['TENANT_ID'] = strtntId;

                var rptinfoqry = `SELECT APP_ID, ARPTD_ID, RPT_NAME, RPT_DESC, RPT_PATH, QUERY_PARAMS FROM APP_RPT_DEFINITIONS_INFO WHERE APP_ID='${strAppId}' AND (TENANT_ID='${strtntId.toLowerCase()}' OR TENANT_ID IS NULL OR TENANT_ID='')`;
                // reqFXDBInstance.GetTableFromFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', ['APP_ID', 'ARPTD_ID', 'RPT_NAME', 'RPT_DESC', 'RPT_PATH', 'QUERY_PARAMS'], RptCond, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                reqFXDBInstance.ExecuteQuery(mDepCas, rptinfoqry, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', arrResult, 'ERR-RPT-60002', 'Error on querying APP_RPT_DEFINITIONS_INFO table ', pError, null, pCallback);
                    else if (pResult) {
                        _PrintInfo('Got result from APP_RPT_DEFINITIONS_INFO table');

                        arrRptInfo = pResult.rows;
                        for (var i = 0; i < arrRptInfo.length; i++) {
                            if (arrRptInfo[i]['rpt_path'] == undefined) {
                                arrRptInfo[i]['rpt_path'] = "/reports/Myreports";
                            } else {
                                arrRptInfo[i]['rpt_path'] = arrRptInfo[i]['rpt_path'].replace(/ /g, "_");
                            }
                        }

                        var arrRows;
                        var linqcondition = '';
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
                        // Get user and role based sharing value of report
                        _GetReportSharingValue(function callbackGetReportSharingValue(pUserSharingVal, pRoleSharingVal, pStatusObject) {

                            if (pStatusObject.Status == 'SUCCESS') {
                                // prepare the report collection which shared to user
                                _PrepareSharingValue(arrRptId, arrRptInfo, pUserSharingVal, arrResult);

                                // prepare the report collection which shared to Role
                                _PrepareSharingValue(arrRptId, arrRptInfo, pRoleSharingVal, arrResult);

                                return _PrepareAndSendCallback('SUCCESS', arrResult, '', '', null, null, pCallback);

                            } else
                                return _PrepareAndSendCallback(pStatusObject.Status, arrResult, pStatusObject.ErrorCode, pStatusObject.ErrorMsg, pStatusObject.Error, pStatusObject.Warning, pCallback);
                        });
                    }
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', '', 'ERR-RPT-60010', 'Exception occured', null, null, pCallback);
            }
        }

        // To share report value
        function _GetReportSharingValue(pCallback) {
            reqAsync.parallel({
                UserSharing: function (parCb) {
                    //User sharing report
                    var arrUsers = [];
                    var objUser = {};
                    if (strAppuId != undefined && strAppuId != null && strAppuId != '' && strAppuId != '0') {
                        _PrintInfo('Querying APP_RPT_SHARING to get user based sharing of report...');
                        reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_RPT_SHARING', ['ARPTD_ID', 'SHARING_ACTION'], {
                            APP_ID: strAppId,
                            SHARING_MODE: 'USERS',
                            SHARING_VALUE: strAppuId,
                            TENANT_ID: objLogInfo.TENANT_ID
                        }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                            if (pError) {
                                objUser = _PrepareCallbackObject('FAILURE', arrUsers, 'ERR-RPT-60003', 'Error on Querying user based sharing from APP_RPT_SHARING table', pError, null);
                            } else if (pResult != undefined) {
                                arrUsers = pResult.rows;
                                objUser = _PrepareCallbackObject('SUCCESS', arrUsers, '', '', null, null);
                            }
                            parCb(null, objUser);
                        });
                    } else {
                        objUser = _PrepareCallbackObject('FAILURE', arrUsers, 'ERR-RPT-60004', '', null, 'APPUSER ID not found');
                        parCb(null, objUser);
                    }
                },
                RoleSharing: function (parCb) {
                    // Role sharing report
                    var arrRoles = [];
                    var objRole = {};
                    if (strApprId != undefined && strApprId != null && strApprId != '' && strApprId != '0') {
                        reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_RPT_SHARING', ['ARPTD_ID', 'SHARING_ACTION'], {
                            APP_ID: strAppId,
                            SHARING_MODE: 'ROLES',
                            SHARING_VALUE: strApprId,
                            TENANT_ID: objLogInfo.TENANT_ID
                        }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                            if (pError)
                                objRole = _PrepareCallbackObject('FAILURE', arrRoles, 'ERR-RPT-60005', 'Error on Querying role based sharing from APP_RPT_SHARING table', pError, null);
                            else if (pResult != undefined) {
                                arrRoles = pResult.rows;
                                objRole = _PrepareCallbackObject('SUCCESS', arrRoles, '', '', null, null);
                            }
                            parCb(null, objRole);
                        });
                    } else {
                        objRole = _PrepareCallbackObject('FAILURE', arrRoles, 'ERR-RPT-60006', '', null, 'APPUSERROLE ID not found');
                        parCb(null, objRole);
                    }
                }
            },
                function endCallback(err, result) {
                    if (result.UserSharing.Status == 'SUCCESS' && result.RoleSharing.Status == 'SUCCESS')
                        // both the result are success
                        return pCallback(result.UserSharing.Data, result.RoleSharing.Data, result.UserSharing);
                    else {
                        // Any one failed , return the failure object
                        if (result.UserSharing.Status == 'FAILURE')
                            return pCallback(result.UserSharing.Data, result.RoleSharing.Data, result.UserSharing);
                        else
                            return pCallback(result.UserSharing.Data, result.RoleSharing.Data, result.RoleSharing);
                    }
                });
        }

        // To prepare sharing value
        function _PrepareSharingValue(pLstRptID, pArrRptInfo, pArrSharingValue, pArrResult) {
            try {
                for (var i = 0; i < pArrSharingValue.length; i++) {
                    var row = pArrSharingValue[i];

                    for (var j = 0; j < pArrRptInfo.length; j++) // rpt report definition
                    {
                        var dr = pArrRptInfo[j];

                        if (pLstRptID.indexOf(dr['arptd_id']) < 0) {

                            if (row['arptd_id'] == dr['arptd_id']) {
                                pLstRptID.push(dr['arptd_id']);
                                var objFormRow = {};
                                objFormRow['APP_ID'] = strAppId;
                                objFormRow['ARPTD_ID'] = dr['arptd_id'];
                                objFormRow['RPT_NAME'] = dr['rpt_name'];
                                objFormRow['RPT_PATH'] = dr['rpt_path'];
                                objFormRow['RPT_DESC'] = (dr['rpt_desc'] != undefined && dr['rpt_desc'] != null) ? dr['rpt_desc'] : "";
                                objFormRow['RPT_ACTION'] = JSON.parse(row['sharing_action']);
                                if (dr['query_params'] == '' || dr['query_params'] == null) {
                                    dr['query_params'] = '[]';
                                }
                                objFormRow['RPT_SESSION'] = JSON.parse(dr['query_params']);
                                pArrResult.push(objFormRow);
                            }
                        }
                    }
                }
            } catch (error) {
                _PrintError('ERR-RPT-60007', 'Error in calling _PrepareSharingValue function', error);
            }
        }

        // To prepare role sharing value
        function _PrepareRoleSharingValue(pLstRptID, pArrRptInfo, pArrUserSharingValue, pArrRoleSharingValue, pArrResult) {
            try {
                for (var i = 0; i < pArrUserSharingValue.length; i++) {
                    var UserRow = pArrUserSharingValue[i];

                    for (var j = 0; j < pArrRptInfo.length; j++) // rpt report definition
                    {
                        var dr = pArrRptInfo[j];

                        if (pLstRptID.indexOf(dr['arptd_id'] < 0)) {

                            if (UserRow['arptd_id'] == dr['arptd_id']) {
                                pLstRptID.push(dr['arptd_id']);
                                var objFormRow = {};
                                objFormRow['APP_ID'] = strAppId;
                                objFormRow['ARPTD_ID'] = dr['arptd_id'];
                                objFormRow['RPT_NAME'] = dr['rpt_name'];
                                objFormRow['RPT_PATH'] = dr['rpt_path'];
                                objFormRow['RPT_ACTION'] = JSON.parse(UserRow['sharing_action']);
                                pArrResult.push(objFormRow);
                            }
                        }
                    }
                }
            } catch (error) {
                return _SendResponse(null, 'ERR-RPT-60008', 'Error in calling _PrepareRoleSharingValue function', error, null);
            }
        }

        // To initialize DB
        function _InitializeDB(pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClientDep) {
                _PrintInfo('dep_cas Cassandra Connection Initiated Successfully');
                mDepCas = pClientDep;

                reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClientClt) {
                    _PrintInfo('clt_cas Cassandra Connection Initiated Successfully');
                    mCltCas = pClientClt;
                    pCallback('Success');
                });

            });
        }

        // To initialize params
        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            try {
                //Prepare Client Side Params
                if (pSessionInfo['APPU_ID'] != undefined && pSessionInfo['APPU_ID'] != '')
                    strAppuId = pSessionInfo['APPU_ID'].toString();

                if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                    strAppId = pSessionInfo['APP_ID'].toString();

                if (pSessionInfo['APP_USER_ROLES'] != undefined && pSessionInfo['APP_USER_ROLES'] != '')
                    strApprId = pSessionInfo['APP_USER_ROLES'].toString();

                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60009', 'Error in calling _InitializeParams function', error, null, pCallback);
            }
        }
    });

    // To print the Error
    function _PrintError(pErrCode, pMessage, pError) {
        reqInsHelper.PrintError('LoadReport', objLogInfo, pErrCode, pMessage, pError);
    }

    // To print the information 
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo('LoadReport', pMessage, objLogInfo);
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
        return reqInsHelper.SendResponse('LoadReport', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
    }
});


module.exports = router;
/*********** End of Service **********/