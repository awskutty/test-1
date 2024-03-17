/**
 * Created by tjothi on 6/08/2016.
 */

// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var objLogInfo = ''
    // Cassandra initialization
    // var mClient = reqCasInstance.SessionValues['plt_cas'];

// API hosting
router.post('/DoAdminLogoff', function(req, resp, next) {
    try {
        // Initialize local variables
        var strUserid = req.body.U_ID;
        var strSessionid = req.body.SESSION_ID;
        var strLoginip = req.body.LOGIN_IP;
        var strInputParamJson = req.body;
        var strResult = ''
            // console.log("U_ID=" + strUserid);
            // console.log("SESSION_ID=" + strSessionid);
            // console.log("LOGIN_IP=" + strLoginip);

        // Prepare query
        const USERSESDELETE = 'delete from user_sessions where u_id =? and session_id =? and login_ip = ?';

        objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'DoAdminLogoff-Authentication';
        objLogInfo.ACTION = 'DoAdminLogoff';
        // Function call
        DoMainAdminLogoff();
        // Check the user id
        function DoMainAdminLogoff() {
            try {
                if (strUserid != '' && strUserid != null && strUserid != undefined) {
                    DoAdminLogoff();
                } else {
                    strResult = "SUCCESS";
                    _Response();
                }
            } catch (error) {
                errorHandler('ERR-FX-10002', "Error DoAdminLogoff function" + error)
            }
        }
        // Do the Admin LogOff
        function DoAdminLogoff() {
            try {
                DBInstance.GetFXDBConnection(req.headers, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                    //reqCasInstance.GetCassandraConn(req.headers, 'plt_cas', function Callback_GetCassandraConn(mClient) {

                    // Delete the user session
                    DBInstance.DeleteFXDB(mClient, 'user_sessions', {
                        'u_id': strUserid,
                        'session_id': strSessionid,
                        'login_ip': strLoginip
                    }, objLogInfo, function callbackAdminLogoff(pError) {
                        // mClient.execute(USERSESDELETE, [strUserid, strSessionid, strLoginip], {
                        //     prepare: true
                        // }, function callbackAdminLogoff(pError) {
                        try {
                            if (pError) {
                                reqLogWriter.TraceError(objLogInfo, pError, 'ERR-FX-10004');
                                // console.error(pError);
                            } else {
                                strResult = "SUCCESS"
                                    // console.log('Result Json' + strResult);
                                    // Return the response
                                _Response();
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10004", "Error DoAdminLogoff function" + error)
                        }
                    });

                });
            } catch (error) {
                errorHandler("ERR-FX-10003", "Error DoAdminLogoff function" + error)
            }
        }

        function _Response() {
            reqLogWriter.EventUpdate(objLogInfo);
            resp.write(strResult);
            resp.end();
        }
    } catch (error) {
        errorHandler("ERR-FX-10001", "Error DoAdminLogoff function" + error)
    }
});

function errorHandler(errcode, message) {
    console.log(message, errcode);
    reqLogWriter.TraceError(objLogInfo, message, errcode);
}
module.exports = router;
// End function