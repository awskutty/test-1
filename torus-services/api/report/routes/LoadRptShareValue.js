/**
 * Api_Name         : /LoadRptShareValue
 * Description      : To load the report share value (users / roles)
 * Last_Error_code  : ERR-RPT-60607
 **/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

const USERS = "SELECT U_ID,LOGIN_NAME FROM USERS WHERE LOGIN_NAME = ? AND CLIENT_ID=? ";
const APPUSERS = "SELECT APPU_ID FROM APP_USERS WHERE U_ID=? AND APP_ID=?";
const APPROLES = "SELECT APPR_ID,ROLE_CODE,ROLE_DESCRIPTION FROM APP_ROLES WHERE APP_ID=?";

// Host the method to express
router.post('/LoadRptShareValue', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'application/json');

    // variable declaration
    var strClientId = '';
    var strAppId = '';
    var strCategory = '';
    var strValue = '';
    var strInputParam = appRequest.body.PARAMS;
    var strReqHeader = appRequest.headers;
    var objLogInfo;
    var mCltCas;

    reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {

        try {
            objLogInfo = pLogInfo;
            objLogInfo.HANDLER_CODE = 'LoadRptShareValue';

            _PrintInfo('Begin');

            // Initialize DB
            _PrintInfo('Initializing DB...');
            _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {

                // Initialize params
                _PrintInfo('Initializing the params...');
                _InitializeParams(strInputParam, pSessionInfo, function callbackInitializeParam(pInputStatus) {
                    if (pInputStatus.Status == 'SUCCESS') {
                        // Get Report share value based on Users / Roles
                        _PrintInfo('Calling _GetReportSharingValue function');
                        _GetReportSharingValue(function callback(pResult) {
                            var strResult = null;
                            if (pResult.Status == 'SUCCESS') {
                                strResult = pResult.Data;
                            }
                            return _SendResponse(strResult, '', '', null, null);
                        });
                    } else
                        return _SendResponse(null, pInputStatus.ErrorCode, pInputStatus.ErrorMsg, pInputStatus.Error, pInputStatus.Warning);
                });
            });
        } catch (error) {
            return _SendResponse(null, 'ERR-RPT-60601', 'Error while calling LoadRptShareValue API function ', error, null);
        }

        function _GetReportSharingValue(pCallback) {
            if (strCategory.toLowerCase() == 'users') {
                _GetUserShareValue(function callbackGetUserShareValue(pUsers) {
                    pCallback(pUsers);
                });
            } else {
                _GetRoleShareValue(function callbackGetRoleShareValue(pRoles) {
                    pCallback(pRoles);
                });
            }
        }

        function _GetUserShareValue(pCallback) {
            var arrUsers = [];
            try {
                _PrintInfo('Querying USERS table');

                // reqFXDBInstance.GetTableFromFXDB(mCltCas, 'USERS', ['U_ID', 'LOGIN_NAME'], {
                //     LOGIN_NAME: strValue.toUpperCase(),
                //     CLIENT_ID: strClientId,
                //     TENANT_ID: objLogInfo.TENANT_ID
                // }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                // code changed for load only app related user, son join with pp user table.
                var userSelectqry = {
                    query: `SELECT APU.appu_id,U.login_name FROM USERS U INNER JOIN APP_USERS APU ON U.U_ID = APU.U_ID WHERE U.CLIENT_ID=? AND APU.APP_ID=? AND U.TENANT_ID=? AND LOGIN_NAME LIKE ?`,
                    params: [strClientId, objLogInfo.APP_ID, objLogInfo.TENANT_ID.toLowerCase(), `%${strValue.toUpperCase()}%`]
                }
                reqFXDBInstance.ExecuteSQLQueryWithParams(mCltCas, userSelectqry, objLogInfo, function callbackGetTableFromFXDB(pResult, pError) {
                    if (pResult) {
                        _PrintInfo(' Got result from USERS table');
                        if (pResult.rows.length > 0) {
                            _PrintInfo('Got result from APP_USERS table');
                            for (var i = 0; i < pResult.rows.length; i++) {
                                var objUser = {};
                                objUser.ID = pResult.rows[i]['appu_id'];
                                objUser.NAME = pResult.rows[i]['login_name'];
                                arrUsers.push(objUser);
                            }
                            return _PrepareAndSendCallback('SUCCESS', arrUsers, '', '', null, null, pCallback);
                        } else {
                            return _PrepareAndSendCallback('SUCCESS', arrUsers, '', '', null, null, pCallback);
                        }

                        // var count = 0;
                        // var totCount = pResult.rows.length;
                        // for (var i = 0; i < pResult.rows.length; i++) {
                        //     var user = pResult.rows[i];
                        //     _PrintInfo('Querying APP_USERS table');
                        //     reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_USERS', ['APPU_ID'], {
                        //         U_ID: user['u_id'],
                        //         APP_ID: strAppId
                        //     }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                        //         count++;
                        //         if (pError)
                        //             _PrintError('ERR-RPT-60603', 'Error on querying APP_USERS table ', pError, null);
                        //         else {
                        //             if (pResult.rows.length > 0) {
                        //                 _PrintInfo('Got result from APP_USERS table');
                        //                 var objUser = {};
                        //                 objUser.ID = pResult.rows[0]['appu_id'];
                        //                 objUser.NAME = user['login_name'];
                        //                 arrUsers.push(objUser);
                        //             }
                        //         }
                        //         if (count == totCount)
                        //             return _PrepareAndSendCallback('SUCCESS', arrUsers, '', '', null, null, pCallback);
                        //     });
                        // }
                    } else if (pError) {
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60602', 'Error on querying USERS table ', pError, null, pCallback);
                    }
                    else
                        return _PrepareAndSendCallback('SUCCESS', arrUsers, '', '', null, null, pCallback);
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60604', 'Error on _GetUserShareValue() ', error, null, pCallback);
            }
        }

        function _GetRoleShareValue(pCallback) {
            var arrRoles = [];
            try {
                _PrintInfo('Querying APP_ROLES table');
                reqFXDBInstance.GetTableFromFXDB(mCltCas, 'APP_ROLES', ['APPR_ID', 'ROLE_CODE', 'ROLE_DESCRIPTION'], {
                    APP_ID: strAppId
                }, objLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                    if (pError)
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60605', 'Error on querying APP_ROLES table', pError, null, pCallback);
                    else if (pResult) {
                        for (var i = 0; i < pResult.rows.length; i++) {
                            _PrintInfo('Got result from APP_ROLES table');
                            var role = pResult.rows[i];
                            var objRole = {};
                            objRole.ID = role['appr_id'];
                            objRole.NAME = role['role_description'];
                            arrRoles.push(objRole);
                        }
                        return _PrepareAndSendCallback('SUCCESS', arrRoles, '', '', null, null, pCallback);
                    } else
                        return _PrepareAndSendCallback('SUCCESS', arrRoles, '', '', null, null, pCallback);
                });
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60606', 'Error on calling _GetRoleShareValue() fucntion', error, null, pCallback);
            }
        }

        function _InitializeDB(pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                _PrintInfo('Connection Connection Initiated Successfully');
                mCltCas = pClient;
                pCallback('Success');
            });
        }

        function _InitializeParams(pClientParam, pSessionInfo, pCallback) {
            try {
                //Prepare Client Side Params
                if (pSessionInfo['APP_ID'] != undefined && pSessionInfo['APP_ID'] != '')
                    strAppId = pSessionInfo['APP_ID'].toString();

                if (pSessionInfo['CLIENT_ID'] != undefined && pSessionInfo['CLIENT_ID'] != '')
                    strClientId = pSessionInfo['CLIENT_ID'].toString();

                if (pClientParam['CATEGORY'] != undefined && pClientParam['CATEGORY'] != '')
                    strCategory = pClientParam['CATEGORY'].toString();

                if (pClientParam['VALUE'] != undefined && pClientParam['VALUE'] != '')
                    strValue = pClientParam['VALUE'].toString();

                return _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-RPT-60607', 'Error on _InitializeParams()', error, null, pCallback);
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