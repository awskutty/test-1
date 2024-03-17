/****
 * Api_Name         : /SaveRptsharing
 * Description      : To save the report sharing process
 * Last_Error_code  : ERR-RPT-60506
 ****/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqAsync = require(modPath + 'async');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var router = reqExpress.Router();
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqUuid = require('uuid');

// Host the Method to express
router.post('/saveReportFromWp', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'application/json');

    // variable declaration
    var strRptSharingDetail = '';
    var strInputParam = appRequest.body.PARAMS;
    var isUpdate = strInputParam.ISUPDATE;
    var apprptId = strInputParam.ARPTD_ID;
    var strReqHeader = appRequest.headers;
    var rpt_session = strInputParam.RPT_SESSION;
    var strTenantId = '';
    var strAppId = '';
    var strrptname = '';
    var strrptdesc = '';
    var strrptpath = '';
    var mCltCas;
    var mDepCas;
    
    
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, pSessionInfo) {
        objLogInfo.HANDLER_CODE = 'SaveReportWP';
        
        try {
            strTenantId = objLogInfo.TENANT_ID;
            _PrintInfo('Begin');

            // Initialize DB
            _PrintInfo('Initializing DB...');
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _PrintInfo('Initializing the params...');
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                    if (pInputStatus.Status == 'SUCCESS') {
                        _PrintInfo('Calling _SaveRptSharing function');
                        // Main function to save report sharing
                        _SaveRptInfo(function callback(pResult) {
                            // var strResult = JSON.stringify(pResult.Data)
                            return _SendResponse(pResult.Status, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                        });
                    } else
                        return _SendResponse(pInputStatus.Status, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60502', 'Error on SaveRptsharing API', error, null);
        }

        function _SaveRptInfo(pCallback) {
            try {
                var RptCond = {};
                if (isUpdate == 'Y') {
                    RptCond['ARPTD_ID'] = apprptId;
                    RptCond['APP_ID'] = strAppId;
                    RptCond['TENANT_ID'] = strTenantId;
                } else {
                    RptCond['RPT_NAME'] = strrptname;
                    RptCond['RPT_DESC'] = strrptdesc;
                }


                reqFXDBInstance.GetTableFromFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', ['APP_ID', 'ARPTD_ID', 'RPT_NAME', 'RPT_DESC', 'RPT_PATH'], RptCond, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', '', 'ERR-RPT-60002', 'Error on querying APP_RPT_DEFINITIONS_INFO table ', pError, null, pCallback);
                    else if (pResult) {
                        _PrintInfo('Got result from APP_RPT_DEFINITIONS_INFO table');
                        if (pResult.rows.length) {
                            if (isUpdate == 'Y') {
                                updateReportDef(function updateCallback(res) {
                                    if (res.Error) {
                                        return _SendResponse(res.Status, res.ErrorCode, res.ErrorMsg, res.Error, res.Warning);
                                    } else {
                                        return _SendResponse(res.Status, res.ErrorCode, res.ErrorMsg, res.Error, res.Warning);
                                    }


                                });
                            } else {
                                return _SendResponse('Report Name already exists', '', '', '', 'FAILURE');
                            }

                        } else {
                            _PrintInfo('Inserting in APP_RPT_DEFINITAIONS_INFO table');
                            reqFXDBInstance.InsertFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', [{
                                TENANT_ID: strTenantId,
                                APP_ID: strAppId,
                                ARPTD_ID: reqUuid.v1(),
                                CREATED_BY: objLogInfo.LOGIN_NAME,
                                CREATED_DATE: reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo),
                                EQ_TEXT: '',
                                LOCKED_BY: '',
                                MODIFIED_BY: '',
                                MODIFIED_DATE: null,
                                PARENT_ARPTD_ID: '0',
                                RPT_DESC: strrptdesc,
                                RPT_JRXML: '',
                                RPT_NAME: strrptname,
                                RPT_PARAM_UI_CONTROLLER: '',
                                RPT_PARAM_UI_VIEW: '',
                                RPT_PARAM_JSON: '',
                                RPT_PATH: strrptpath,
                                QUERY_PARAMS: JSON.stringify(rpt_session)
                            }], objLogInfo, function callbackInsertFXDB(pError, pResult) {
                                // count++
                                if (pError)
                                    _PrintError('ERR-RPT-60504', 'Error on inserting APP_RPT_DEFINITIONS_INFO table', pError);
                                // if (count == TotCount)
                                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);
                            });
                        }
                    }
                });


            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60505', 'Error on _SaveRptInfo()', error, null, pCallback);
            }
        }


        function updateReportDef(updateCallback) {
            _PrintInfo('Updating in APP_RPT_DEFINITAIONS_INFO table');
            var updatecond = {
                "ARPTD_ID": apprptId,
                "TENANT_ID": strTenantId,
                "APP_ID": strAppId

            };
            reqFXDBInstance.UpdateFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', {
                "MODIFIED_DATE": reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo),
                "RPT_DESC": strrptdesc,
                "RPT_NAME": strrptname,
                "RPT_PATH": strrptpath,
                "QUERY_PARAMS": JSON.stringify(rpt_session)
            }, updatecond,
                objLogInfo,
                function callbackupdatetFXDB(pError, pResult) {
                    // count++
                    if (pError)
                        _PrintError('ERR-RPT-60504', 'Error on Updating APP_RPT_DEFINITIONS_INFO table', pError);
                    // if (count == TotCount)
                    return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, updateCallback);
                });
        }

        function _InitializeDB(pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClientDep) {
                _PrintInfo('dep_cas Cassandra Connection Initiated Successfully');
                mDepCas = pClientDep;
                pCallback('Success');
            });
        }

        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            try {
                //Prepare Client Side Params
                if (pClientParam['RPT_NAME'] != undefined && pClientParam['RPT_NAME'] != '') {
                    strrptname = pClientParam['RPT_NAME'].toString();
                }
                if (pClientParam['APP_ID'] != undefined && pClientParam['APP_ID'] != '') {
                    strAppId = pClientParam['APP_ID'].toString();
                }
                if (pClientParam['RPT_DESC'] != undefined && pClientParam['RPT_DESC'] != '') {
                    strrptdesc = pClientParam['RPT_DESC'].toString();
                }
                if (pClientParam['RPT_PATH'] != undefined && pClientParam['RPT_PATH'] != '') {
                    strrptpath = pClientParam['RPT_PATH'].toString();
                }



                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60506', 'Error in _InitializeParams function', error, '', pCallback);
            }
        }

        // To print the Error
        function _PrintError(pErrCode, pMessage, pError) {
            reqInsHelper.PrintError('SaveReportWP', objLogInfo, pErrCode, pMessage, pError);
        }

        // To print the information 
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo('SaveReportWP', pMessage, objLogInfo);
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

        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
            return reqInsHelper.SendResponse('SaveReportInWp', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }

    });
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});

module.exports = router;
/*********** End of Service **********/