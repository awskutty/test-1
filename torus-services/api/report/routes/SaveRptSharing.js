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

const INSERTRPTSHARING = "INSERT INTO APP_RPT_SHARING(APP_ID,SHARING_MODE,SHARING_VALUE,SHARING_ACTION,ARPTD_ID) VALUES( ? , ? , ? , ? , ? )";
const DELETERPTSHARING = "DELETE FROM APP_RPT_SHARING WHERE APP_ID= ? AND SHARING_MODE= ? AND SHARING_VALUE= ? AND ARPTD_ID = ? ; ";

// Host the Method to express
router.post('/SaveRptsharing', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'application/json');

    // variable declaration
    var strRptSharingDetail = '';
    var strInputParam = appRequest.body.PARAMS;
    var strReqHeader = appRequest.headers;
    var objLogInfo;
    var mCltCas;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
        objLogInfo = pLogInfo;
        objLogInfo.HANDLER_CODE = 'SaveRptsharing';

        try {
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
                        _SaveRptSharing(function callback(pResult) {
                            var strResult = JSON.stringify(pResult.Data);
                            return _SendResponse(pResult.Status, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning);
                        });
                    } else
                        return _SendResponse(pInputStatus.Status, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60502', 'Error on SaveRptsharing API', error, null);
        }

        function _SaveRptSharing(pCallback) {
            try {
                var arrRptSharingInfo = JSON.parse(strRptSharingDetail);
                var count = 0;
                var TotCount = arrRptSharingInfo.length;

                reqAsync.forEachOfSeries(arrRptSharingInfo, function (value, key, callbackSaveRpt) {
                    SaveRptActionData(value, function (res) {
                        callbackSaveRpt();
                    });
                }, function (err) {
                    if (err != '') {
                        return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);
                    } else {
                        return _SendResponse('FAILURE', 'ERR-RPT-700801', null, err, null);
                    }
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60505', 'Error on _SaveRptSharing()', error, null, pCallback);
            }
        }


        function SaveRptActionData(currentAction, callbackSaveRpt) {
            var dr = currentAction;
            if (dr['ACTION'] != undefined && dr['ACTION'] != null && dr['ACTION'].toLowerCase() == 'delete') {
                _PrintInfo('Deleting in APP_RPT_SHARING table');
                reqFXDBInstance.DeleteFXDB(mCltCas, 'APP_RPT_SHARING', {
                    APP_ID: dr['APP_ID'],
                    SHARING_MODE: dr['SHARING_MODE'],
                    SHARING_VALUE: dr['SHARING_VALUE'],
                    ARPTD_ID: dr['ARPTD_ID'],
                    TENANT_ID: objLogInfo.TENANT_ID
                }, objLogInfo, function callbackDeleteRptSharing(pError, pResult) {

                    if (pError) {
                        _PrintError('ERR-RPT-60503', 'Error on deleting APP_RPT_SHARING table', pError);
                    } else {
                        callbackSaveRpt();

                    }
                });
            } else {
                reqFXDBInstance.DeleteFXDB(mCltCas, 'APP_RPT_SHARING', {
                    APP_ID: dr['APP_ID'],
                    SHARING_MODE: dr['SHARING_MODE'],
                    SHARING_VALUE: dr['SHARING_VALUE'],
                    ARPTD_ID: dr['ARPTD_ID'],
                    TENANT_ID: objLogInfo.TENANT_ID
                }, objLogInfo, function callbackDeleteRptSharing(pError, pResult) {

                    if (pError) {
                        _PrintError('ERR-RPT-60503', 'Error on deleting APP_RPT_SHARING table', pError);
                    } else {
                        _PrintInfo('Inserting in APP_RPT_SHARING table');
                        reqFXDBInstance.InsertFXDB(mCltCas, 'APP_RPT_SHARING', [{
                            APP_ID: dr['APP_ID'],
                            SHARING_MODE: dr['SHARING_MODE'],
                            SHARING_VALUE: dr['SHARING_VALUE'],
                            SHARING_ACTION: JSON.stringify(dr['SHARING_ACTION']),
                            ARPTD_ID: dr['ARPTD_ID'],
                            TENANT_ID: objLogInfo.TENANT_ID,
                            CREATED_BY: objLogInfo.USER_ID,
                            CREATED_BY_NAME: objLogInfo.LOGIN_NAME,
                            CREATED_DATE: reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo)
                        }], objLogInfo, function callbackInsertFXDB(pError, pResult) {
                            if (pError) {
                                _PrintError('ERR-RPT-60504', 'Error on inserting APP_RPT_SHARING table', pError);
                            } else {
                                callbackSaveRpt();
                            }


                        });
                    }



                });

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
            try {
                //Prepare Client Side Params
                if (pClientParam['RPT_SHARING_DETAILS'] != undefined && pClientParam['RPT_SHARING_DETAILS'] != '')
                    strRptSharingDetail = pClientParam['RPT_SHARING_DETAILS'].toString();

                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60506', 'Error in _InitializeParams function', error, '', pCallback);
            }
        }

        // To print the Error
        function _PrintError(pErrCode, pMessage, pError) {
            reqInsHelper.PrintError('SaveRptSharing', objLogInfo, pErrCode, pMessage, pError);
        }

        // To print the information 
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo('SaveRptSharing', pMessage, objLogInfo);
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
            return reqInsHelper.SendResponse('SaveRptSharing', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }

    });
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});

module.exports = router;
    /*********** End of Service **********/