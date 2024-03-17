/****
 * Api_Name         : /SaveRptsharing
 * Description      : To save the report sharing process
 * Last_Error_code  : ERR-RPT-60506
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/'
var reqExpress = require(modPath + 'express')
var reqAsync = require(modPath + 'async')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var router = reqExpress.Router();
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Host the Method to express
router.post('/DeleteReport', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'application/json');

    // variable declaration
    var strRptSharingDetail = ''
    var strInputParam = appRequest.body.PARAMS;
    var strReqHeader = appRequest.headers;
    var strAppId = '';
    var straprptId = '';
    var objLogInfo;
    // var mCltCas;
    var mDepCas;


    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {
        objLogInfo = pLogInfo
        objLogInfo.HANDLER_CODE = 'DeleteReport';

        try {
            _PrintInfo('Begin')

            // Initialize DB
            _PrintInfo('Initializing DB...');
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _PrintInfo('Initializing the params...');
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                    if (pInputStatus.Status == 'SUCCESS') {
                        _PrintInfo('Calling DeleteReport function');
                        // Main function to save report sharing
                        _deleteRptInfo(function callback(pResult) {
                            // var strResult = JSON.stringify(pResult.Data)
                            return _SendResponse(pResult.Status, pResult.ErrorCode, pResult.ErrorMsg, pResult.Error, pResult.Warning)
                        });
                    } else
                        return _SendResponse(pInputStatus.Status, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning)
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60502', 'Error on DeleteReport API', error, null)
        }

        function _deleteRptInfo(pCallback) {
            try {
                var condObj = {};
                condObj['APP_ID'] = strAppId || pSessionInfo.APP_ID;
                condObj['ARPTD_ID'] = straprptId;
                reqFXDBInstance.DeleteFXDB(mDepCas, 'APP_RPT_DEFINITIONS_INFO', condObj, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', '', 'ERR-RPT-60002', 'Error on deleting APP_RPT_DEFINITIONS_INFO table ', pError, null, pCallback)
                    else if (pResult) {
                        _PrintInfo('Got result from APP_RPT_DEFINITIONS_INFO table');
                        return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback)
                    }
                })


            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60505', 'Error on _deleteRptInfo()', error, null, pCallback)
            }
        }

        function _InitializeDB(pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClientDep) {
                _PrintInfo('dep_cas Cassandra Connection Initiated Successfully');
                mDepCas = pClientDep
                pCallback('Success')
            })
        }

        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            try {
                //Prepare Client Side Params
                if (pClientParam['APP_ID'] != undefined && pClientParam['APP_ID'] != '') {
                    strAppId = pClientParam['APP_ID'].toString()
                }
                if (pClientParam['APRPT_ID'] != undefined && pClientParam['APRPT_ID'] != '') {
                    straprptId = pClientParam['APRPT_ID'].toString()
                }



                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback)

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60506', 'Error in _InitializeParams function', error, '', pCallback)
            }
        }

        // To print the Error
        function _PrintError(pErrCode, pMessage, pError) {
            reqInsHelper.PrintError('DeleteReport', objLogInfo, pErrCode, pMessage, pError)
        }

        // To print the information 
        function _PrintInfo(pMessage) {
            reqInsHelper.PrintInfo('DeleteReport', pMessage, objLogInfo)
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
            }
            return pCallback(objCallback)
        }

        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInsHelper.SendResponse('DeleteReport', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }

    })
    appResponse.on('close', function () {});
    appResponse.on('finish', function () {});
    appResponse.on('end', function () {});
})

module.exports = router
/*********** End of Service **********/