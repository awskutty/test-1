/*
@Api_Name           : /UnlockUser,
@Description        : To Unlock the User account
@Last_Error_code    : 'ERR-AUT-11105'
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

//Declare Global variable
var strServiceName = 'UnlockUser';
var mCltClient = '';


// Host api to server
router.post('/UnlockUser', function (appRequest, appResponse) {
    try {
        var objLogInfo;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            objLogInfo.HANDLER_CODE = 'UNLOCK_USER';
            objLogInfo.PROCESS = 'UnlockUser-Authentication';
            objLogInfo.ACTION_DESC = 'UnlockUser';

            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
            pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'cassandra connection initiated Successfully', objLogInfo);
                mCltClient = pClient;
                appResponse.setHeader('Content-Type', 'application/json');

                // Initialize local variables
                var pU_ID = appRequest.body.PARAMS.U_ID;
                var pLogin_Name = appRequest.body.PARAMS.LOGIN_NAME.toUpperCase();
                var strResult = 'FAILURE';
                reqInstanceHelper.PrintInfo(strServiceName, 'Querying Users Table', objLogInfo);
                DBInstance.GetTableFromFXDB(mCltClient, 'users', [], {
                    'login_name': pLogin_Name
                }, objLogInfo, function callbackusersel(err, result) {
                    try {
                        if (err) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11101', 'Querying Users table Failed', err, '', '');
                        } else {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Got Result From Users Table', objLogInfo);
                            for (var i = 0; i < result.rows.length; i++) {
                                var user = result.rows[i];
                                reqInstanceHelper.PrintInfo(strServiceName, 'Updating in  Users Table ', objLogInfo);
                                DBInstance.UpdateFXDB(mCltClient, 'users', {
                                    account_locked_date: null
                                }, {
                                        'u_id': user.u_id,
                                        'client_id': user.client_id,
                                        'login_name': user.login_name
                                    }, objLogInfo, function callbackuseraccnt(err, res) {
                                        try {
                                            if (err) {
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11102', 'Updating Users table Failed', err, '', '');
                                            } else {
                                                strResult = 'SUCCESS';
                                                reqLogWriter.EventUpdate(objLogInfo);
                                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, strResult, objLogInfo, null, null, null);
                                            }
                                        } catch (error) {
                                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11103', 'Updating Users table Failed', error, '', '');
                                        }
                                    })
                            }
                        }
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11104', 'No Users has been Found', error, '', '');
                    }
                })
            })
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11105', 'Error in Starting UnlockUser Function itself', error, '', '');
    }
});


module.exports = router;
/*********** End of Service **********/