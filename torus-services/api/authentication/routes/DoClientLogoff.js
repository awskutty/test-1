/*  Created BY      :Udhaya
    Created Date    :07-jun-2016
    Purpose         :LogOff,Clear user session while logoff cp
    */
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
// Cassandra initialization
// var mClient = reqCasInstance.SessionValues['clt_cas'];
var objLogInfo;
//Host api
router.post('/DoClientLogoff', function (req, resp, next) {
    pHeaders = req.headers;
    var mClient = '';
    var pHeaders = "";
    objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    objLogInfo.PROCESS = 'DoClientLogoff-Authentication';
    objLogInfo.ACTION = 'DoClientLogoff';
    objLogInfo.USER_NAME = req.body.LOGIN_NAME;
    reqLogWriter.Eventinsert(objLogInfo);
    DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
        mClient = pClient;

        try {
            // Define local variables
            var strUserid = req.body.U_ID;
            var strSessionid = req.body.SESS_ID;
            var strLoginip = req.body.LOGIN_IP;
            console.log('U_ID= %s , SESS_ID= %s , LOGIN_IP=%s', strUserid, strSessionid, strLoginip);

            // Prepare queries
            const DELETESESSION = 'delete from user_sessions where u_id =? and login_ip =? and session_id = ?';

            //Function call
            DoClientLogoff();

            // Do the Client LogOff function
            function DoClientLogoff() {
                try {
                    reqLogWriter.TraceInfo(objLogInfo, ' DoClientLogoff called...');
                    DBInstance.DeleteFXDB(mClient, 'user_sessions', {
                        'u_id': strUserid,
                        'login_ip': strLoginip,
                        'session_id': strSessionid
                    }, objLogInfo, function callbackClientLogoff(pError) {
                        // mClient.execute(DELETESESSION, [strUserid, strLoginip, strSessionid], {
                        //     prepare: true
                        // }, function callbackClientLogoff(pError) {
                        try {
                            if (pError) {
                                reqLogWriter.TraceError(objLogInfo, pError, "ERR-FX-10104");
                            } else {
                                var Equery = 'delete from user_sessions where u_id =' + strUserid + ' and login_ip =' + strLoginip + ' and session_id = ' + strSessionid;
                                reqLogWriter.TraceInfo(objLogInfo, Equery);
                                reqLogWriter.TraceInfo(objLogInfo, ' DoClientLogoff Success...');
                                var strResult = "SUCCESS";
                                reqLogWriter.TraceInfo(objLogInfo, 'LogOff Result :' + strResult);
                                //Send response to client
                                resp.write(strResult);
                                reqLogWriter.EventUpdate(objLogInfo);
                                resp.end();
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10104", "Error DoClientLogoff function ERR-002 " + error)
                        }
                    });
                } catch (error) {
                    errorHandler("ERR-FX-10103", "Error DoClientLogoff function ERR-003" + error)
                }
            }
        } catch (error) {
            errorHandler("ERR-FX-10102", "Error DoClientLogoff function ERR-001" + error)
        }

        function errorHandler(errcode, message) {
            console.log(message, errcode);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }
    })
});


module.exports = router;
//*******End of Serive*******//