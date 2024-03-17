/**
 * Api_Name         : /LoadRptSharing
 * Description      : To LoadRptSharing
 * Last_Error_code  : ERR-RPT-60305
 **/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

const RPTSHARING = "SELECT * FROM APP_RPT_SHARING where ARPTD_ID=? ALLOW FILTERING";

// host the Method to express
router.post('/LoadRptSharing', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'application/json');

    // variable declaration
    var strArptId = '';
    var strAppId = '';
    var strInputParam = appRequest.body.PARAMS;
    var strReqHeader = appRequest.headers;
    var objLogInfo;
    var mCltCas;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'LoadRptSharing';
        try {
            _PrintInfo('Initializing DB');
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _PrintInfo('Initializing the params Function');
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                    if (pInputStatus.Status == 'SUCCESS') {
                        _PrintInfo('Calling _LoadReportSharing Function');
                        _LoadReportSharing(function callback(pResult) {
                            var strResult = null;
                            if (pResult.Status == 'SUCCESS') {
                                strResult = JSON.stringify(pResult);
                                _PrintInfo('Result : ' + strResult);
                            }
                            return _SendResponse(strResult, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                        });
                    } else {
                        return _SendResponse(null, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                    }
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60301', 'Error while calling LoadRptSharing function', error, null);
        }

        function _LoadReportSharing(pCallback) {
            try {
                // get Rpt definitions info table
                _PrintInfo('Querying APP_RPT_SHARING table');
                reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_RPT_SHARING', [], {
                    ARPTD_ID: strArptId,
                    TENANT_ID: objLogInfo.TENANT_ID
                }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    var arrSharingJson = [];
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60302', 'Error on querying APP_RPT_SHARING table', pError, null, pCallback);
                    else if (pResult) {
                        try {
                            _PrintInfo('Got result FROM APP_RPT_SHARING table');
                            for (var i = 0; i < pResult.rows.length; i++) {
                                var dr = pResult.rows[i];
                                var objSharingJson = {};
                                objSharingJson.SHARING_MODE = dr['sharing_mode'];
                                objSharingJson.SHARING_VALUE = dr['sharing_value'];
                                objSharingJson.ARPTD_ID = dr['arptd_id'];
                                objSharingJson.SHARING_ACTION = JSON.parse(dr['sharing_action']);
                                objSharingJson.APP_ID = strAppId;
                                arrSharingJson.push(objSharingJson);
                            }
                            return _PrepareAndSendCallback('SUCCESS', arrSharingJson, '', '', null, null, pCallback);
                        } catch (error) {
                            return _PrepareAndSendCallback('FAILURE', arrSharingJson, 'ERR-RPT-60303', 'Error on preparing Report Sharing info', error, null, pCallback);
                        }
                    }
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60304', 'Error on _LoadReportSharing()', error, null, pCallback);
            }
        }

        function _InitializeDB(pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                _PrintInfo('Cassandra Connection Initiated Successfully');
                mCltCas = pClient;
                pCallback('Success');
            });
        }

        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            //Prepare Client Side Params
            try {
                if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                    strAppId = pSessionInfo['APP_ID'].toString();

                if (pClientParam['ARPTD_ID'] != undefined && pClientParam['ARPTD_ID'] != '')
                    strArptId = pClientParam['ARPTD_ID'].toString();

                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60305', 'Error on _InitializeParams()', error, null, pCallback);
            }
        }

        // To print the Error
        function _PrintError(pErrCode, pMessage, pError) {
            reqInsHelper.PrintError('LoadRptSharing', objLogInfo, pErrCode, pMessage, pError);
        }

        // To print the information 
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo('LoadRptSharing', pMessage, objLogInfo);
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
            return reqInsHelper.SendResponse('LoadRptSharing', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }

    });
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});

module.exports = router;
    /*********** End of Service **********/