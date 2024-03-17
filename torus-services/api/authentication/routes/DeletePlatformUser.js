/*
Modifed by Udhayaraj for Delete  users on 08-11-2016 
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Cassandra initialization
// var mCltClient = reqCasInstance.SessionValues['clt_cas'];

const DELUSER = 'delete from users where client_id=? and login_name=? and u_id=?';
const DELPLTUSERD = 'delete from users_platform_details where client_id=? and login_name=?';

router.post('/DeletePlatformUser', function (pReq, pResp, pNext) {
    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(pReq.body, pReq);
    objLogInfo.PROCESS = 'DeletePlatformUser-Authentication';
    objLogInfo.ACTION = 'DeletePlatformUser';
    reqLogWriter.Eventinsert(objLogInfo);

    try {
        DBInstance.GetFXDBConnection(pReq.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mCltClient) {
            // Initialize local variables
            reqLogWriter.TraceInfo(objLogInfo, ' DeletePlatformUser called');
            pResp.setHeader('Content-Type', 'application/json');
            var pLogin_name = pReq.body.DELETE_LOGIN_NAME;
            var pClientId = pReq.body.CLIENT_ID;
            var pU_id = pReq.body.DELETE_U_ID;
            DBInstance.DeleteFXDB(mCltClient, 'users', {
                'client_id': pClientId,
                'login_name': pLogin_name,
                'u_id': pU_id
            }, objLogInfo, function callbackdeluser(err) {
                // mCltClient.execute(DELUSER, [pClientId, pLogin_name, pU_id], {
                //     prepare: true
                // }, function callbackdeluser(err) {
                if (err) {
                    console.log(err.stack);
                } else {
                    //            var GatewayConfig = InstanceHelper.ApiGatewayConfig;
                    //            if (!GatewayConfig) {
                    //                var objKH As New ApiGatewayHelper(InstanceHelper.ApiGatewayConfig)
                    //                objKH.DeleteKongUser(pU_id, pLogin_name.ToString.ToUpper())
                    //            }
                    DBInstance.DeleteFXDB(mCltClient, 'users_platform_details', {
                        'client_id': pClientId,
                        'login_name': pLogin_name,
                    }, objLogInfo, function callbackdelpltuser(err) {
                        // mCltClient.execute(DELPLTUSERD, [pClientId, pLogin_name], {
                        //     prepare: true
                        // }, function callbackdelpltuser(err) {
                        try {
                            if (err) {

                                reqLogWriter.TraceError(objLogInfo, err, "ERR-FX-10101");

                            } else {
                                reqLogWriter.TraceInfo(objLogInfo, ' DeletePlatformUser Success');
                                reqLogWriter.EventUpdate(objLogInfo);
                                pResp.send(JSON.stringify('SUCCESS'));
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10101", "Error DeletePlatformUser function " + error)
                        }
                    })
                }
            })
        });
    } catch (error) {
        errorHandler("ERR-FX-10100", "Error DeletePlatformUser function " + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
});


module.exports = router;