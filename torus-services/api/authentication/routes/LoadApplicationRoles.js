/*
@Api_Name : /SaveParamsConfig,
@Description: To save tenant_setup params to DB
 * @Last_Error_code:ERR-UI-110701
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var appRoot = '../../../../torus-references'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLinq = require(modPath + 'node-linq').LINQ;
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance')
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqLogInfo = require(appRoot + '/log/trace/LogInfo');
var reqInsHelper = require(appRoot + '/common/InstanceHelper');

// Global variable initialization 


var strServiceName = 'LoadApplicationRoles'
router.post('/LoadApplicationRoles', function (appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
            objLogInfo = pLogInfo
            // Handle the api close event from when client close the request

            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            _PrintInfo('Begin');
            // Initialize local variables
            var pResp = appResponse
            var APPU_ID = appRequest.body.PARAMS.APPU_ID
            var AppId = appRequest.body.PARAMS.APP_ID
            var connString = ''
            var CondObj = {};
            objLogInfo.PROCESS = 'LoadApplicationRoles';
            objLogInfo.ACTION_DESC = 'LoadApplicationRoles';

            // var query = {
            //     query: `select role_description, role_code, ar.appr_id, ar.menu_type from app_roles ar inner join app_user_roles aur on ar.appr_id = aur.appr_id inner join app_users au on au.appu_id = aur.appu_id inner join users u on u.u_id = au.u_id where au.appu_id = ? and au.app_id =? and u.u_id=?`,
            //     params: [APPU_ID, AppId, session_info.U_ID]
            // };
            // Function call
            var query = {
                query: `select role_description,role_code,ar.appr_id,ar.menu_type from app_roles ar inner join app_user_roles aur on ar.appr_id = aur.appr_id where appu_id = ? and app_id= ?`,
                params: [APPU_ID, AppId]
            }

            _GetRoles()

            // _Prepareparams(

            function _GetRoles() {

                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {

                        // reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function callbackGet(pError, pResult) {
                        reqTranDBInstance.ExecuteSQLQueryWithParams(mClient, query, objLogInfo, function (pResult, pError) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134509', 'Error In app_user_roles Execution', pError);
                            } else {
                                try {
                                    var RolesArr = [];
                                    if (pResult.rows.length > 0) {
                                        RolesArr = pResult.rows;
                                        reqInsHelper.SendResponse(strServiceName, appResponse, RolesArr, objLogInfo, null, null, null)
                                    } else {
                                        var query = {
                                            "query": `select  ar.role_description, ar.role_code, ar.appr_id, ar.menu_type,au.appu_id from App_Users au
                                         inner  join user_group_app_roles uga on uga.ug_code = au.ug_code 
                                          inner join app_roles ar on ar.appr_id = uga.appr_id where au.appu_id =?`,
                                            "params": [APPU_ID]
                                        }
                                        // reqFXDBInstance.ExecuteQuery(mClient, query, objLogInfo, function callbackGet(pError, pResult) {

                                        reqTranDBInstance.ExecuteSQLQueryWithParams(mClient, query, objLogInfo, function (pResult, pError) {
                                            if (pError) {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134509', 'Error In app_user_roles Execution', pError);
                                            } else {
                                                RolesArr = pResult.rows;
                                                reqInsHelper.SendResponse(strServiceName, appResponse, RolesArr, objLogInfo, null, null, null)
                                            }
                                        })
                                    }
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134508', 'Error in  GetRoles function call', error);
                                }
                            }
                        });

                        // reqFXDBInstance.GetTableFromFXDB(mClient, 'APP_USER_ROLES', [], {}, objLogInfo, function SELCLIENT(pError, pResult) {
                        //     if (pError) {
                        //         reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134509', 'Error In app_user_roles Execution', pError);
                        //     } else {
                        //         try {
                        //             var RolesArr;
                        //             if (pResult.rows.length > 0) {
                        //                 RolesArr = pResult.rows;
                        //             }
                        //             reqInsHelper.SendResponse(strServiceName, appResponse, RolesArr, objLogInfo, null, null, null)
                        //         } catch (error) {
                        //             reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134508', 'Error in  GetRoles function call', error);
                        //         }
                        //     }
                        // });

                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134507', 'Error In _GetRoles function', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-134506', 'Error In _GetRoles function', error);
    }



    // function _Getfxsetupmaster() {
    //     try {

    //     } catch (error) {

    //     }
    // }


    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }

});



module.exports = router;
// End function