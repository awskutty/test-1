/*  Created BY      :Udhaya
    Created Date    :09-jun-2016
    Purpose         :Clear user session when user already logedin message came "Press F9"
    */
// Require dependencies
var modPath = '../../../../node_modules/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
// Cassandra initialization
// var mClient = reqCasInstance.SessionValues['plt_cas'];

//Host api
router.post('/ClearPlatformSessions', function (req, resp) {

    var objLogInfo = reqLogInfo.AssignLogInfoDetailForCP(req.body, req);
    objLogInfo.PROCESS = 'ClearPlatformSessions-Authentication';
    objLogInfo.ACTION = 'ClearPlatformSessions'
    reqLogWriter.Eventinsert(objLogInfo);

    try {

        // Variable declare
        var strResult = '';
        var srtLoginname = req.body.pUname;

        // Prepare the select query to find the U_id		
        const strSelectQuery = 'select u_id from users where login_name = ?';

        //prepare delete query by using u_id get from the above select query 		
        const strDeleteQuery = 'delete from user_sessions where u_id=?';
        //Function call
        ClearPlatformSessions();

        function ClearPlatformSessions() {
            try {
                reqDBInstance.GetFXDBConnection(req.headers, 'plt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                    reqDBInstance.GetTableFromFXDB(mClient, 'USERS', ['u_id'], { 'login_name': srtLoginname }, objLogInfo, function callbackClearSession(pError, pResult) {
                        try {
                            if (pError) {
                                reqLogWriter.TraceError(objLogInfo, pError, "ERR-FX-10050");
                                PrepareResultStr();
                            } else {
                                if (pResult.rows.length > 0) {
                                    //mClient.execute(strDeleteQuery, [pResult.rows[0].u_id], {prepare: true},function callbackClientLogoff(pError, pResult) {
                                    reqDBInstance.DeleteFXDB(mClient, 'USER_SESSIONS', { 'u_id': pResult.rows[0].u_id }, objLogInfo, function callbackClientLogoff(pError, pResult) {
                                        try {
                                            if (pError) {
                                                reqLogWriter.TraceError(objLogInfo, pError, "ERR-FX-10050");
                                                strResult = pError.toString()
                                            } else {

                                                strResult = 'SUCCESS';
                                                reqLogWriter.TraceInfo(objLogInfo, 'Result :' + strResult);
                                            }
                                            PrepareResultStr()
                                        } catch (error) {
                                            errorHandler("ERR-FX-10050", "Error in ClearPlatformSessions function ERR-AUTH-SERVICE" + error)
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            errorHandler("ERR-FX-10049", "Error in ClearPlatformSessions function ERR-AUTH-SERVICE" + error)
                        }
                    });
                });
            } catch (error) {
                errorHandler("ERR-FX-10048", "Error in ClearPlatformSessions function ERR-AUTH-SERVICE" + error)
            }
        }

        function PrepareResultStr() {
            resp.write(strResult);
            reqLogWriter.EventUpdate(objLogInfo);
            resp.end();
        }

    } catch (error) {
        errorHandler("ERR-FX-10047", "Error in ClearPlatformSessions function ERR-AUTH-SERVICE" + error)
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }
})


module.exports = router;
//*******End of Serive*******//